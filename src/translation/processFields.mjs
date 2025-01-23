import chalk from 'chalk';
import { extractRichTextContent } from './richText.mjs';
import {
  isAbsoluteUrl,
  isAnchorLink,
  isContentfulAsset,
  isPossibleUrl,
  isRelativePath,
  isRichTextField,
  resolveLinkEntry,
  shouldSkipField,
} from './utils.mjs';

export async function getTranslatableFields(entry, parentPath = '', environment, options = { silent: false }) {
  const fields = entry.fields;
  const translatableFields = {};
  const resolvedSections = {};

  if (!options.silent) {
    console.log(chalk.blue(`\nAnalyzing fields for ${entry.sys.contentType?.sys.id || 'unknown'}:`));
  }

  for (const [fieldName, fieldValue] of Object.entries(fields)) {
    const fullPath = parentPath ? `${parentPath}.${fieldName}` : fieldName;
    const value = fieldValue['en'];

    // Check if this field should be skipped
    if (shouldSkipField(fieldName)) {
      if (!options.silent) {
        console.log(chalk.yellow(`  ✗ ${fullPath} is in skip list (not translatable)`));
      }
      continue;
    }

    if (typeof value === 'string') {
      // URL analysis
      if (isAbsoluteUrl(value)) {
        if (!options.silent) {
          console.log(chalk.yellow(`  ✗ ${fullPath} is an absolute URL (not translatable)`));
        }
        continue;
      }
      if (isRelativePath(value)) {
        if (!options.silent) {
          console.log(chalk.yellow(`  ✗ ${fullPath} is a relative path (not translatable)`));
        }
        continue;
      }
      if (isAnchorLink(value)) {
        if (!options.silent) {
          console.log(chalk.yellow(`  ✗ ${fullPath} is an anchor link (not translatable)`));
        }
        continue;
      }
      if (isPossibleUrl(value)) {
        if (!options.silent) {
          console.log(chalk.yellow(`  ! ${fullPath} might be a URL/path (${value})`));
          console.log(chalk.yellow(`    Consider adding this field to SKIP_FIELDS if it should not be translated`));
        }
      }

      translatableFields[fullPath] = {
        value,
        field: fieldValue
      };
      if (!options.silent) {
        console.log(chalk.green(`  ✓ ${fullPath} is translatable`));
      }
    } else if (isRichTextField(value)) {
      if (!options.silent) {
        console.log(chalk.blue(`  → Processing rich text in ${fullPath}`));
      }
      const richTextContent = await extractRichTextContent(value);
      for (const [textPath, text] of Object.entries(richTextContent)) {
        const fullTextPath = `${fullPath}.${textPath}`;
        translatableFields[fullTextPath] = {
          value: text,
          field: fieldValue,
          richTextParent: value
        };
        if (!options.silent) {
          console.log(chalk.green(`    ✓ ${fullTextPath} is translatable (rich text)`));
        }
      }
    } else if (Array.isArray(value)) {
      if (!options.silent) {
        console.log(chalk.blue(`  → Processing array field in ${fullPath}`));
      }
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (item?.sys?.type === 'Link' && item?.sys?.linkType === 'Entry') {
          const resolvedItem = await resolveLinkEntry(environment, item);
          if (resolvedItem) {
            const itemPath = `${fullPath}[${i}]`;
            resolvedSections[itemPath] = resolvedItem;
            const { translatableFields: nestedFields, resolvedSections: nestedResolved } =
              await getTranslatableFields(resolvedItem, itemPath, environment, options);
            Object.assign(translatableFields, nestedFields);
            Object.assign(resolvedSections, nestedResolved);
          }
        } else if (typeof item === 'object' && item !== null) {
          const itemPath = `${fullPath}[${i}]`;
          if (item.sys?.contentType) {
            const { translatableFields: nestedFields, resolvedSections: nestedResolved } =
              await getTranslatableFields(item, itemPath, environment, options);
            Object.assign(translatableFields, nestedFields);
            Object.assign(resolvedSections, nestedResolved);
          } else {
            for (const [key, val] of Object.entries(item)) {
              if (typeof val === 'string') {
                translatableFields[`${itemPath}.${key}`] = {
                  value: val,
                  field: { [key]: { en: val } }
                };
                if (!options.silent) {
                  console.log(chalk.green(`  ✓ ${itemPath}.${key} is translatable`));
                }
              }
            }
          }
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      if (isContentfulAsset(value)) {
        if (!options.silent) {
          console.log(chalk.yellow(`  ✗ ${fullPath} is an asset reference (not translatable)`));
        }
        continue;
      }

      if (value.sys?.type === 'Link' && value.sys?.linkType === 'Entry') {
        if (!options.silent) {
          console.log(chalk.blue(`  → Processing linked entry in ${fullPath}`));
        }
        const resolvedItem = await resolveLinkEntry(environment, value);
        if (resolvedItem) {
          resolvedSections[fullPath] = resolvedItem;
          const { translatableFields: nestedFields, resolvedSections: nestedResolved } =
            await getTranslatableFields(resolvedItem, fullPath, environment, options);
          Object.assign(translatableFields, nestedFields);
          Object.assign(resolvedSections, nestedResolved);
        }
      } else if (value.sys?.contentType) {
        const { translatableFields: nestedFields, resolvedSections: nestedResolved } =
          await getTranslatableFields(value, fullPath, environment, options);
        Object.assign(translatableFields, nestedFields);
        Object.assign(resolvedSections, nestedResolved);
      } else {
        for (const [key, val] of Object.entries(value)) {
          if (typeof val === 'string') {
            translatableFields[`${fullPath}.${key}`] = {
              value: val,
              field: { [key]: { en: val } }
            };
            if (!options.silent) {
              console.log(chalk.green(`  ✓ ${fullPath}.${key} is translatable`));
            }
          }
        }
      }
    } else {
      if (!options.silent) {
        console.log(chalk.yellow(`  ✗ ${fullPath} is not translatable (${typeof value})`));
      }
    }
  }

  return { translatableFields, resolvedSections };
} 