import chalk from 'chalk';
import { createClient } from 'contentful-management';
import * as deepl from 'deepl-node';
import dotenv from 'dotenv';
import fs from 'fs';
import inquirer from 'inquirer';
import path from 'path';

// Try to load config from project root
let config;
try {
  const configPath = path.join(process.cwd(), 'translate.config.json');
  const configExists = fs.existsSync(configPath);

  if (!configExists) {
    console.error(chalk.red('\nError: Missing configuration file'));
    console.error(chalk.yellow('\nPlease create a translate.config.json file in your project root.'));
    console.error(chalk.gray('\nExample translate.config.json:'));
    console.error(chalk.gray(`{
    "maxDepth": 5,
    "maxFields": 200,
    "startingContentType": "recipe",
    "logging": {
        "saveFailedTranslations": false,
        "failedTranslationsPath": "logs/failed-translations"
    },
    "skipFields": ["slug", "videoUrl"],
    "supportedLocales": ["de", "fr", "es"]
}`));
    process.exit(1);
  }

  const configContent = await fs.promises.readFile(configPath, 'utf8');
  config = JSON.parse(configContent);
} catch (error) {
  console.error(chalk.red('\nError loading configuration:'), error.message);
  process.exit(1);
}

import { SUPPORTED_LOCALES } from './translation/constants.mjs';
import { processEntry } from './translation/processEntry.mjs';

dotenv.config({ path: '.env.development' });

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const ACCESS_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const DEEPL_API_KEY = process.env.DEEPL_API_KEY;

if (!SPACE_ID || !ACCESS_TOKEN || !DEEPL_API_KEY) {
  console.error(chalk.red('Missing environment variables:'));
  if (!SPACE_ID) console.error(chalk.red('- CONTENTFUL_SPACE_ID'));
  if (!ACCESS_TOKEN) console.error(chalk.red('- CONTENTFUL_MANAGEMENT_TOKEN'));
  if (!DEEPL_API_KEY) console.error(chalk.red('- DEEPL_API_KEY'));
  console.error(chalk.red('Missing required environment variables. Please check your .env file.'));
  process.exit(1);
}

const translator = new deepl.Translator(DEEPL_API_KEY);
const client = createClient({
  accessToken: ACCESS_TOKEN,
});

async function translateContent(text, targetLang) {
  try {
    // Skip empty or very short strings (likely fragments)
    if (!text || text.length < 3) {
      return text;
    }

    // Log translation attempt
    if (text.length > 10) {
      const displayText = text.length > 50 ? `${text.substring(0, 50)}...` : text;
      console.log(chalk.gray(`Translating: "${displayText}"`));
    }

    const result = await translator.translateText(text, 'en', targetLang);
    return result.text;
  } catch (error) {
    console.error(chalk.red(`Translation error: ${error.message}`));
    return null;
  }
}

async function saveFailedUpdates(failedUpdates, locale) {
  // Only save if enabled in config
  if (!config.logging?.saveFailedTranslations) {
    return;
  }

  try {
    const logDir = config.logging?.failedTranslationsPath || 'logs/failed-translations';

    // Create directory if it doesn't exist
    await fs.promises.mkdir(logDir, { recursive: true });

    const failedUpdatesLog = {
      timestamp: new Date().toISOString(),
      locale,
      updates: Object.fromEntries(failedUpdates)
    };

    const logFileName = path.join(logDir, `failed-translations-${locale}-${Date.now()}.json`);
    await fs.promises.writeFile(logFileName, JSON.stringify(failedUpdatesLog, null, 2));
    console.log(chalk.yellow(`\nSome translations failed. Failed updates have been saved to ${logFileName}`));
  } catch (error) {
    console.error(chalk.red(`Error saving failed translations log: ${error.message}`));
  }
}

async function applyUpdatesToContentful(entry, updates, processor, locale, environment) {
  let hasChanges = false;
  const failedUpdates = new Map();

  // Process each entry's updates
  for (const [entryId, fieldUpdates] of Object.entries(updates)) {
    try {
      console.log(chalk.blue(`\nUpdating entry: ${entryId}`));
      let entryHasChanges = false;

      // Get the entry from Contentful if it's not the main entry
      const targetEntry = entryId === entry.sys.id ? entry : await environment.getEntry(entryId);
      if (!targetEntry) {
        console.error(chalk.red(`Could not find entry ${entryId}`));
        continue;
      }

      // Track field updates for this entry
      const entryFailedFields = [];

      // Process each field update
      for (const [fieldName, update] of Object.entries(fieldUpdates)) {
        try {
          console.log(chalk.blue(`\nUpdating field: ${fieldName}`));

          // Initialize the field if it doesn't exist
          if (!targetEntry.fields[fieldName]) {
            console.error(chalk.red(`Field ${fieldName} not found in entry ${entryId} (content type: ${targetEntry.sys.contentType.sys.id})`));
            entryFailedFields.push({ fieldName, error: 'Field not found' });
            continue;
          }

          // Initialize the locale if it doesn't exist
          if (!targetEntry.fields[fieldName][locale]) {
            targetEntry.fields[fieldName][locale] = JSON.parse(JSON.stringify(targetEntry.fields[fieldName]['en']));
          }

          // Get field metadata if available
          const contentType = await environment.getContentType(targetEntry.sys.contentType.sys.id);
          const fieldMetadata = contentType.fields.find(f => f.id === fieldName);

          // Validate field length for Symbol and Text types
          if (fieldMetadata?.type === 'Symbol' && update.translation.length > 255) {
            console.error(chalk.red(`Translation for field ${fieldName} exceeds maximum length of 255 characters`));
            entryFailedFields.push({
              fieldName,
              error: 'Translation exceeds maximum length',
              translation: update.translation
            });
            continue;
          }

          // Update the field
          if (update.type === 'richText') {
            console.log(chalk.gray('Preserving rich text structure'));
            targetEntry.fields[fieldName][locale] = update.translation;
          } else {
            targetEntry.fields[fieldName][locale] = update.translation;
          }

          entryHasChanges = true;
          console.log(chalk.green(`✓ Updated ${fieldName}`));
        } catch (error) {
          console.error(chalk.red(`Error updating field ${fieldName} in entry ${entryId}: ${error.message}`));
          entryFailedFields.push({
            fieldName,
            error: error.message,
            translation: update.translation
          });
        }
      }

      if (entryHasChanges) {
        try {
          // Save as draft
          await targetEntry.update();
          hasChanges = true;
          console.log(chalk.green(`\nSaved changes as draft for entry ${entryId}`));
        } catch (error) {
          console.error(chalk.red(`Error saving changes for entry ${entryId}: ${error.message}`));

          // If it's a validation error, extract the details
          if (error.details?.errors) {
            for (const validationError of error.details.errors) {
              const failedField = validationError.path[1];
              entryFailedFields.push({
                fieldName: failedField,
                error: validationError.details,
                translation: fieldUpdates[failedField]?.translation
              });
            }
          }

          // Revert changes for this entry since save failed
          const freshEntry = await environment.getEntry(entryId);
          if (freshEntry) {
            console.log(chalk.yellow(`Reverting changes for entry ${entryId}`));
            Object.assign(targetEntry.fields, freshEntry.fields);
          }
        }
      }

      // Store failed updates for this entry if any
      if (entryFailedFields.length > 0) {
        failedUpdates.set(entryId, entryFailedFields);
      }

    } catch (error) {
      console.error(chalk.red(`Error processing entry ${entryId}: ${error.message}`));
      failedUpdates.set(entryId, [{ error: error.message }]);
    }
  }

  // If there were any failed updates, save them to a file if enabled
  if (failedUpdates.size > 0) {
    await saveFailedUpdates(failedUpdates, locale);
  }

  return {
    hasChanges,
    failedUpdates: failedUpdates.size > 0 ? Object.fromEntries(failedUpdates) : null
  };
}

async function processPage(page, locale, environment, progress) {
  console.log(chalk.blue(`\n=== Processing page: ${page.fields.title['en']} ===`));
  console.log(chalk.gray(`Locale: ${locale}`));
  if (progress) {
    console.log(chalk.blue(`Progress: Page ${progress.current} of ${progress.total}`));
  }

  // Get translatable fields and field processor first
  const { updates, processor } = await processEntry(page, locale, environment, translateContent, { silent: false });

  if (Object.keys(updates).length === 0) {
    console.log(chalk.yellow('\nNo fields requiring translation.'));
    return;
  }

  // Ask for confirmation
  const { proceed } = await inquirer.prompt([{
    type: 'confirm',
    name: 'proceed',
    message: 'Would you like to proceed with saving the translations as draft?',
    default: true
  }]);

  if (!proceed) {
    console.log(chalk.yellow('Translation skipped.'));
    return;
  }

  // Apply updates to Contentful
  const { hasChanges, failedUpdates } = await applyUpdatesToContentful(page, updates, processor, locale, environment);

  if (hasChanges) {
    console.log(chalk.green('\nTranslations saved as draft in Contentful'));
    console.log(chalk.yellow('Please review the translations before publishing'));
  }
}

async function main() {
  try {
    console.log(chalk.green('\n=== Starting Translation Process ==='));

    // Check if startingContentType is configured
    if (!config.startingContentType) {
      console.error(chalk.red('Error: No starting content type configured.'));
      console.error(chalk.yellow('Please set "startingContentType" in your config.json'));
      process.exit(1);
    }

    const space = await client.getSpace(SPACE_ID);
    const environment = await space.getEnvironment('master');

    const entries = await environment.getEntries({
      content_type: config.startingContentType
    });

    console.log(chalk.blue(`\nFound ${entries.items.length} ${config.startingContentType} entries`));

    // Create page selection choices
    const pageChoices = entries.items.map(entry => ({
      name: entry.fields.title?.['en'] || entry.fields.name?.['en'] || entry.sys.id,
      value: entry,
      checked: false // Default unchecked
    }));

    const { selectedPages } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selectedPages',
      message: `Select ${config.startingContentType} entries to translate (none selected will process all):`,
      choices: pageChoices
    }]);

    // If no pages selected, use all pages
    const pagesToProcess = selectedPages.length > 0 ? selectedPages : entries.items;
    console.log(chalk.blue(`\nWill process ${pagesToProcess.length} entries`));

    const { selectedLocales } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selectedLocales',
      message: 'Select target languages for translation:',
      choices: SUPPORTED_LOCALES
    }]);

    if (selectedLocales.length === 0) {
      console.log(chalk.yellow('No languages selected. Exiting...'));
      return;
    }

    let pageCounter = 0;
    const totalPages = pagesToProcess.length * selectedLocales.length;

    for (const page of pagesToProcess) {
      for (const locale of selectedLocales) {
        pageCounter++;
        await processPage(page, locale, environment, {
          current: pageCounter,
          total: totalPages
        });
      }
    }

    console.log(chalk.green('\n=== Translation Process Completed ==='));
    console.log(chalk.yellow('All changes have been saved as drafts in Contentful'));
    console.log(chalk.yellow('Please review the translations before publishing'));
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

main(); 