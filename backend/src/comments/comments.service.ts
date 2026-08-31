import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toProfileDto, type ProfileDto } from '../profiles/profile.mapper';
import type { AuthUser } from '../common/types/auth-user';
import type { CreateCommentDto } from './dto/create-comment.dto';

export interface CommentDto {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: ProfileDto;
}

const ANONYMOUS = '';

const commentInclude = (viewerId: string) => ({
  author: { include: { followers: { where: { followerId: viewerId } } } },
});

interface CommentRecord {
  id: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  author: {
    username: string;
    bio: string | null;
    image: string | null;
    followers: { followerId: string }[];
  };
}

function toCommentDto(comment: CommentRecord): CommentDto {
  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    author: toProfileDto(comment.author, comment.author.followers.length > 0),
  };
}

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolves the article id, or 404 — comments on a missing article are a 404, not an empty list. */
  private async articleIdOr404(slug: string): Promise<string> {
    const article = await this.prisma.article.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!article) {
      throw new NotFoundException(`Article "${slug}" not found`);
    }
    return article.id;
  }

  async list(slug: string, viewer: AuthUser | null): Promise<CommentDto[]> {
    const articleId = await this.articleIdOr404(slug);
    const rows = await this.prisma.comment.findMany({
      where: { articleId },
      include: commentInclude(viewer?.id ?? ANONYMOUS),
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => toCommentDto(row as CommentRecord));
  }

  async create(slug: string, dto: CreateCommentDto, viewer: AuthUser): Promise<CommentDto> {
    const articleId = await this.articleIdOr404(slug);
    const created = await this.prisma.comment.create({
      data: { body: dto.body, articleId, authorId: viewer.id },
      include: commentInclude(viewer.id),
    });
    return toCommentDto(created as CommentRecord);
  }

  async remove(slug: string, commentId: string, viewer: AuthUser): Promise<void> {
    const articleId = await this.articleIdOr404(slug);
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, authorId: true, articleId: true },
    });

    // A real comment id that belongs to a *different* article is a 404, not a 403:
    // the resource does not exist at this path.
    if (!comment || comment.articleId !== articleId) {
      throw new NotFoundException(`Comment "${commentId}" not found on article "${slug}"`);
    }
    if (comment.authorId !== viewer.id) {
      throw new ForbiddenException('You are not the author of this comment');
    }

    await this.prisma.comment.delete({ where: { id: comment.id } });
  }
}
