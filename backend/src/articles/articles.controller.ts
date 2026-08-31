import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ArticlesService, type ArticleListDto } from './articles.service';
import { CreateArticleBodyDto } from './dto/create-article.dto';
import { UpdateArticleBodyDto } from './dto/update-article.dto';
import { FeedQuery, ListArticlesQuery } from './dto/list-articles.query';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import type { ArticleDto } from './article.mapper';

@ApiTags('articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  // NOTE: declared before `:slug` so "feed" is not swallowed as a slug.
  @Get('feed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Articles from authors the caller follows' })
  feed(@Query() query: FeedQuery, @CurrentUser() viewer: AuthUser): Promise<ArticleListDto> {
    return this.articles.feed(query, viewer);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Global feed with optional tag / author / favorited filters' })
  list(
    @Query() query: ListArticlesQuery,
    @CurrentUser() viewer: AuthUser | null,
  ): Promise<ArticleListDto> {
    return this.articles.list(query, viewer);
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  async get(
    @Param('slug') slug: string,
    @CurrentUser() viewer: AuthUser | null,
  ): Promise<{ article: ArticleDto }> {
    return { article: await this.articles.get(slug, viewer) };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async create(
    @Body() body: CreateArticleBodyDto,
    @CurrentUser() viewer: AuthUser,
  ): Promise<{ article: ArticleDto }> {
    return { article: await this.articles.create(body.article, viewer) };
  }

  @Put(':slug')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async update(
    @Param('slug') slug: string,
    @Body() body: UpdateArticleBodyDto,
    @CurrentUser() viewer: AuthUser,
  ): Promise<{ article: ArticleDto }> {
    return { article: await this.articles.update(slug, body.article, viewer) };
  }

  @Delete(':slug')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async remove(
    @Param('slug') slug: string,
    @CurrentUser() viewer: AuthUser,
  ): Promise<{ slug: string }> {
    await this.articles.remove(slug, viewer);
    return { slug };
  }

  @Post(':slug/favorite')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async favorite(
    @Param('slug') slug: string,
    @CurrentUser() viewer: AuthUser,
  ): Promise<{ article: ArticleDto }> {
    return { article: await this.articles.favorite(slug, viewer) };
  }

  @Delete(':slug/favorite')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async unfavorite(
    @Param('slug') slug: string,
    @CurrentUser() viewer: AuthUser,
  ): Promise<{ article: ArticleDto }> {
    return { article: await this.articles.unfavorite(slug, viewer) };
  }
}
