import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Article, Tag } from '../../core/models';
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

  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly pageSize = PAGE_SIZE;

  /** Loading / error are surfaced so the states are reviewable; the mockup resolves locally. */
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  articles = signal<Article[]>([
    {
      id: 'a-1',
      slug: 'how-to-train-your-dragon',
      title: 'How to train your dragon',
      description: 'Ever wonder how?',
      body: 'It takes a Jacobian.\n\nDragons respond to consistency far more than to force. Start with short sessions, keep the reward immediate, and never end on a failure.\n\nBy week three you should be able to call your dragon from across the paddock.',
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
      body: 'A forest is never silent.\n\nI spent six months recording a single hectare of temperate rainforest at dawn, and the results were not what I expected.',
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
      body: 'Most slow suites are slow for one of three reasons: real network calls, a database per test, or a global setup nobody has read in two years.',
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
      body: 'The northern reach hosts six recognised species, three of which are docile enough to approach on foot.',
      tagList: ['dragons', 'nature'],
      createdAt: '2026-08-18T08:30:00.000Z',
      updatedAt: '2026-08-18T08:30:00.000Z',
      favorited: false,
      favoritesCount: 9,
      author: { username: 'jake', bio: 'I work at statefarm', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jake', following: false },
    },
    {
      id: 'a-5',
      slug: 'a-quiet-case-for-boring-tools',
      title: 'A quiet case for boring tools',
      description: 'Novelty is a cost you pay every sprint.',
      body: 'The tool you already understand is faster than the tool that is theoretically faster.',
      tagList: ['engineering', 'opinion'],
      createdAt: '2026-08-15T14:22:00.000Z',
      updatedAt: '2026-08-15T14:22:00.000Z',
      favorited: false,
      favoritesCount: 61,
      author: { username: 'marcus', bio: 'Building small things carefully.', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=marcus', following: true },
    },
    {
      id: 'a-6',
      slug: 'training-notes-week-one',
      title: 'Training notes: week one',
      description: 'What actually happened, minus the highlight reel.',
      body: 'Day one was a disaster. Day four was quietly excellent. Here is the log.',
      tagList: ['training', 'writing'],
      createdAt: '2026-08-12T07:50:00.000Z',
      updatedAt: '2026-08-12T07:50:00.000Z',
      favorited: true,
      favoritesCount: 12,
      author: { username: 'jake', bio: 'I work at statefarm', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jake', following: false },
    },
    {
      id: 'a-7',
      slug: 'reading-the-room-in-code-review',
      title: 'Reading the room in code review',
      description: 'The comment you do not leave is often the best one.',
      body: 'Review is a social act before it is a technical one.',
      tagList: ['engineering', 'opinion'],
      createdAt: '2026-08-09T12:00:00.000Z',
      updatedAt: '2026-08-09T12:00:00.000Z',
      favorited: false,
      favoritesCount: 27,
      author: { username: 'marcus', bio: 'Building small things carefully.', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=marcus', following: true },
    },
    {
      id: 'a-8',
      slug: 'ink-and-paper-in-a-glass-age',
      title: 'Ink and paper in a glass age',
      description: 'Why I still draft everything by hand.',
      body: 'Handwriting is slow, and that is the entire point.',
      tagList: ['writing'],
      createdAt: '2026-08-06T18:35:00.000Z',
      updatedAt: '2026-08-06T18:35:00.000Z',
      favorited: false,
      favoritesCount: 5,
      author: { username: 'ada', bio: 'Field recordist and essayist.', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ada', following: true },
    },
    {
      id: 'a-9',
      slug: 'migrating-a-monolith-without-a-freeze',
      title: 'Migrating a monolith without a freeze',
      description: 'Eighteen months, zero code freezes, one very long changelog.',
      body: 'The trick is that there is no trick — only a strangler fig and a lot of patience.',
      tagList: ['engineering'],
      createdAt: '2026-08-03T10:10:00.000Z',
      updatedAt: '2026-08-03T10:10:00.000Z',
      favorited: false,
      favoritesCount: 38,
      author: { username: 'priya', bio: 'Platform engineer. Recovering architect.', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=priya', following: false },
    },
    {
      id: 'a-10',
      slug: 'the-cost-of-a-cold-start',
      title: 'The cost of a cold start',
      description: 'Measuring what your users actually feel.',
      body: 'Percentiles lie unless you know which page they came from.',
      tagList: ['engineering', 'performance'],
      createdAt: '2026-07-30T09:00:00.000Z',
      updatedAt: '2026-07-30T09:00:00.000Z',
      favorited: false,
      favoritesCount: 21,
      author: { username: 'priya', bio: 'Platform engineer. Recovering architect.', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=priya', following: false },
    },
    {
      id: 'a-11',
      slug: 'nesting-season',
      title: 'Nesting season',
      description: 'Six weeks in a hide, and what the chicks taught me.',
      body: 'Patience is a skill you can practise deliberately.',
      tagList: ['nature', 'dragons'],
      createdAt: '2026-07-26T15:45:00.000Z',
      updatedAt: '2026-07-26T15:45:00.000Z',
      favorited: true,
      favoritesCount: 14,
      author: { username: 'ada', bio: 'Field recordist and essayist.', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ada', following: true },
    },
    {
      id: 'a-12',
      slug: 'writing-the-first-draft-badly',
      title: 'Writing the first draft badly, on purpose',
      description: 'Permission to be terrible is a productivity tool.',
      body: 'The blank page loses every time you agree, in advance, to write something bad.',
      tagList: ['writing', 'opinion'],
      createdAt: '2026-07-21T13:20:00.000Z',
      updatedAt: '2026-07-21T13:20:00.000Z',
      favorited: false,
      favoritesCount: 8,
      author: { username: 'marcus', bio: 'Building small things carefully.', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=marcus', following: true },
    },
  ]);

  tags = signal<Tag[]>([
    { name: 'dragons', count: 3 },
    { name: 'training', count: 2 },
    { name: 'engineering', count: 4 },
    { name: 'writing', count: 3 },
    { name: 'nature', count: 3 },
    { name: 'opinion', count: 3 },
    { name: 'testing', count: 1 },
    { name: 'performance', count: 1 },
  ]);

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

  readonly filtered = computed(() => {
    const tag = this.activeTag();
    const feed = this.activeFeed();
    return this.articles().filter((article) => {
      const tagMatches = !tag || article.tagList.includes(tag);
      const feedMatches = feed === 'global' || article.author.following;
      return tagMatches && feedMatches;
    });
  });

  readonly visible = computed(() => {
    const start = (this.currentPage() - 1) * PAGE_SIZE;
    return this.filtered().slice(start, start + PAGE_SIZE);
  });

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

  toggleFavorite(target: Article): void {
    this.articles.update((list) =>
      list.map((article) =>
        article.id === target.id
          ? {
              ...article,
              favorited: !article.favorited,
              favoritesCount: article.favoritesCount + (article.favorited ? -1 : 1),
            }
          : article,
      ),
    );
  }
}
