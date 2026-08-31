import slugify from 'slugify';

/** Base slug for a title. Never empty — an all-punctuation title falls back to `article`. */
export function toSlug(title: string): string {
  const base = slugify(title ?? '', { lower: true, strict: true, trim: true });
  return base.length > 0 ? base.slice(0, 180) : 'article';
}

/**
 * Collision suffix: 6 chars of base36. Appended only after a unique-constraint
 * violation, so the common case keeps the clean, readable slug.
 */
export function withCollisionSuffix(base: string): string {
  const suffix = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
  return `${base}-${suffix}`;
}
