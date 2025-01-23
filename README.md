# Contentful DeepL Translator

Automate content translation in Contentful using DeepL's translation API. This tool helps you manage multilingual content by automatically translating your Contentful entries while preserving rich text formatting and content structure.

## Features

-   🌐 Automated translation of Contentful entries using DeepL
-   📝 Preserves rich text formatting and structure
-   🔄 Handles nested content and references
-   ⚡ Interactive selection of content to translate
-   🛡️ Draft mode for safe content updates
-   ⚙️ Configurable field exclusions and locale settings

## Installation

```bash
# For Gatsby or any other project
npm install --save-dev contentful-translator
# or
yarn add -D contentful-translator
```

The `yarn translate` or `npm run translate` command will be automatically available after installation. Since this is a development tool for managing translations, it should be installed as a dev dependency as shown above.

## Prerequisites

You'll need:

1. A Contentful space with Management API access
2. A DeepL API key (either free or pro)
3. Node.js version 14 or higher

## Setup

1. Create a `.env.development` file in your project root:

```env
CONTENTFUL_SPACE_ID=your_space_id
CONTENTFUL_MANAGEMENT_TOKEN=your_management_token
DEEPL_API_KEY=your_deepl_api_key
```

2. Create a `translate.config.json` file in your project root:

```json
{
    "maxDepth": 5,
    "maxFields": 200,
    "startingContentType": "recipe",
    "logging": {
        "saveFailedTranslations": false,
        "failedTranslationsPath": "logs/failed-translations"
    },
    "skipFields": [
        "slug",
        "videoUrl",
        "linkTo",
        "pageType",
        "publicationLink",
        "referenceId"
    ],
    "supportedLocales": ["de", "fr", "es"],
    "urlPatterns": {
        "absoluteUrl": "^https?:\\/\\/[^\\s]+$",
        "relativePath": "^\\/[\\w-/]+$",
        "anchorLink": "^#[\\w-]+$"
    }
}
```

## Usage

The translate command is automatically available after installation. Simply run:

```bash
yarn translate
# or
npm run translate
```

The tool will:

1. Connect to your Contentful space
2. Load entries of your specified content type
3. Present an interactive menu to:
    - Select which entries to translate
    - Choose target languages
    - Preview translations
4. Save all translations as drafts in Contentful for review
5. Generate logs for any failed translations (if enabled)

## Configuration Options

| Option                           | Description                                    | Default                    | Required |
| -------------------------------- | ---------------------------------------------- | -------------------------- | -------- |
| `maxDepth`                       | Maximum depth for nested content traversal     | 5                          | No       |
| `maxFields`                      | Maximum number of fields to process            | 200                        | No       |
| `startingContentType`            | Content type ID to begin translation from      | -                          | Yes      |
| `skipFields`                     | Array of field IDs to exclude from translation | []                         | No       |
| `supportedLocales`               | Array of locale codes for translation          | ["de", "fr", "es"]         | No       |
| `logging.saveFailedTranslations` | Save failed translations to log file           | false                      | No       |
| `logging.failedTranslationsPath` | Path to save failed translation logs           | "logs/failed-translations" | No       |
| `urlPatterns`                    | RegExp patterns to identify URLs/paths         | See example                | No       |

### Supported Field Types

The translator handles:

-   Text fields
-   Rich text fields
-   Nested entries
-   Arrays of entries
-   Referenced entries (up to maxDepth)

### URL Pattern Configuration

The `urlPatterns` configuration helps identify content that shouldn't be translated:

```json
{
    "urlPatterns": {
        "absoluteUrl": "^https?:\\/\\/[^\\s]+$",
        "relativePath": "^\\/[\\w-/]+$",
        "anchorLink": "^#[\\w-]+$"
    }
}
```

## Safety Features

-   All translations are saved as drafts
-   Original content is never modified
-   Configurable field exclusions
-   Maximum depth and field limits
-   Preview before saving
-   Failed translation logging

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**

    - Ensure all required variables are in `.env.development`
    - Check variable names match exactly

2. **Permission Errors**

    - Verify your Contentful Management Token has write access
    - Check space ID is correct

3. **Translation Failures**
    - Enable logging with `saveFailedTranslations: true`
    - Check DeepL API key and quota

### Logs

When `saveFailedTranslations` is enabled, failed translations are saved to:

```
logs/failed-translations/failed-translations-{locale}-{timestamp}.json
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © [Antler Digital]

## Antler Digital

Antler Digital is a bespoke software development consultancy specialising in using technology to solve complex problems and build revenue generating products for clients. We work with startups and SMEs to provide handle the tech letting them focus on the rest of their business.

[Learn more](https://antler.digital?r=gh)
