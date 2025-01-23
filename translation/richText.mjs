import { BLOCKS, INLINES } from '@contentful/rich-text-types';
import { isRichTextField } from './utils.mjs';

export async function extractRichTextContent(node, path = '') {
  const textContent = {};

  if (!node) return textContent;

  // Handle text nodes
  if (node.nodeType === 'text' && node.value) {
    textContent[path] = node.value;
    return textContent;
  }

  // Handle embedded entries (references)
  if (node.nodeType === BLOCKS.EMBEDDED_ENTRY || node.nodeType === INLINES.EMBEDDED_ENTRY) {
    return textContent;
  }

  // Recursively process child nodes
  if (Array.isArray(node.content)) {
    for (let i = 0; i < node.content.length; i++) {
      const childPath = path ? `${path}.content[${i}]` : `content[${i}]`;
      const childContent = await extractRichTextContent(node.content[i], childPath);
      Object.assign(textContent, childContent);
    }
  }

  return textContent;
}

export async function reconstructRichText(originalNode, translations, basePath = '') {
  const node = JSON.parse(JSON.stringify(originalNode));

  if (!node) return node;

  if (node.nodeType === 'text' && node.value) {
    const translationKey = basePath || 'content[0]';
    if (translations[translationKey]) {
      node.value = translations[translationKey];
    }
    return node;
  }

  if (node.nodeType === BLOCKS.EMBEDDED_ENTRY || node.nodeType === INLINES.EMBEDDED_ENTRY) {
    return node;
  }

  if (Array.isArray(node.content)) {
    for (let i = 0; i < node.content.length; i++) {
      const childPath = basePath ? `${basePath}.content[${i}]` : `content[${i}]`;
      node.content[i] = await reconstructRichText(node.content[i], translations, childPath);
    }
  }

  return node;
}

export async function translateAndReconstruct(field, targetLang, translateFn) {
  if (typeof field === 'string') {
    return await translateFn(field, targetLang);
  }

  if (isRichTextField(field)) {
    const textContent = await extractRichTextContent(field);
    const translations = {};

    for (const [path, text] of Object.entries(textContent)) {
      translations[path] = await translateFn(text, targetLang);
    }

    return await reconstructRichText(field, translations);
  }

  return null;
} 