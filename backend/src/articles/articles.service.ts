import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toSlug, withCollisionSuffix } from '../common/slug.util';
import { articleInclude, toArticleDto, type ArticleDto, type ArticleRecord } from './article.mapper';
import { resolvePaging, type FeedQuery, type ListArticlesQuery } from './dto/list-articles.query';
import type { CreateArticleDto } from './dto/create-article.dto';
import type { UpdateArticleDto } from './dto/update-article.dto';
import type { AuthUser } from '../common/types/auth-user';

export interface ArticleListDto {
  articles: ArticleDto[];
  articlesCount: number;
}

/** Empty string can never equal a cuid, so it is a safe "no viewer" sentinel. */
const ANONYMOUS = '';

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  private viewerId(viewer: AuthUser | null): string {
    return viewer?.id ?? ANONYMOUS;
  }

  private normaliseTags(tagList: string[] | undefined): string[] {
    if (!tagList) {
      return [];
    }
    const cleaned = tagList.map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0);
    return Array.from(new Set(cleaned));
  }

  async list(query: ListArticlesQuery, viewer: AuthUser | null): Promise<ArticleListDto> {
    const { limit, offset } = resolvePaging(query);

    // Filters are conjunctive: ?tag=x&author=y returns x AND y, not x OR y.
    const where: Prisma.ArticleWhereInput = {
      ...(query.tag ? { tags: { some: { tag: { name: query.tag } } } } : {}),
      ...(query.author ? { author: { username: query.author } } : {}),
      ...(query.favorited ? { favorites: { some: { user: { username: query.favorited } } } } : {}),
    };

    // Count is over the full filtered set, not the page — `articlesCount` drives
    // the pager, so returning the page size here would break pagination entirely.
    const [rows, articlesCount] = await this.prisma.$transaction([
      this.prisma.article.findMany({
        where,
        include: articleInclude(this.viewerId(viewer)),
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.article.count({ where }),
    ]);

    return { articles: rows.map((row) => toArticleDto(row as ArticleRecord)), articlesCount };
  }

  async feed(query: FeedQuery, viewer: AuthUser): Promise<ArticleListDto> {
    const { limit, offset } = resolvePaging(query);
    const where: Prisma.ArticleWhereInput = {
      author: { followers: { some: { followerId: viewer.id } } },
    };

    const [rows, articlesCount] = await this.prisma.$transaction([
      this.prisma.article.findMany({
        where,
        include: articleInclude(viewer.id),
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.article.count({ where }),
    ]);

    return { articles: rows.map((row) => toArticleDto(row as ArticleRecord)), articlesCount };
  }

  /** Loads an article in viewer context or throws 404. Shared by every :slug route. */
  async findBySlugOr404(slug: string, viewerId: string): Promise<ArticleRecord> {
    const article = await this.prisma.article.findUnique({
      where: { slug },
      include: articleInclude(viewerId),
    });
    if (!article) {
      throw new NotFoundException(`Article "${slug}" not found`);
    }
    return article as ArticleRecord;
  }

  async get(slug: string, viewer: AuthUser | null): Promise<ArticleDto> {
    return toArticleDto(await this.findBySlugOr404(slug, this.viewerId(viewer)));
  }

  async create(dto: CreateArticleDto, author: AuthUser): Promise<ArticleDto> {
    const tags = this.normaliseTags(dto.tagList);
    const base = toSlug(dto.title);

    // Two articles may legitimately share a title. Retry with a base36 suffix on the
    // unique-slug violation instead of pre-querying (which would still race).
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const slug = attempt === 0 ? base : withCollisionSuffix(base);
      try {
        const created = await this.prisma.article.create({
          data: {
            slug,
            title: dto.title.trim(),
            description: dto.description.trim(),
            body: dto.body,
            authorId: author.id,
            tags: {
              create: tags.map((name) => ({
                tag: { connectOrCreate: { where: { name }, create: { name } } },
              })),
            },
          },
          include: articleInclude(author.id),
        });
        return toArticleDto(created as ArticleRecord);
      } catch (error) {
        if (!isSlugCollision(error)) {
          throw error;
        }
      }
    }

    throw new NotFoundException('Could not allocate a unique slug for this title');
  }

  async update(slug: string, dto: UpdateArticleDto, viewer: AuthUser): Promise<ArticleDto> {
    const existing = await this.findBySlugOr404(slug, viewer.id);
    this.assertOwnership(existing.authorId, viewer);

    // Re-slug only when the title actually changed, so editing the body alone keeps
    // existing links working.
    const retitled = dto.title !== undefined && dto.title.trim() !== existing.title;
    const base = retitled ? toSlug(dto.title as string) : existing.slug;

    const data: Prisma.ArticleUpdateInput = {
      ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
      ...(dto.body !== undefined ? { body: dto.body } : {}),
      ...(dto.tagList !== undefined
        ? {
            tags: {
              deleteMany: {},
              create: this.normaliseTags(dto.tagList).map((name) => ({
                tag: { connectOrCreate: { where: { name }, create: { name } } },
              })),
            },
          }
        : {}),
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const nextSlug = !retitled ? existing.slug : attempt === 0 ? base : withCollisionSuffix(base);
      try {
        const updated = await this.prisma.article.update({
          where: { id: existing.id },
          data: { ...data, slug: nextSlug },
          include: articleInclude(viewer.id),
        });
        return toArticleDto(updated as ArticleRecord);
      } catch (error) {
        if (!isSlugCollision(error) || !retitled) {
          throw error;
        }
      }
    }

    throw new NotFoundException('Could not allocate a unique slug for this title');
  }

  async remove(slug: string, viewer: AuthUser): Promise<void> {
    const existing = await this.findBySlugOr404(slug, viewer.id);
    this.assertOwnership(existing.authorId, viewer);
    // Comments, tag links and favourites cascade at the schema level.
    await this.prisma.article.delete({ where: { id: existing.id } });
  }

  async favorite(slug: string, viewer: AuthUser): Promise<ArticleDto> {
    const existing = await this.findBySlugOr404(slug, viewer.id);

    // Idempotent: favoriting twice leaves exactly one row and still returns 200.
    await this.prisma.favorite.upsert({
      where: { userId_articleId: { userId: viewer.id, articleId: existing.id } },
      update: {},
      create: { userId: viewer.id, articleId: existing.id },
    });

    return toArticleDto(await this.findBySlugOr404(existing.slug, viewer.id));
  }

  async unfavorite(slug: string, viewer: AuthUser): Promise<ArticleDto> {
    const existing = await this.findBySlugOr404(slug, viewer.id);

    // deleteMany tolerates "was never favorited"; the count is then re-read from the
    // database, so it can never drift negative.
    await this.prisma.favorite.deleteMany({
      where: { userId: viewer.id, articleId: existing.id },
    });

    return toArticleDto(await this.findBySlugOr404(existing.slug, viewer.id));
  }

  /**
   * Ownership is enforced here, in the service, and not by a guard. A guard-only
   * implementation returns 401 for "authenticated but not the author", where the
   * contract requires 403 — and the two must stay distinguishable.
   */
  private assertOwnership(authorId: string, viewer: AuthUser): void {
    if (authorId !== viewer.id) {
      throw new ForbiddenException('You are not the author of this article');
    }
  }
}

function isSlugCollision(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    JSON.stringify(error.meta ?? {}).includes('slug')
  );
}
