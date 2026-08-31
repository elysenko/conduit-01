import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;

export class ListArticlesQuery {
  /** Tag name filter. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tag?: string;

  /** Username of the author. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  author?: string;

  /** Username of a user who favorited the article. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  favorited?: string;

  // Bounded rather than clamped: an out-of-range limit is a client bug worth a 400,
  // and an unbounded limit is a trivial denial-of-service vector.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  /** 1-based convenience alias the SPA uses; translated to `offset` when `offset` is absent. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}

export class FeedQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}

/** Resolves the limit/offset pair, honouring `page` only when `offset` was not given. */
export function resolvePaging(query: {
  limit?: number;
  offset?: number;
  page?: number;
}): { limit: number; offset: number } {
  const limit = query.limit ?? DEFAULT_LIMIT;
  const offset = query.offset ?? (query.page ? (query.page - 1) * limit : 0);
  return { limit, offset };
}
