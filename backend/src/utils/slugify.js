/**
 * Normalize and generate URL-safe slugs.
 * Converts text to lowercase, strips accents and special characters,
 * collapses spaces and hyphens into single dashes, and trims edges.
 *
 * @param {string} text - Input text to slugify.
 * @returns {string} Normalized slug.
 */
export const slugify = (text) => {
  if (!text || typeof text !== 'string') return '';

  return text
    .toString()
    .normalize('NFD') // Normalize accented characters
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/&/g, '-and-') // Replace & with 'and'
    .replace(/[^a-z0-9 -]/g, '') // Remove non-alphanumeric characters
    .replace(/\s+/g, '-') // Replace spaces with hyphen
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Trim leading and trailing hyphens
};

export default slugify;
