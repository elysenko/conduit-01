import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Article } from '../../core/models';
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

  readonly currentUser = this.auth.currentUser;
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  articles = signal<Article[]>([
    {
      id: 'a-1',
      slug: 'how-to-train-your-dragon',
      title: 'How to train your dragon',
      description: 'Ever wonder how?',
      body: 'It takes a Jacobian.\n\nDragons respond to consistency far more than to force. Start with short sessions, keep the reward immediate, and never end a session on a failure — a dragon remembers the last thing that happened far more vividly than the first.\n\nWeek one is about presence. Sit in the paddock. Do nothing. Let the animal decide that you are furniture.\n\nWeek two introduces the recall whistle. Three notes, always the same three notes, always followed by food. By week three you should be able to call your dragon from across the paddock.',
      tagList: ['dragons', 'training'],
      createdAt: '2026-08-24T09:12:00.000Z',
      updatedAt: '2026-08-24T09:12:00.000Z',
      favorited: true,
      favoritesCount: 32,
      author: { username: 'jake', bio: 'I work at statefarm', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jake', following: false },
    },
    {
      id: 'a-2',
      slug: 'the-song-of-the-forest',
      title: 'The song of the forest',
      description: 'Field notes from six months of listening.',
      body: 'A forest is never silent.\n\nI spent six months recording a single hectare of temperate rainforest at dawn. What surprised me was not the volume but the structure: the chorus starts at a predictable pitch and climbs.\n\nThe recordings are all public domain. Take them.',
      tagList: ['nature', 'writing'],
      createdAt: '2026-08-22T16:40:00.000Z',
      updatedAt: '2026-08-22T16:40:00.000Z',
      favorited: false,
      favoritesCount: 18,
      author: { username: 'ada', bio: 'Field recordist and essayist.', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ada', following: true },
    },
    {
      id: 'a-3',
      slug: 'why-your-tests-are-slow',
      title: 'Why your tests are slow (and what to do about it)',
      description: 'Ten minutes of CI is ten minutes of nobody shipping.',
      body: 'Most slow suites are slow for one of three reasons: real network calls, a database per test, or a global setup nobody has read in two years.\n\nStart by measuring. Not guessing — measuring.',
      tagList: ['engineering', 'testing'],
      createdAt: '2026-08-20T11:05:00.000Z',
      updatedAt: '2026-08-20T11:05:00.000Z',
      favorited: true,
      favoritesCount: 47,
      author: { username: 'ada', bio: 'Field recordist and essayist.', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ada', following: true },
    },
    {
      id: 'a-4',
      slug: 'dragons-of-the-northern-reach',
      title: 'Dragons of the northern reach',
      description: 'A field guide to the six species you are most likely to meet.',
      body: 'The northern reach hosts six recognised species, three of which are docile enough to approach on foot.\n\nBring gloves. Bring more gloves than you think you need.',
      tagList: ['dragons', 'nature'],
      createdAt: '2026-08-18T08:30:00.000Z',
      updatedAt: '2026-08-18T08:30:00.000Z',
      favorited: false,
      favoritesCount: 9,
      author: { username: 'jake', bio: 'I work at statefarm', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jake', following: false },
    },
  ]);

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly slug = computed(() => this.params().get('slug') ?? '');

  /** Falls back to the first article so any slug renders a reviewable page. */
  readonly article = computed<Article | null>(() => {
    const list = this.articles();
    if (list.length === 0) {
      return null;
    }
    return list.find((item) => item.slug === this.slug()) ?? list[0];
  });

  readonly paragraphs = computed(() => (this.article()?.body ?? '').split('\n\n'));

  readonly isAuthor = computed(
    () => this.article()?.author.username === this.currentUser()?.username,
  );

  readonly showDeleteConfirm = computed(() => this.query().get('modal') === 'confirm-delete');

  private patch(change: (article: Article) => Article): void {
    const current = this.article();
    if (!current) {
      return;
    }
    this.articles.update((list) =>
      list.map((item) => (item.id === current.id ? change(item) : item)),
    );
  }

  toggleFavorite(): void {
    this.patch((article) => ({
      ...article,
      favorited: !article.favorited,
      favoritesCount: article.favoritesCount + (article.favorited ? -1 : 1),
    }));
  }

  toggleFollow(): void {
    this.patch((article) => ({
      ...article,
      author: { ...article.author, following: !article.author.following },
    }));
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

  confirmDelete(): void {
    const current = this.article();
    if (current) {
      this.articles.update((list) => list.filter((item) => item.id !== current.id));
    }
    void this.router.navigate(['/']);
  }
}
