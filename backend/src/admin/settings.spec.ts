import { maskSecret } from './settings.service';
import { ALL_KEYS, canonicalKey } from './settings.catalog';

describe('maskSecret', () => {
  it('hides the password in a connection URL but keeps host and database legible', () => {
    const masked = maskSecret('postgresql://postgres:hunter2@db.internal:5432/app');
    expect(masked).not.toContain('hunter2');
    expect(masked).toContain('db.internal:5432/app');
    expect(masked).toBe('postgresql://postgres:••••••••@db.internal:5432/app');
  });

  it('replaces a plain secret wholesale', () => {
    expect(maskSecret('S3XD7-1PXAXXOEF8cCFaM5fj')).toBe('••••••••');
  });

  it('never echoes the input for any shape', () => {
    for (const secret of ['a', 'redis://user:pw@h:6379', 'plain-token']) {
      expect(maskSecret(secret)).not.toBe(secret);
    }
  });
});

describe('canonicalKey', () => {
  it('accepts the canonical SCREAMING_SNAKE key', () => {
    expect(canonicalKey('MINIO_ACCESS_KEY')).toBe('MINIO_ACCESS_KEY');
  });

  it('normalises case and separators so client key styles interoperate', () => {
    expect(canonicalKey('minio_access_key')).toBe('MINIO_ACCESS_KEY');
    expect(canonicalKey('minio-access-key')).toBe('MINIO_ACCESS_KEY');
    expect(canonicalKey('  Minio_Access_Key  ')).toBe('MINIO_ACCESS_KEY');
  });

  it('rejects anything outside the catalog, so PATCH cannot write a dead row', () => {
    expect(canonicalKey('NOT_A_KEY')).toBeNull();
    expect(canonicalKey('JWT_SECRET')).toBeNull();
    expect(canonicalKey('')).toBeNull();
  });

  it('round-trips every catalog key', () => {
    for (const key of ALL_KEYS) {
      expect(canonicalKey(key)).toBe(key);
    }
  });
});
