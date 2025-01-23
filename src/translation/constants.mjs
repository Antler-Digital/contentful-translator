import config from '../../translate.config.json' assert { type: 'json' };

// Default values from config.json
const DEFAULT_CONFIG = {
  maxDepth: 5,
  maxFields: 100,
  skipFields: ["slug", "videoUrl", "linkTo", "pageType", "publicationLink"],
  supportedLocales: ["de", "fr", "es", "nl"],
  urlPatterns: {
    absoluteUrl: "^https?:\\/\\/[^\\s]+$",
    relativePath: "^\\/[\\w-/]+$",
    anchorLink: "^#[\\w-]+$"
  }
};

export const SUPPORTED_LOCALES = config.supportedLocales || DEFAULT_CONFIG.supportedLocales;
export const SKIP_FIELDS = config.skipFields || DEFAULT_CONFIG.skipFields;
export const MAX_DEPTH = config.maxDepth || DEFAULT_CONFIG.maxDepth;
export const MAX_FIELDS = config.maxFields || DEFAULT_CONFIG.maxFields;

// URL detection patterns
export const ABSOLUTE_URL_REGEX = new RegExp(config.urlPatterns?.absoluteUrl || DEFAULT_CONFIG.urlPatterns.absoluteUrl);
export const RELATIVE_PATH_REGEX = new RegExp(config.urlPatterns?.relativePath || DEFAULT_CONFIG.urlPatterns.relativePath);
export const ANCHOR_LINK_REGEX = new RegExp(config.urlPatterns?.anchorLink || DEFAULT_CONFIG.urlPatterns.anchorLink);