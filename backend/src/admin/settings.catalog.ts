import { PLACEHOLDER } from '../lib/config';

export interface SettingFieldDef {
  key: string;
  label: string;
  secret: boolean;
  placeholder: string;
}

export interface ServiceDef {
  service: string;
  label: string;
  description: string;
  fields: SettingFieldDef[];
}

/**
 * The allow-list of writable settings keys, grouped for the admin UI.
 *
 * Anything not listed here is rejected by PATCH with a 400 rather than silently
 * written, so a typo cannot create a dead `SystemSetting` row that shadows nothing.
 */
export const SERVICE_CATALOG: readonly ServiceDef[] = [
  {
    service: 'postgresql',
    label: 'PostgreSQL',
    description: 'Primary datastore for users, articles, comments, tags and follows.',
    fields: [
      {
        key: 'DATABASE_URL',
        label: 'Connection string',
        secret: true,
        placeholder: 'postgresql://user:password@host:5432/db',
      },
    ],
  },
  {
    service: 'minio',
    label: 'MinIO object storage',
    description:
      'Holds uploaded avatars and article cover images. Reads fall back to plain URLs until configured.',
    fields: [
      {
        key: 'MINIO_ENDPOINT',
        label: 'Endpoint',
        secret: false,
        placeholder: 'https://minio.internal:9000',
      },
      { key: 'MINIO_ACCESS_KEY', label: 'Access key', secret: true, placeholder: PLACEHOLDER },
      { key: 'MINIO_SECRET_KEY', label: 'Secret key', secret: true, placeholder: PLACEHOLDER },
      { key: 'MINIO_BUCKET', label: 'Bucket', secret: false, placeholder: 'conduit-media' },
    ],
  },
];

/**
 * Canonical key lookup, case- and separator-insensitive, so `minio_access_key`,
 * `MINIO-ACCESS-KEY` and `MINIO_ACCESS_KEY` all resolve to the same setting.
 */
const CANONICAL = new Map<string, string>(
  SERVICE_CATALOG.flatMap((service) =>
    service.fields.map((field) => [normalise(field.key), field.key] as const),
  ),
);

function normalise(key: string): string {
  return key.trim().toLowerCase().replace(/[-\s]/g, '_');
}

export function canonicalKey(key: string): string | null {
  return CANONICAL.get(normalise(key)) ?? null;
}

export const ALL_KEYS: readonly string[] = SERVICE_CATALOG.flatMap((service) =>
  service.fields.map((field) => field.key),
);
