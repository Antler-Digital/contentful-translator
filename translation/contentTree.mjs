import chalk from 'chalk';
import { MAX_DEPTH } from './constants.mjs';
import {
  isAbsoluteUrl,
  isAnchorLink,
  isPossibleUrl,
  isRelativePath,
  isRichTextField,
  resolveLinkEntry,
  shouldSkipField,
} from './utils.mjs';

function getFieldStatus(fieldName, value, fieldValue, fieldProcessor = null, entryId = null) {
  if (shouldSkipField(fieldName)) {
    return {
      isTranslatable: false,
      symbol: '✗',
      reason: 'skip list'
    };
  }

  // Check for existing translations
  const hasTranslations = fieldValue && Object.keys(fieldValue).length > 1;

  // Get additional info from field processor if available
  const translationEntry = fieldProcessor?.getTranslationEntry(entryId, fieldName);

  if (typeof value === 'string') {
    if (isAbsoluteUrl(value)) {
      return {
        isTranslatable: false,
        symbol: '✗',
        reason: 'absolute URL'
      };
    }
    if (isRelativePath(value)) {
      return {
        isTranslatable: false,
        symbol: '✗',
        reason: 'relative path'
      };
    }
    if (isAnchorLink(value)) {
      return {
        isTranslatable: false,
        symbol: '✗',
        reason: 'anchor link'
      };
    }
    if (isPossibleUrl(value)) {
      return {
        isTranslatable: false,
        symbol: '!',
        reason: 'possible URL'
      };
    }
    return {
      isTranslatable: true,
      symbol: hasTranslations ? '✓*' : '✓',
      reason: hasTranslations ? 'string (has translations)' : 'string',
      fieldInfo: translationEntry
    };
  }

  if (isRichTextField(value)) {
    return {
      isTranslatable: true,
      symbol: hasTranslations ? '✓*' : '✓',
      reason: hasTranslations ? 'rich text (has translations)' : 'rich text',
      fieldInfo: translationEntry
    };
  }

  const resolvedEntry = fieldProcessor?.getResolvedEntry(entryId);
  if (resolvedEntry) {
    return {
      isTranslatable: true,
      symbol: '→',
      reason: 'resolved entry',
      fieldInfo: translationEntry
    };
  }

  return {
    isTranslatable: false,
    symbol: ' ',
    reason: typeof value,
    fieldInfo: translationEntry
  };
}

export async function printContentTree(
  entry,
  prefix = '',
  isLast = true,
  depth = 0,
  environment,
  fieldProcessor = null,
  initialEntryId = null
) {
  if (!entry || !entry.sys) return;

  const entryId = entry.sys.id;

  // Set initial entry ID if this is the first call
  if (depth === 0) {
    initialEntryId = entryId;
  }

  // Only check depth for entries that aren't the initial entry
  if (initialEntryId !== entryId && depth >= MAX_DEPTH) {
    const connector = isLast ? '└── ' : '├── ';
    console.log(chalk.yellow(`${prefix}${connector}[MAX DEPTH] Skipping deeper traversal`));
    return;
  }

  const contentType = entry.sys.contentType?.sys.id || 'unknown';
  const title = entry.fields?.title?.['en'] || entry.fields?.name?.['en'] || entry.sys.id;

  // Print current node
  const connector = isLast ? '└── ' : '├── ';
  const fullPrefix = prefix + connector;
  console.log(chalk.blue(`${prefix}${connector}[${contentType}] ${title}`));

  // Print fields
  const newPrefix = prefix + (isLast ? '    ' : '│   ');
  const fields = entry.fields || {};

  for (const [fieldName, fieldValue] of Object.entries(fields)) {
    const value = fieldValue['en'];
    const status = getFieldStatus(fieldName, value, fieldValue, fieldProcessor, entryId);
    const fieldPrefix = `${newPrefix}${isLast ? '    ' : '│   '}├── `;
    const fieldDisplay = `${fieldName}: ${isRichTextField(value) ? 'richText' : typeof value}`;

    // Add translation status if available
    const translationInfo = status.fieldInfo ?
      ` (${Object.keys(fieldValue).filter(locale => locale !== 'en').join(', ')})` : '';

    if (status.isTranslatable) {
      console.log(chalk[status.symbol === '✓*' ? 'yellow' : 'green'](
        `${fieldPrefix}${fieldDisplay} ${status.symbol}${translationInfo}`
      ));
    } else if (status.symbol === '!') {
      console.log(chalk.yellow(`${fieldPrefix}${fieldDisplay} ${status.symbol} (${status.reason})`));
    } else {
      console.log(chalk.gray(`${fieldPrefix}${fieldDisplay} ${status.symbol} (${status.reason})`));
    }

    // Process nested arrays of entries
    if (Array.isArray(value)) {
      const arrayPrefix = newPrefix + (isLast ? '    ' : '│   ') + '    ';
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (item?.sys?.type === 'Link') {
          // Use cached entry from fieldProcessor if available
          const resolvedItem = await fieldProcessor?.resolveAndCacheEntry(environment, item);
          if (resolvedItem) {
            await printContentTree(
              resolvedItem,
              arrayPrefix,
              i === value.length - 1,
              depth + 1,
              environment,
              fieldProcessor,
              initialEntryId
            );
          }
        } else if (typeof item === 'object' && item !== null) {
          // Print nested object structure
          const nestedPrefix = arrayPrefix + (i === value.length - 1 ? '└── ' : '├── ');
          console.log(chalk.gray(`${nestedPrefix}[${i}]: object`));

          // Process nested fields recursively
          const nestedArrayPrefix = arrayPrefix + (i === value.length - 1 ? '    ' : '│   ');
          for (const [key, val] of Object.entries(item)) {
            const nestedStatus = getFieldStatus(key, val, { en: val }, fieldProcessor, entryId);
            const nestedFieldPrefix = nestedArrayPrefix + '    ├── ';
            const nestedDisplay = `${key}: ${typeof val}`;

            if (nestedStatus.isTranslatable) {
              console.log(chalk.green(`${nestedFieldPrefix}${nestedDisplay} ${nestedStatus.symbol}`));
            } else if (nestedStatus.symbol === '!') {
              console.log(chalk.yellow(`${nestedFieldPrefix}${nestedDisplay} ${nestedStatus.symbol} (${nestedStatus.reason})`));
            } else {
              console.log(chalk.gray(`${nestedFieldPrefix}${nestedDisplay} ${nestedStatus.symbol} (${nestedStatus.reason})`));
            }
          }
        }
      }
    }
  }
} 