import chalk from 'chalk';
import inquirer from 'inquirer';
import { MAX_DEPTH, MAX_FIELDS } from './constants.mjs';
import { printContentTree } from './contentTree.mjs';
import { getTranslatableFields } from './processFields.mjs';
import { translateAndReconstruct } from './richText.mjs';
import { isContentfulAsset, isRichTextField, resolveLinkEntry, shouldSkipField, truncateText } from './utils.mjs';

// Represents a single piece of content that needs translation
class TranslationEntry {
  constructor(entryId, fieldName, value, locale, options = {}) {
    this.entryId = entryId;
    this.fieldName = fieldName;
    this.value = value;
    this.locale = locale;
    this.isRichText = options.isRichText || false;
    this.richTextParent = options.richTextParent || null;
    this.originalStructure = options.originalStructure || null;
    this.translation = null;
    this.hasExistingTranslation = false;
  }

  isTranslatableContent() {
    // Skip if it's a link to an asset
    if (isContentfulAsset(this.value)) {
      return false;
    }

    // Skip if it's an array of non-string values
    if (Array.isArray(this.value)) {
      return false;
    }

    // Skip if it's an object that's not rich text
    if (typeof this.value === 'object' && !this.isRichText) {
      return false;
    }

    // Allow rich text fields
    if (this.isRichText && isRichTextField(this.value)) {
      return true;
    }

    // Allow string values
    if (typeof this.value === 'string' && this.value.trim().length > 0) {
      return true;
    }

    return false;
  }

  shouldTranslate() {
    return !this.hasExistingTranslation &&
      !shouldSkipField(this.fieldName) &&
      this.isTranslatableContent();
  }

  async translate(translateFn) {
    if (!this.shouldTranslate()) return false;

    try {
      if (this.isRichText) {
        this.translation = await translateAndReconstruct(
          this.value,
          this.locale,
          translateFn
        );
      } else if (typeof this.value === 'string') {
        this.translation = await translateFn(this.value, this.locale);
      } else {
        return false;
      }
      return true;
    } catch (error) {
      console.error(chalk.red(`Error translating field ${this.fieldName} in entry ${this.entryId}: ${error.message}`));
      return false;
    }
  }
}

// Enhanced field processor that stores content by ID
class FieldProcessor {
  constructor() {
    this.translationEntries = new Map(); // Map<entryId, Map<fieldName, TranslationEntry>>
    this.resolvedEntries = new Map(); // Map<entryId, Entry>
    this.totalFieldsProcessed = 0;
    this.visitedEntries = new Set(); // Track visited entries for circular reference detection
  }

  async resolveAndCacheEntry(environment, link) {
    if (!link?.sys?.id) return null;

    const entryId = link.sys.id;

    // Return cached entry if available
    if (this.resolvedEntries.has(entryId)) {
      return this.resolvedEntries.get(entryId);
    }

    // Resolve and cache new entry
    try {
      const resolvedEntry = await resolveLinkEntry(environment, link);
      if (resolvedEntry) {
        this.resolvedEntries.set(entryId, resolvedEntry);
      }
      return resolvedEntry;
    } catch (error) {
      console.error(chalk.red(`Error resolving entry ${entryId}: ${error.message}`));
      return null;
    }
  }

  hasVisitedEntry(entryId) {
    return this.visitedEntries.has(entryId);
  }

  addVisitedEntry(entryId) {
    this.visitedEntries.add(entryId);
  }

  removeVisitedEntry(entryId) {
    this.visitedEntries.delete(entryId);
  }

  addTranslationEntry(entry, fieldName, fieldInfo, locale) {
    const entryId = entry.sys.id;

    // Check max fields limit
    if (this.totalFieldsProcessed >= MAX_FIELDS) {
      if (this.totalFieldsProcessed === MAX_FIELDS) {
        console.log(chalk.yellow(`\nMax fields limit (${MAX_FIELDS}) reached - skipping further fields`));
      }
      return false;
    }

    // Create translation entry
    const translationEntry = new TranslationEntry(
      entryId,
      fieldName,
      fieldInfo.value,
      locale,
      {
        isRichText: fieldInfo.isRichText,
        richTextParent: fieldInfo.richTextParent,
        originalStructure: fieldInfo.originalStructure
      }
    );

    // Check for existing translations
    if (fieldInfo.field && Object.keys(fieldInfo.field).length > 1) {
      translationEntry.hasExistingTranslation = true;
    }

    // Store by entry ID and field name
    if (!this.translationEntries.has(entryId)) {
      this.translationEntries.set(entryId, new Map());
    }
    this.translationEntries.get(entryId).set(fieldName, translationEntry);

    // Store the resolved entry
    this.resolvedEntries.set(entryId, entry);

    // Update count
    this.totalFieldsProcessed++;

    return true;
  }

  getTranslationEntry(entryId, fieldName) {
    return this.translationEntries.get(entryId)?.get(fieldName);
  }

  getResolvedEntry(entryId) {
    return this.resolvedEntries.get(entryId);
  }

  getAllTranslationEntries() {
    const entries = [];
    for (const [entryId, fieldMap] of this.translationEntries) {
      for (const [fieldName, entry] of fieldMap) {
        entries.push(entry);
      }
    }
    return entries;
  }

  getTranslatableEntries() {
    return this.getAllTranslationEntries().filter(entry => entry.shouldTranslate());
  }
}

async function collectFieldInformation(entry, environment, processor, locale, options, depth = 0, initialEntryId = null) {
  if (!entry || !entry.sys || !entry.fields) {
    return;
  }

  const entryId = entry.sys.id;

  // Set initial entry ID if this is the first call
  if (depth === 0) {
    initialEntryId = entryId;
  }

  // Check for circular references
  if (processor.hasVisitedEntry(entryId)) {
    console.log(chalk.yellow(`Circular reference detected for entry ${entryId} - skipping`));
    return;
  }

  // Only check depth for entries that aren't the initial entry
  if (initialEntryId !== entryId && depth >= MAX_DEPTH) {
    console.log(chalk.yellow(`Max depth (${MAX_DEPTH}) reached for entry ${entryId} - skipping deeper traversal`));
    return;
  }

  processor.addVisitedEntry(entryId);
  const fields = entry.fields;

  // Store direct fields for this entry
  for (const [fieldName, fieldValue] of Object.entries(fields)) {
    const value = fieldValue['en'];
    if (!options.silent) {
      console.log(chalk.gray(`Collecting field information for ${fieldName} in entry ${entry.sys.id}: ${value}`));
    }

    // Store field information and check if we should continue
    const shouldContinue = processor.addTranslationEntry(entry, fieldName, {
      value,
      field: fieldValue,
      isArray: Array.isArray(value),
      isRichText: typeof value === 'object' && value?.nodeType === 'document',
      isLink: value?.sys?.type === 'Link',
      originalStructure: value,
      silent: options.silent
    }, locale);

    if (!shouldContinue) {
      return; // Stop processing if we've hit the max fields limit
    }

    // Process nested content
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item?.sys?.type === 'Link' && item?.sys?.linkType === 'Entry') {
          const resolvedItem = await processor.resolveAndCacheEntry(environment, item);
          if (resolvedItem) {
            await collectFieldInformation(
              resolvedItem,
              environment,
              processor,
              locale,
              options,
              depth + 1,
              initialEntryId
            );
          }
        } else if (typeof item === 'object' && item !== null && item.sys?.contentType) {
          await collectFieldInformation(
            item,
            environment,
            processor,
            locale,
            options,
            depth + 1,
            initialEntryId
          );
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      if (value.sys?.type === 'Link' && value.sys?.linkType === 'Entry') {
        const resolvedItem = await processor.resolveAndCacheEntry(environment, value);
        if (resolvedItem) {
          await collectFieldInformation(
            resolvedItem,
            environment,
            processor,
            locale,
            options,
            depth + 1,
            initialEntryId
          );
        }
      } else if (value.sys?.contentType) {
        await collectFieldInformation(
          value,
          environment,
          processor,
          locale,
          options,
          depth + 1,
          initialEntryId
        );
      }
    }
  }

  processor.removeVisitedEntry(entryId);
}

export async function processEntry(entry, locale, environment, translateFn, options = { silent: false }) {
  try {
    if (!options.silent) {
      console.log(chalk.blue('\nAnalyzing entry:'));
      console.log(chalk.gray(`Content Type: ${entry.sys.contentType?.sys.id}`));
      console.log(chalk.gray(`Entry ID: ${entry.sys.id}`));
      console.log(chalk.gray(`Title: ${entry.fields?.title?.['en'] || 'No title'}`));
      console.log(chalk.gray(`Slug: ${entry.fields?.slug?.['en'] || 'No slug'}`));
    }

    // Initialize field processor
    const processor = new FieldProcessor();

    // First pass: collect all field information
    await collectFieldInformation(entry, environment, processor, locale, options);

    // Print content tree using collected information
    if (!options.silent) {
      console.log(chalk.cyan('\nContent Structure:'));
      await printContentTree(entry, '', true, 0, environment, processor);
    }

    // Get all entries that need translation
    const translatableEntries = processor.getTranslatableEntries();

    if (translatableEntries.length === 0) {
      console.log(chalk.yellow('\nNo fields requiring translation.'));
      return { updates: {}, processor };
    }

    // Create choices for selection
    const choices = translatableEntries.map(entry => ({
      name: `${entry.fieldName} (${entry.entryId})\n  ${chalk.gray(truncateText(entry.value))}`,
      value: entry,
      checked: true // Default to selected
    }));

    console.log(chalk.cyan('\nSummary of fields to translate:'));
    const { selectedEntries } = await inquirer.prompt([
      {
        type: 'checkbox',
        message: 'Select fields to translate (all selected by default):',
        name: 'selectedEntries',
        choices,
        pageSize: 20,
        loop: false
      }
    ]);

    // If no entries selected at all, return without processing
    if (selectedEntries.length === 0) {
      console.log(chalk.yellow('\nNo fields selected for translation. Skipping...'));
      return { updates: {}, processor };
    }

    // Process translations
    const updates = {};
    console.log(chalk.cyan('\nProcessing translations...'));

    for (const translationEntry of selectedEntries) {
      try {
        const success = await translationEntry.translate(translateFn);
        if (success && translationEntry.translation) {
          updates[translationEntry.entryId] = updates[translationEntry.entryId] || {};
          updates[translationEntry.entryId][translationEntry.fieldName] = {
            translation: translationEntry.translation,
            type: translationEntry.isRichText ? 'richText' : 'text',
            originalText: translationEntry.value,
            richTextParent: translationEntry.richTextParent
          };
          console.log(chalk.green(`✓ Translated ${translationEntry.fieldName} (${translationEntry.entryId})`));
        }
      } catch (error) {
        if (!options.silent) {
          console.log(chalk.red(`Error processing field ${translationEntry.fieldName} in entry ${translationEntry.entryId}: ${error.message}`));
        }
        continue;
      }
    }

    return {
      updates,
      processor
    };
  } catch (error) {
    throw error;
  }
} 