import { BLOCKS, INLINES } from '@contentful/rich-text-types';
import chalk from 'chalk';
import * as deepl from 'deepl-node';
import dotenv from 'dotenv';
import { extractRichTextContent, reconstructRichText, translateAndReconstruct } from './richText.mjs';

// Load environment variables
dotenv.config({ path: '.env.development' });

const DEEPL_API_KEY = process.env.DEEPL_API_KEY;

if (!DEEPL_API_KEY) {
  console.error(chalk.red('Missing DEEPL_API_KEY environment variable'));
  process.exit(1);
}

// Initialize DeepL translator
const translator = new deepl.Translator(DEEPL_API_KEY);

// Mock rich text structure with various node types and edge cases
const mockRichText = {
  nodeType: BLOCKS.DOCUMENT,
  content: [
    {
      nodeType: BLOCKS.PARAGRAPH,
      content: [
        {
          nodeType: 'text',
          value: 'Welcome to our cocoa manufacturing facility. ',
          marks: []
        },
        {
          nodeType: 'text',
          value: 'Quality control',
          marks: [{ type: 'bold' }]
        },
        {
          nodeType: 'text',
          value: ' is our top priority in ',
          marks: []
        },
        {
          nodeType: INLINES.HYPERLINK,
          data: { uri: 'https://example.com/process' },
          content: [
            {
              nodeType: 'text',
              value: 'cocoa processing',
              marks: []
            }
          ]
        },
        {
          nodeType: 'text',
          value: '.',
          marks: []
        }
      ]
    },
    {
      nodeType: BLOCKS.EMBEDDED_ENTRY,
      data: {
        target: {
          sys: {
            id: 'some-entry-id',
            type: 'Link',
            linkType: 'Entry'
          }
        }
      }
    },
    {
      nodeType: BLOCKS.HEADING_1,
      content: [
        {
          nodeType: 'text',
          value: 'Sustainable Cocoa Production',
          marks: []
        }
      ]
    },
    {
      nodeType: BLOCKS.UL_LIST,
      content: [
        {
          nodeType: BLOCKS.LIST_ITEM,
          content: [
            {
              nodeType: BLOCKS.PARAGRAPH,
              content: [
                {
                  nodeType: 'text',
                  value: 'Ethically sourced beans',
                  marks: []
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};

// Real translation function using DeepL
async function translateWithDeepl(text, targetLang) {
  try {
    if (!text || text.length < 3) return text;

    const result = await translator.translateText(text, 'en', targetLang);
    return result.text;
  } catch (error) {
    console.error(chalk.red(`Translation error: ${error.message}`));
    return null;
  }
}

async function testRichTextTranslation() {
  console.log(chalk.blue('\n=== Rich Text Translation Test (Using DeepL) ===\n'));

  // Test available languages
  console.log(chalk.cyan('Available target languages:'));
  const targetLanguages = await translator.getTargetLanguages();
  console.log(chalk.gray(targetLanguages.map(lang => `${lang.code} (${lang.name})`).join(', ')));

  // Step 1: Extract text content
  console.log(chalk.cyan('\nStep 1: Extracting text content'));
  const textContent = await extractRichTextContent(mockRichText);
  console.log('Extracted text nodes:');
  Object.entries(textContent).forEach(([path, text]) => {
    console.log(chalk.gray(`  ${path}: "${text}"`));
  });

  // Step 2: Translate text content to Dutch
  console.log(chalk.cyan('\nStep 2: Translating text content to Dutch (nl)'));
  const translations = {};
  for (const [path, text] of Object.entries(textContent)) {
    translations[path] = await translateWithDeepl(text, 'nl');
    if (translations[path]) {
      console.log(chalk.gray(`  ${path}:`));
      console.log(chalk.gray(`    EN: "${text}"`));
      console.log(chalk.gray(`    NL: "${translations[path]}"`));
    }
  }

  // Step 3: Reconstruct rich text
  console.log(chalk.cyan('\nStep 3: Reconstructing rich text with translations'));
  const translatedRichText = await reconstructRichText(mockRichText, translations);

  // Step 4: Verify structure preservation
  console.log(chalk.cyan('\nStep 4: Structure verification'));

  function verifyStructure(original, translated, path = '') {
    const originalType = original.nodeType;
    const translatedType = translated.nodeType;

    if (originalType !== translatedType) {
      console.log(chalk.red(`❌ Node type mismatch at ${path}: ${originalType} → ${translatedType}`));
      return false;
    }

    if (original.marks) {
      const originalMarks = JSON.stringify(original.marks);
      const translatedMarks = JSON.stringify(translated.marks);
      if (originalMarks !== translatedMarks) {
        console.log(chalk.red(`❌ Marks mismatch at ${path}`));
        return false;
      }
    }

    if (original.data) {
      const originalData = JSON.stringify(original.data);
      const translatedData = JSON.stringify(translated.data);
      if (originalData !== translatedData) {
        console.log(chalk.red(`❌ Data mismatch at ${path}`));
        return false;
      }
    }

    if (Array.isArray(original.content) && Array.isArray(translated.content)) {
      if (original.content.length !== translated.content.length) {
        console.log(chalk.red(`❌ Content length mismatch at ${path}`));
        return false;
      }

      for (let i = 0; i < original.content.length; i++) {
        const childPath = `${path}${path ? '.' : ''}content[${i}]`;
        if (!verifyStructure(original.content[i], translated.content[i], childPath)) {
          return false;
        }
      }
    }

    return true;
  }

  const structurePreserved = verifyStructure(mockRichText, translatedRichText);

  if (structurePreserved) {
    console.log(chalk.green('✓ Structure fully preserved'));
    console.log(chalk.gray('  - Node types maintained'));
    console.log(chalk.gray('  - Marks preserved'));
    console.log(chalk.gray('  - Links and data preserved'));
    console.log(chalk.gray('  - Content hierarchy maintained'));
  }

  // Step 5: Show complete translation result
  console.log(chalk.cyan('\nStep 5: Translation result'));
  console.log(chalk.yellow('Original:'));
  console.log(JSON.stringify(mockRichText, null, 2));
  console.log(chalk.yellow('\nTranslated:'));
  console.log(JSON.stringify(translatedRichText, null, 2));
}

// Add this test after the existing rich text test
async function testNestedContentTranslation() {
  console.log(chalk.blue('\n=== Nested Content Translation Test ===\n'));

  const mockNestedContent = {
    fields: {
      title: {
        en: 'Parent Section'
      },
      sections: {
        en: [
          {
            sys: {
              contentType: {
                sys: {
                  id: 'section'
                }
              }
            },
            fields: {
              title: {
                en: 'Nested Section Title'
              },
              content: {
                en: {
                  nodeType: BLOCKS.DOCUMENT,
                  content: [
                    {
                      nodeType: BLOCKS.PARAGRAPH,
                      content: [
                        {
                          nodeType: 'text',
                          value: 'This is nested rich text content',
                          marks: []
                        }
                      ]
                    }
                  ]
                }
              }
            }
          }
        ]
      }
    }
  };

  // Step 1: Extract content
  console.log(chalk.cyan('Step 1: Extracting nested content'));
  const { translatableFields, resolvedSections } = await getTranslatableFields(mockNestedContent, '', null, { silent: false });

  // Step 2: Translate content
  console.log(chalk.cyan('\nStep 2: Translating nested content'));
  const translations = {};
  for (const [path, fieldData] of Object.entries(translatableFields)) {
    const translation = await translateWithDeepl(fieldData.value, 'nl');
    if (translation) {
      translations[path] = {
        fieldName: path.split('.').pop(),
        translation,
        type: fieldData.richTextParent ? 'richText' : 'text',
        path: path.split('.'),
        originalText: fieldData.value,
        richTextParent: fieldData.richTextParent
      };
    }
  }

  console.log('\nTranslations:');
  for (const [path, translation] of Object.entries(translations)) {
    console.log(chalk.gray(`${path}:`));
    console.log(chalk.gray(`  Original: ${translation.originalText}`));
    console.log(chalk.gray(`  Translated: ${translation.translation}`));
  }
}

// Run both tests
async function runTests() {
  await testRichTextTranslation();
  await testNestedContentTranslation();
}

runTests().catch(console.error);