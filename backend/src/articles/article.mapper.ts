import type { Article, User } from '@prisma/client';
import { toProfileDto, type ProfileDto } from '../profiles/profile.mapper';

/**
 * Prisma include used by every article read.
 *
 * `followers` / `favorites` are filtered by the *viewer*, so both collapse to an
 * empty array for anonymous callers (the empty-string id can never match a cuid).
 * That keeps one static shape for both the authenticated and anonymous paths
 * instead of branching the include and losing type safety.
 */
export const articleInclude = (viewerId: string) => ({
  author: { include: { followers: { where: { followerId: viewerId } } } },
  tags: { include: { tag: true } },
  favorites: { where: { userId: viewerId } },
  _count: { select: { favorites: true } },
});

export type ArticleRecord = Article & {
  author: Pick<User, 'username' | 'bio' | 'image'> & { followers: { followerId: string }[] };
  tags: { tag: { name: string } }[];
  favorites: { userId: string }[];
  _count: { favorites: number };
};

export interface ArticleDto {
  id: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  tagList: string[];
  createdAt: string;
  updatedAt: string;
  favorited: boolean;
  favoritesCount: number;
  author: ProfileDto;
}

export function toArticleDto(article: ArticleRecord): ArticleDto {
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    description: article.description,
    body: article.body,
    tagList: article.tags.map((link) => link.tag.name).sort((a, b) => a.localeCompare(b)),
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
    // Non-empty only because the include filtered favourites to this viewer.
    favorited: article.favorites.length > 0,
    // Recomputed by the database on every read — never incremented in application code.
    favoritesCount: article._count.favorites,
    author: toProfileDto(article.author, article.author.followers.length > 0),
  };
}
