import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TagCount {
  name: string;
  count: number;
}

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ordered by usage count descending — this powers the "Popular Tags" sidebar,
   * where alphabetical order would be meaningless. Ties break alphabetically so
   * the list is stable across requests.
   */
  async listWithCounts(): Promise<TagCount[]> {
    const tags = await this.prisma.tag.findMany({
      select: { name: true, _count: { select: { articles: true } } },
    });

    return tags
      .map((tag) => ({ name: tag.name, count: tag._count.articles }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }
}
