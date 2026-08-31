import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Sentinel written by the scaffold into `.env.example` for un-provisioned keys. */
export const PLACEHOLDER = 'PLACEHOLDER_CONFIGURE_IN_SETTINGS';

/**
 * Thrown when a feature needs a credential that is set neither in the
 * environment nor in the `SystemSetting` table. Surfaces as 503 so a missing
 * third-party key degrades one feature instead of crash-looping the pod.
 */
export class ServiceUnconfiguredError extends HttpException {
  constructor(public readonly key: string) {
    super(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
        message: `${key} is not configured. Set it in Admin -> Service settings.`,
        key,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/**
 * Alternate environment variable names for a canonical settings key.
 *
 * The platform provisions MinIO as MINIO_ROOT_USER / MINIO_ROOT_PASSWORD, while
 * the settings UI speaks the S3-style MINIO_ACCESS_KEY / MINIO_SECRET_KEY. Without
 * these aliases a fully provisioned cluster would report the service unconfigured.
 */
export const KEY_ALIASES: Readonly<Record<string, readonly string[]>> = {
  DATABASE_URL: ['DATABASE_URL'],
  MINIO_ENDPOINT: ['MINIO_ENDPOINT', 'S3_ENDPOINT'],
  MINIO_ACCESS_KEY: ['MINIO_ACCESS_KEY', 'MINIO_ROOT_USER', 'S3_ACCESS_KEY'],
  MINIO_SECRET_KEY: ['MINIO_SECRET_KEY', 'MINIO_ROOT_PASSWORD', 'S3_SECRET_KEY'],
  MINIO_BUCKET: ['MINIO_BUCKET', 'S3_BUCKET'],
};

/** A value counts as set only when it is non-blank and not the placeholder sentinel. */
export function isUsable(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim() !== '' && value.trim() !== PLACEHOLDER;
}

@Injectable()
export class ConfigResolverService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolution order: environment variable (including aliases) -> `SystemSetting`
   * row -> `null`. Callers decide whether `null` means "degrade" or "503"; nothing
   * here throws, so a missing key can never take the process down at boot.
   */
  async resolveConfig(key: string): Promise<string | null> {
    const fromEnv = this.resolveEnv(key);
    if (fromEnv !== null) {
      return fromEnv;
    }

    try {
      const row = await this.prisma.systemSetting.findUnique({ where: { key } });
      return isUsable(row?.value) ? row!.value.trim() : null;
    } catch {
      // DB unreachable: treat as unconfigured rather than propagating a 500.
      return null;
    }
  }

  /**
   * Environment-only lookup, following the alias list. Exposed separately so the
   * settings UI can report *where* a value came from without re-deriving the
   * precedence rule (and mislabelling an env value as DB-sourced when both match).
   */
  resolveEnv(key: string): string | null {
    for (const candidate of KEY_ALIASES[key] ?? [key]) {
      const value = process.env[candidate];
      if (isUsable(value)) {
        return value.trim();
      }
    }
    return null;
  }

  /** Same as resolveConfig but throws ServiceUnconfiguredError (503) instead of returning null. */
  async requireConfig(key: string): Promise<string> {
    const value = await this.resolveConfig(key);
    if (value === null) {
      throw new ServiceUnconfiguredError(key);
    }
    return value;
  }
}
