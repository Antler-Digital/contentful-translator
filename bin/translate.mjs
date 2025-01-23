#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if translate.config.json exists in the user's project root
const userConfigPath = resolve(process.cwd(), 'translate.config.json');

if (!fs.existsSync(userConfigPath)) {
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
    "supportedLocales": ["de", "fr", "es"],
    "urlPatterns": {
        "absoluteUrl": "^https?:\\/\\/[^\\s]+$",
        "relativePath": "^\\/[\\w-/]+$",
        "anchorLink": "^#[\\w-]+$"
    }
}`));
  process.exit(1);
}

// Import and run the main script
import('../src/translate-content.mjs').catch(error => {
  console.error(chalk.red('Error running translator:'), error);
  process.exit(1);
}); 