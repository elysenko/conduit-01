import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Article } from '../../core/models';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { FavoriteButtonComponent } from '../../shared/favorite-button.component';
import { FollowButtonComponent } from '../../shared/follow-button.component';
import { ConfirmModalComponent } from '../../shared/confirm-modal.component';
import { CommentListComponent } from './comment-list.component';

@Component({
  selector: 'app-article',
  imports: [
    RouterLink,
    DatePipe,
    FavoriteButtonComponent,
    FollowButtonComponent,
    ConfirmModalComponent,
    CommentListComponent,
  ],
  templateUrl: './article.component.html',
  styleUrl: './article.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);

  readonly currentUser = this.auth.currentUser;
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly article = signal<Article | null>(null);

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly slug = computed(() => this.params().get('slug') ?? '');

  readonly paragraphs = computed(() => (this.article()?.body ?? '').split('\n\n'));

  readonly isAuthor = computed(
    () => this.article()?.author.username === this.currentUser()?.username,
  );

  readonly showDeleteConfirm = computed(() => this.query().get('modal') === 'confirm-delete');

  private requestId = 0;

  constructor() {
    effect(() => {
      const slug = this.slug();
      void this.load(slug);
    });
  }

  private async load(slug: string): Promise<void> {
    const id = ++this.requestId;
    if (!slug) {
      this.article.set(null);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const article = await this.api.getArticle(slug);
      if (id !== this.requestId) {
        return;
      }
      this.article.set(article);
    } catch (err) {
      if (id !== this.requestId) {
        return;
      }
      this.article.set(null);
      // A 404 is not an error state — the template already has a dedicated
      // "that article no longer exists" block, which reads better than a red banner.
      const status = (err as { status?: number } | null)?.status;
      this.error.set(status === 404 ? null : apiErrorMessage(err, 'Could not load this article.'));
    } finally {
      if (id === this.requestId) {
        this.loading.set(false);
      }
    }
  }

  private requireAuth(): boolean {
    if (this.isAuthenticated()) {
      return true;
    }
    void this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
    return false;
  }

  async toggleFavorite(): Promise<void> {
    const current = this.article();
    if (!current || !this.requireAuth()) {
      return;
    }
    const next = !current.favorited;
    this.article.set({
      ...current,
      favorited: next,
      favoritesCount: current.favoritesCount + (next ? 1 : -1),
    });
    try {
      this.article.set(await this.api.favoriteArticle(current.slug, next));
    } catch {
      this.article.set(current);
    }
  }

  async toggleFollow(): Promise<void> {
    const current = this.article();
    if (!current || !this.requireAuth()) {
      return;
    }
    const next = !current.author.following;
    this.article.set({ ...current, author: { ...current.author, following: next } });
    try {
      const profile = await this.api.followProfile(current.author.username, next);
      this.article.update((article) => (article ? { ...article, author: profile } : article));
    } catch {
      this.article.set(current);
    }
  }

  openDeleteConfirm(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { modal: 'confirm-delete' },
      queryParamsHandling: 'merge',
    });
  }

  closeDeleteConfirm(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { modal: null },
      queryParamsHandling: 'merge',
    });
  }

  async confirmDelete(): Promise<void> {
    const current = this.article();
    if (!current) {
      await this.router.navigate(['/']);
      return;
    }
    try {
      await this.api.deleteArticle(current.slug);
      // Awaited so the app stays "unstable" until the feed is actually on screen.
      await this.router.navigate(['/']);
    } catch (err) {
      // Keep the reader on the page and say why (403 when it is not their article).
      this.closeDeleteConfirm();
      this.error.set(apiErrorMessage(err, 'Could not delete this article.'));
    }
  }
}
