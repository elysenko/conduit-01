import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TagsService, type TagCount } from './tags.service';

@ApiTags('tags')
@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  @ApiOperation({ summary: 'All tags, most used first' })
  async list(): Promise<{ tags: string[]; tagCounts: TagCount[] }> {
    const tagCounts = await this.tags.listWithCounts();
    // `tags` is the RealWorld contract (plain names). `tagCounts` is additive, for
    // the sidebar's usage badges — clients that only read `tags` are unaffected.
    return { tags: tagCounts.map((tag) => tag.name), tagCounts };
  }
}
