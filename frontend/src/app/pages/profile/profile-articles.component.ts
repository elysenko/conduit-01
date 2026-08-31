import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Article } from '../../core/models';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ArticlePreviewComponent } from '../../shared/article-preview.component';

/** Serves both profile child routes: '' (My Articles) and 'favorites' (Favorited Articles). */
@Component({
  selector: 'app-profile-articles',
  imports: [ArticlePreviewComponent, RouterLink],
  templateUrl: './profile-articles.component.html',
  styleUrl: './profile-articles.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileArticlesComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly articles = signal<Article[]>([]);

  private readonly data = toSignal(this.route.data, { initialValue: this.route.snapshot.data });
  private readonly parentParams = toSignal(
    this.route.parent?.paramMap ?? this.route.paramMap,
    { initialValue: this.route.parent?.snapshot.paramMap ?? this.route.snapshot.paramMap },
  );

  readonly showFavorites = computed(() => this.data()['favorites'] === true);
  readonly username = computed(() => this.parentParams().get('username') ?? '');

  /** The server applied the author / favorited filter, so this is already the final list. */
  readonly visible = computed(() => this.articles());

  private requestId = 0;

  constructor() {
    effect(() => {
      const username = this.username();
      const favorites = this.showFavorites();
      void this.load(username, favorites);
    });
  }

  private async load(username: string, favorites: boolean): Promise<void> {
    const id = ++this.requestId;
    if (!username) {
      this.articles.set([]);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.api.listArticles(
        favorites ? { favorited: username } : { author: username },
      );
      if (id !== this.requestId) {
        return;
      }
      this.articles.set(result.articles);
    } catch (err) {
      if (id !== this.requestId) {
        return;
      }
      this.articles.set([]);
      this.error.set(apiErrorMessage(err, 'Could not load these articles.'));
    } finally {
      if (id === this.requestId) {
        this.loading.set(false);
      }
    }
  }

  async toggleFavorite(target: Article): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      await this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    const next = !target.favorited;
    this.patch(target.slug, {
      favorited: next,
      favoritesCount: target.favoritesCount + (next ? 1 : -1),
    });
    try {
      const updated = await this.api.favoriteArticle(target.slug, next);
      // On the Favorited tab an unfavourite removes the row outright — leaving it in
      // place would contradict the tab the reader is looking at.
      if (this.showFavorites() && !updated.favorited) {
        this.articles.update((list) => list.filter((article) => article.slug !== target.slug));
        return;
      }
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
