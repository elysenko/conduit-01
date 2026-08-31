import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigResolverService } from '../lib/config';
import { SERVICE_CATALOG, canonicalKey } from './settings.catalog';

export interface SettingFieldView {
  key: string;
  label: string;
  value: string;
  secret: boolean;
  placeholder: string;
  /** Where the effective value came from, so the UI can lock env-provisioned fields. */
  source: 'env' | 'db' | null;
}

export interface ServiceSettingView {
  service: string;
  label: string;
  description: string;
  configured: boolean;
  fields: SettingFieldView[];
}

const MASK = '•'.repeat(8);

/**
 * Masks a secret without destroying its shape.
 *
 * Connection strings keep scheme/host/port visible and lose only the password, so an
 * admin can still recognise which database they are pointed at. Everything else is
 * replaced wholesale. A stored secret never leaves the process in clear text.
 */
export function maskSecret(value: string): string {
  const url = /^([a-z][a-z0-9+.-]*:\/\/[^:/@\s]+:)([^@\s]*)(@.*)$/i.exec(value);
  return url ? `${url[1]}${MASK}${url[3]}` : MASK;
}

@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigResolverService,
  ) {}

  async list(): Promise<ServiceSettingView[]> {
    return Promise.all(
      SERVICE_CATALOG.map(async (service) => {
        const fields = await Promise.all(
          service.fields.map(async (field): Promise<SettingFieldView> => {
            const effective = await this.config.resolveConfig(field.key);
            // Ask the resolver which layer won rather than inferring it by comparing
            // values — an env and a DB row holding the *same* string would otherwise
            // be reported as DB-sourced and render as editable when it is not.
            const source: 'env' | 'db' | null =
              effective === null ? null : this.config.resolveEnv(field.key) !== null ? 'env' : 'db';

            return {
              key: field.key,
              label: field.label,
              value: effective === null ? '' : field.secret ? maskSecret(effective) : effective,
              secret: field.secret,
              placeholder: field.placeholder,
              source,
            };
          }),
        );

        return {
          service: service.service,
          label: service.label,
          description: service.description,
          configured: fields.every((field) => field.value.trim() !== ''),
          fields,
        };
      }),
    );
  }

  /**
   * Upserts a flat `{ KEY: value }` map. Unknown keys abort the whole request so a
   * partially-applied write can never leave settings in a half-updated state.
   */
  async update(patch: Record<string, unknown>): Promise<ServiceSettingView[]> {
    if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
      throw new BadRequestException('Body must be a flat object of settings key/value pairs');
    }

    const entries = Object.entries(patch);
    if (entries.length === 0) {
      throw new BadRequestException('No settings supplied');
    }

    const resolved: { key: string; value: string }[] = [];
    const unknown: string[] = [];

    for (const [rawKey, rawValue] of entries) {
      const key = canonicalKey(rawKey);
      if (!key) {
        unknown.push(rawKey);
        continue;
      }
      if (typeof rawValue !== 'string') {
        throw new BadRequestException(`Value for "${rawKey}" must be a string`);
      }
      resolved.push({ key, value: rawValue.trim() });
    }

    if (unknown.length > 0) {
      throw new BadRequestException(`Unknown settings key(s): ${unknown.join(', ')}`);
    }

    await this.prisma.$transaction(
      resolved.map(({ key, value }) =>
        this.prisma.systemSetting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        }),
      ),
    );

    return this.list();
  }
}
