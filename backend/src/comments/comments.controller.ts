import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommentsService, type CommentDto } from './comments.service';
import { CreateCommentBodyDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';

@ApiTags('comments')
@Controller('articles/:slug/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Comments on an article, newest first' })
  async list(
    @Param('slug') slug: string,
    @CurrentUser() viewer: AuthUser | null,
  ): Promise<{ comments: CommentDto[] }> {
    return { comments: await this.comments.list(slug, viewer) };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async create(
    @Param('slug') slug: string,
    @Body() body: CreateCommentBodyDto,
    @CurrentUser() viewer: AuthUser,
  ): Promise<{ comment: CommentDto }> {
    return { comment: await this.comments.create(slug, body.comment, viewer) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async remove(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() viewer: AuthUser,
  ): Promise<{ id: string }> {
    await this.comments.remove(slug, id, viewer);
    return { id };
  }
}
