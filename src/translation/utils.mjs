import { ABSOLUTE_URL_REGEX, ANCHOR_LINK_REGEX, RELATIVE_PATH_REGEX, SKIP_FIELDS } from './constants.mjs';

export function isContentfulAsset(value) {
  return value?.sys?.type === 'Asset' || (value?.sys?.linkType === 'Asset' && value?.sys?.type === 'Link');
}

export function shouldSkipField(fieldName) {
  return SKIP_FIELDS.includes(fieldName);
}

export function isAbsoluteUrl(text) {
  return ABSOLUTE_URL_REGEX.test(text);
}

export function isRelativePath(text) {
  return RELATIVE_PATH_REGEX.test(text);
}

export function isAnchorLink(text) {
  return ANCHOR_LINK_REGEX.test(text);
}

export function isPossibleUrl(text) {
  return text.includes('/') && !text.includes(' ') && text.includes('-');
}

export function isRichTextField(value) {
  return value?.nodeType === 'document' && Array.isArray(value?.content);
}

export async function resolveLinkEntry(environment, link) {
  if (link?.sys?.type === 'Link' && link?.sys?.linkType === 'Entry') {
    return await environment.getEntry(link.sys.id);
  }
  return link;
}

export function truncateText(text, maxLength = 100) {
  if (!text) return '';
  if (typeof text === 'object') {
    // For rich text, try to get the first text content
    text = text.content?.[0]?.content?.[0]?.value || JSON.stringify(text);
  }
  const str = String(text);
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
} 