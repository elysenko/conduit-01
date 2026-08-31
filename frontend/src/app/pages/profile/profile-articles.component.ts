import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Article } from '../../core/models';
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

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  articles = signal<Article[]>([
    {
      id: 'a-1',
      slug: 'how-to-train-your-dragon',
      title: 'How to train your dragon',
      description: 'Ever wonder how?',
      body: 'It takes a Jacobian.',
      tagList: ['dragons', 'training'],
      createdAt: '2026-08-24T09:12:00.000Z',
      updatedAt: '2026-08-24T09:12:00.000Z',
      favorited: true,
      favoritesCount: 32,
      author: { username: 'jake', bio: 'I work at statefarm', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jake', following: false },
    },
    {
      id: 'a-4',
      slug: 'dragons-of-the-northern-reach',
      title: 'Dragons of the northern reach',
      description: 'A field guide to the six species you are most likely to meet.',
      body: 'The northern reach hosts six recognised species.',
      tagList: ['dragons', 'nature'],
      createdAt: '2026-08-18T08:30:00.000Z',
      updatedAt: '2026-08-18T08:30:00.000Z',
      favorited: false,
      favoritesCount: 9,
      author: { username: 'jake', bio: 'I work at statefarm', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jake', following: false },
    },
    {
      id: 'a-6',
      slug: 'training-notes-week-one',
      title: 'Training notes: week one',
      description: 'What actually happened, minus the highlight reel.',
      body: 'Day one was a disaster. Day four was quietly excellent.',
      tagList: ['training', 'writing'],
      createdAt: '2026-08-12T07:50:00.000Z',
      updatedAt: '2026-08-12T07:50:00.000Z',
      favorited: true,
      favoritesCount: 12,
      author: { username: 'jake', bio: 'I work at statefarm', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jake', following: false },
    },
    {
      id: 'a-3',
      slug: 'why-your-tests-are-slow',
      title: 'Why your tests are slow (and what to do about it)',
      description: 'Ten minutes of CI is ten minutes of nobody shipping.',
      body: 'Most slow suites are slow for one of three reasons.',
      tagList: ['engineering', 'testing'],
      createdAt: '2026-08-20T11:05:00.000Z',
      updatedAt: '2026-08-20T11:05:00.000Z',
      favorited: true,
      favoritesCount: 47,
      author: { username: 'ada', bio: 'Field recordist and essayist.', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ada', following: true },
    },
  ]);

  private readonly data = toSignal(this.route.data, { initialValue: this.route.snapshot.data });
  private readonly parentParams = toSignal(
    this.route.parent?.paramMap ?? this.route.paramMap,
    { initialValue: this.route.parent?.snapshot.paramMap ?? this.route.snapshot.paramMap },
  );

  readonly showFavorites = computed(() => this.data()['favorites'] === true);
  readonly username = computed(() => this.parentParams().get('username') ?? '');

  readonly visible = computed(() => {
    const list = this.articles();
    if (this.showFavorites()) {
      return list.filter((article) => article.favorited);
    }
    return list.filter((article) => article.author.username === this.username());
  });

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
