import { toSlug, withCollisionSuffix } from './slug.util';

describe('toSlug', () => {
  it('lowercases and hyphenates a normal title', () => {
    expect(toSlug('How to train your dragon')).toBe('how-to-train-your-dragon');
  });

  it('strips punctuation rather than encoding it', () => {
    expect(toSlug('Why your tests are slow (and what to do)')).toBe(
      'why-your-tests-are-slow-and-what-to-do',
    );
  });

  it('never returns an empty slug, even for an all-punctuation title', () => {
    // An empty slug would collide with every other empty slug and 500 on the
    // second such article.
    expect(toSlug('!!!')).toBe('article');
    expect(toSlug('')).toBe('article');
  });

  it('bounds slug length so it cannot overflow an index', () => {
    expect(toSlug('a'.repeat(500)).length).toBeLessThanOrEqual(180);
  });
});

describe('withCollisionSuffix', () => {
  it('appends a 6-character suffix to the base', () => {
    const suffixed = withCollisionSuffix('duplicate-title');
    expect(suffixed).toMatch(/^duplicate-title-[a-z0-9]{6}$/);
  });

  it('produces distinct slugs across calls', () => {
    const generated = new Set(
      Array.from({ length: 50 }, () => withCollisionSuffix('duplicate-title')),
    );
    expect(generated.size).toBeGreaterThan(45);
  });
});
