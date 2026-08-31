import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Article, Comment, Profile, SystemSettingView, Tag, User } from './models';

/**
 * Base path for every call to the NestJS API.
 *
 * Derived from the document's `<base href>` rather than hardcoded to "/api", because
 * this app is deployed under a sub-path base href (colossus.yaml sets
 * `baseHref: "/{{IMAGE_NAME}}/"`, and the mockup host serves under /<id>/ too). An
 * absolute "/api" would resolve to <origin>/api and miss the app's ingress entirely;
 * a base-relative one resolves to <origin>/<image>/api, which the ingress routes here
 * and strips before nginx sees it. At a root deployment the base href is "/" and this
 * collapses to exactly "/api" — the value pinned by `glue.frontend_api_base`.
 *
 * `__CONDUIT_API_BASE__` is an escape hatch a host page can set before bootstrap (e.g.
 * when the SPA and API live on different origins); it is read once, not per call.
 */
function resolveApiBase(): string {
  const override = (globalThis as unknown as { __CONDUIT_API_BASE__?: unknown })
    .__CONDUIT_API_BASE__;
  if (typeof override === 'string' && override.trim() !== '') {
    return override.trim().replace(/\/+$/, '');
  }
  try {
    // `new URL('api', baseURI)` keeps the base path and drops index.html if present.
    return new URL('api', document.baseURI).pathname.replace(/\/+$/, '');
  } catch {
    return '/api';
  }
}

export const API_BASE = resolveApiBase();

/**
 * Avatar fallback.
 *
 * `image` is nullable in Postgres and the backend coalesces it to `''`, but the approved
 * design renders an avatar in every list row, comment and header. Substituting a
 * deterministic per-username avatar keeps the visual design intact without forcing every
 * template to carry a null check. Purely presentational — never sent back to the API.
 */
export function avatarFor(username: string, image?: string | null): string {
  if (image && image.trim() !== '') {
    return image;
  }
  const seed = encodeURIComponent(username || 'reader');
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
}

/** Turns any HTTP failure into the flat `string[]` the error-message lists render. */
export function apiErrors(error: unknown, fallback = 'Something went wrong. Please try again.'): string[] {
  if (!(error instanceof HttpErrorResponse)) {
    return [fallback];
  }
  if (error.status === 0) {
    return ['Cannot reach the server. Check your connection and try again.'];
  }
  const body = error.error as
    | { message?: unknown; errors?: Record<string, string[]> }
    | string
    | null;

  if (body && typeof body === 'object') {
    // RealWorld-style `{ errors: { email: ["is invalid"] } }`.
    if (body.errors && typeof body.errors === 'object') {
      const flattened = Object.entries(body.errors).flatMap(([field, messages]) =>
        (messages ?? []).map((message) => `${field} ${message}`),
      );
      if (flattened.length) {
        return flattened;
      }
    }
    // Nest's ValidationPipe emits `message` as an array of constraint failures.
    if (Array.isArray(body.message)) {
      return body.message.map(String);
    }
    if (typeof body.message === 'string' && body.message.trim() !== '') {
      return [body.message];
    }
  }
  if (typeof body === 'string' && body.trim() !== '') {
    return [body];
  }
  return [error.statusText || fallback];
}

/** Convenience for the single-line `error()` signals the state blocks bind to. */
export function apiErrorMessage(error: unknown, fallback?: string): string {
  return apiErrors(error, fallback).join(' ');
}

export interface ArticleListResult {
  articles: Article[];
  articlesCount: number;
}

export interface ListArticlesParams {
  tag?: string | null;
  author?: string | null;
  favorited?: string | null;
  limit?: number;
  offset?: number;
}

export interface ArticleInput {
  title: string;
  description: string;
  body: string;
  tagList: string[];
}

export interface UpdateUserInput {
  username?: string;
  email?: string;
  bio?: string;
  image?: string;
  password?: string;
}

interface UserEnvelope {
  user: User;
}
interface ProfileEnvelope {
  profile: Profile;
}
interface ArticleEnvelope {
  article: Article;
}

/**
 * The single HTTP seam between the SPA and the NestJS API.
 *
 * Every method unwraps the RealWorld `{ article: … }` / `{ user: … }` envelope and
 * normalises avatars, so components deal in the flat models declared in `models.ts` and
 * never touch HttpClient directly. Returning promises (not observables) keeps the
 * component code a straight line of `await`s — and, because zone.js still tracks the
 * underlying XHR, Angular testability remains an accurate "app is idle" signal.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  private url(path: string): string {
    return `${API_BASE}${path}`;
  }

  private static profile(profile: Profile): Profile {
    return {
      username: profile.username,
      bio: profile.bio ?? '',
      image: avatarFor(profile.username, profile.image),
      following: profile.following === true,
    };
  }

  private static article(article: Article): Article {
    return { ...article, author: ApiService.profile(article.author) };
  }

  private static comment(comment: Comment): Comment {
    return { ...comment, author: ApiService.profile(comment.author) };
  }

  private static user(user: User): User {
    return { ...user, bio: user.bio ?? '', image: avatarFor(user.username, user.image) };
  }

  // ---------------------------------------------------------------- articles

  private static articleParams(params: ListArticlesParams): HttpParams {
    let query = new HttpParams();
    // Blank values are dropped rather than sent as `?tag=`: the backend DTO would
    // accept the empty string and filter everything out.
    if (params.tag) query = query.set('tag', params.tag);
    if (params.author) query = query.set('author', params.author);
    if (params.favorited) query = query.set('favorited', params.favorited);
    if (params.limit != null) query = query.set('limit', String(params.limit));
    if (params.offset != null) query = query.set('offset', String(params.offset));
    return query;
  }

  async listArticles(params: ListArticlesParams = {}): Promise<ArticleListResult> {
    const result = await firstValueFrom(
      this.http.get<ArticleListResult>(this.url('/articles'), {
        params: ApiService.articleParams(params),
      }),
    );
    return {
      articles: (result.articles ?? []).map(ApiService.article),
      articlesCount: result.articlesCount ?? 0,
    };
  }

  /** Articles by authors the caller follows. Requires a token; 401 otherwise. */
  async feedArticles(params: ListArticlesParams = {}): Promise<ArticleListResult> {
    const result = await firstValueFrom(
      this.http.get<ArticleListResult>(this.url('/articles/feed'), {
        params: ApiService.articleParams({ limit: params.limit, offset: params.offset }),
      }),
    );
    return {
      articles: (result.articles ?? []).map(ApiService.article),
      articlesCount: result.articlesCount ?? 0,
    };
  }

  async getArticle(slug: string): Promise<Article> {
    const result = await firstValueFrom(
      this.http.get<ArticleEnvelope>(this.url(`/articles/${encodeURIComponent(slug)}`)),
    );
    return ApiService.article(result.article);
  }

  async createArticle(input: ArticleInput): Promise<Article> {
    const result = await firstValueFrom(
      this.http.post<ArticleEnvelope>(this.url('/articles'), { article: input }),
    );
    return ApiService.article(result.article);
  }

  async updateArticle(slug: string, input: Partial<ArticleInput>): Promise<Article> {
    const result = await firstValueFrom(
      this.http.put<ArticleEnvelope>(this.url(`/articles/${encodeURIComponent(slug)}`), {
        article: input,
      }),
    );
    return ApiService.article(result.article);
  }

  async deleteArticle(slug: string): Promise<void> {
    await firstValueFrom(this.http.delete(this.url(`/articles/${encodeURIComponent(slug)}`)));
  }

  async favoriteArticle(slug: string, favorited: boolean): Promise<Article> {
    const path = this.url(`/articles/${encodeURIComponent(slug)}/favorite`);
    const result = await firstValueFrom(
      favorited
        ? this.http.post<ArticleEnvelope>(path, {})
        : this.http.delete<ArticleEnvelope>(path),
    );
    return ApiService.article(result.article);
  }

  // ---------------------------------------------------------------- comments

  async listComments(slug: string): Promise<Comment[]> {
    const result = await firstValueFrom(
      this.http.get<{ comments: Comment[] }>(
        this.url(`/articles/${encodeURIComponent(slug)}/comments`),
      ),
    );
    return (result.comments ?? []).map(ApiService.comment);
  }

  async addComment(slug: string, body: string): Promise<Comment> {
    const result = await firstValueFrom(
      this.http.post<{ comment: Comment }>(
        this.url(`/articles/${encodeURIComponent(slug)}/comments`),
        { comment: { body } },
      ),
    );
    return ApiService.comment(result.comment);
  }

  async deleteComment(slug: string, id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(
        this.url(`/articles/${encodeURIComponent(slug)}/comments/${encodeURIComponent(id)}`),
      ),
    );
  }

  // -------------------------------------------------------------------- tags

  /**
   * The controller returns both `tags` (plain names, the RealWorld contract) and the
   * additive `tagCounts`. Prefer the counts so the sidebar keeps its usage ordering;
   * fall back to names with a zero count if an older backend only sends `tags`.
   */
  async listTags(): Promise<Tag[]> {
    const result = await firstValueFrom(
      this.http.get<{ tags?: string[]; tagCounts?: Tag[] }>(this.url('/tags')),
    );
    if (result.tagCounts?.length) {
      return result.tagCounts.map((tag) => ({ name: tag.name, count: tag.count ?? 0 }));
    }
    return (result.tags ?? []).map((name) => ({ name, count: 0 }));
  }

  // ---------------------------------------------------------------- profiles

  async getProfile(username: string): Promise<Profile> {
    const result = await firstValueFrom(
      this.http.get<ProfileEnvelope>(this.url(`/profiles/${encodeURIComponent(username)}`)),
    );
    return ApiService.profile(result.profile);
  }

  async followProfile(username: string, following: boolean): Promise<Profile> {
    const path = this.url(`/profiles/${encodeURIComponent(username)}/follow`);
    const result = await firstValueFrom(
      following
        ? this.http.post<ProfileEnvelope>(path, {})
        : this.http.delete<ProfileEnvelope>(path),
    );
    return ApiService.profile(result.profile);
  }

  // -------------------------------------------------------------------- user

  async login(email: string, password: string): Promise<User> {
    const result = await firstValueFrom(
      this.http.post<UserEnvelope>(this.url('/users/login'), { user: { email, password } }),
    );
    return ApiService.user(result.user);
  }

  async register(username: string, email: string, password: string): Promise<User> {
    const result = await firstValueFrom(
      this.http.post<UserEnvelope>(this.url('/users'), { user: { username, email, password } }),
    );
    return ApiService.user(result.user);
  }

  async currentUser(): Promise<User> {
    const result = await firstValueFrom(this.http.get<UserEnvelope>(this.url('/user')));
    return ApiService.user(result.user);
  }

  async updateUser(input: UpdateUserInput): Promise<User> {
    const result = await firstValueFrom(
      this.http.put<UserEnvelope>(this.url('/user'), { user: input }),
    );
    return ApiService.user(result.user);
  }

  // ------------------------------------------------------------------- admin

  async listSettings(): Promise<SystemSettingView[]> {
    return firstValueFrom(this.http.get<SystemSettingView[]>(this.url('/admin/settings')));
  }

  /** Flat `{ KEY: value }` map; the backend rejects keys outside its catalog with a 400. */
  async saveSettings(patch: Record<string, string>): Promise<SystemSettingView[]> {
    return firstValueFrom(
      this.http.patch<SystemSettingView[]>(this.url('/admin/settings'), patch),
    );
  }
}
