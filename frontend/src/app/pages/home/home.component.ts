import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Article, Tag } from '../../core/models';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ArticlePreviewComponent } from '../../shared/article-preview.component';
import { PaginationComponent } from '../../shared/pagination.component';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-home',
  imports: [RouterLink, ArticlePreviewComponent, PaginationComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);

  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly pageSize = PAGE_SIZE;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly articles = signal<Article[]>([]);
  readonly tags = signal<Tag[]>([]);

  /** Server-reported match count for the active filter — drives the pager, not `articles().length`. */
  readonly total = signal(0);

  /** All view state lives in query params so every view is deep-linkable and reload-safe. */
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly activeTag = computed(() => this.params().get('tag') ?? '');
  readonly activeFeed = computed(() =>
    this.params().get('feed') === 'your' && this.isAuthenticated() ? 'your' : 'global',
  );
  readonly currentPage = computed(() => {
    const raw = Number(this.params().get('page') ?? '1');
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
  });

  /** The server already applied tag/feed/page, so what came back is exactly what renders. */
  readonly visible = computed(() => this.articles());

  /**
   * Guards against out-of-order responses: switching tabs quickly can resolve an older
   * request last, which would repaint the previous feed over the current one.
   */
  private requestId = 0;

  constructor() {
    effect(() => {
      // Read every dependency up front so the effect re-runs on any of them.
      const feed = this.activeFeed();
      const tag = this.activeTag();
      const page = this.currentPage();
      void this.load(feed, tag, page);
    });

    void this.loadTags();
  }

  private async load(feed: 'global' | 'your', tag: string, page: number): Promise<void> {
    const id = ++this.requestId;
    this.loading.set(true);
    this.error.set(null);
    try {
      const offset = (page - 1) * PAGE_SIZE;
      const result =
        feed === 'your'
          ? await this.api.feedArticles({ limit: PAGE_SIZE, offset })
          : await this.api.listArticles({ tag: tag || null, limit: PAGE_SIZE, offset });
      if (id !== this.requestId) {
        return;
      }
      this.articles.set(result.articles);
      this.total.set(result.articlesCount);
    } catch (err) {
      if (id !== this.requestId) {
        return;
      }
      this.articles.set([]);
      this.total.set(0);
      this.error.set(apiErrorMessage(err, 'Could not load articles.'));
    } finally {
      if (id === this.requestId) {
        this.loading.set(false);
      }
    }
  }

  /**
   * The tag sidebar is independent of the feed: a failure here leaves "Popular Tags"
   * empty rather than taking down the article list with an error block.
   */
  private async loadTags(): Promise<void> {
    try {
      this.tags.set(await this.api.listTags());
    } catch {
      this.tags.set([]);
    }
  }

  goToFeed(feed: 'global' | 'your'): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { feed, tag: null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  goToTag(tag: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tag, page: null },
      queryParamsHandling: 'merge',
    });
  }

  goToPage(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page === 1 ? null : page },
      queryParamsHandling: 'merge',
    });
  }

  async toggleFavorite(target: Article): Promise<void> {
    if (!this.isAuthenticated()) {
      await this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    const next = !target.favorited;
    // Optimistic: the heart flips immediately, and the server's authoritative count
    // replaces the guess when the call resolves.
    this.patch(target.slug, {
      favorited: next,
      favoritesCount: target.favoritesCount + (next ? 1 : -1),
    });
    try {
      const updated = await this.api.favoriteArticle(target.slug, next);
      this.patch(target.slug, {
        favorited: updated.favorited,
        favoritesCount: updated.favoritesCount,
      });
    } catch {
      this.patch(target.slug, {
        favorited: target.favorited,
        favoritesCount: target.favoritesCount,
      });
    }
  }

  private patch(slug: string, change: Partial<Article>): void {
    this.articles.update((list) =>
      list.map((article) => (article.slug === slug ? { ...article, ...change } : article)),
    );
  }
}
