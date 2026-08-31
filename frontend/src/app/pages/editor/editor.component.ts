import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Article } from '../../core/models';

/** One reactive form serves both /editor (create) and /editor/:slug (edit). */
@Component({
  selector: 'app-editor',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './editor.component.html',
  styleUrl: './editor.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly slug = this.route.snapshot.paramMap.get('slug');
  readonly isEdit = this.slug !== null;
  readonly errors = signal<string[]>([]);
  readonly saving = signal(false);
  readonly tags = signal<string[]>([]);
  readonly tagInput = signal('');

  drafts = signal<Article[]>([
    {
      id: 'a-1',
      slug: 'how-to-train-your-dragon',
      title: 'How to train your dragon',
      description: 'Ever wonder how?',
      body: 'It takes a Jacobian.\n\nDragons respond to consistency far more than to force. Start with short sessions, keep the reward immediate, and never end a session on a failure.',
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
      body: 'The northern reach hosts six recognised species, three of which are docile enough to approach on foot.',
      tagList: ['dragons', 'nature'],
      createdAt: '2026-08-18T08:30:00.000Z',
      updatedAt: '2026-08-18T08:30:00.000Z',
      favorited: false,
      favoritesCount: 9,
      author: { username: 'jake', bio: 'I work at statefarm', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jake', following: false },
    },
  ]);

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    description: ['', [Validators.required]],
    body: ['', [Validators.required]],
  });

  readonly heading = computed(() => (this.isEdit ? 'Edit article' : 'New article'));

  constructor() {
    if (this.isEdit) {
      const existing = this.drafts().find((article) => article.slug === this.slug);
      if (existing) {
        this.form.patchValue({
          title: existing.title,
          description: existing.description,
          body: existing.body,
        });
        this.tags.set([...existing.tagList]);
      }
    }
  }

  addTag(): void {
    const value = this.tagInput().trim().toLowerCase();
    if (!value || this.tags().includes(value)) {
      this.tagInput.set('');
      return;
    }
    this.tags.update((list) => [...list, value]);
    this.tagInput.set('');
  }

  onTagInput(event: Event): void {
    this.tagInput.set((event.target as HTMLInputElement).value);
  }

  removeTag(tag: string): void {
    this.tags.update((list) => list.filter((item) => item !== tag));
  }

  private slugify(title: string): string {
    return (
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'untitled'
    );
  }

  publish(): void {
    const value = this.form.getRawValue();
    const errors: string[] = [];
    if (!value.title.trim()) {
      errors.push('title can’t be blank');
    }
    if (!value.description.trim()) {
      errors.push('description can’t be blank');
    }
    if (!value.body.trim()) {
      errors.push('body can’t be blank');
    }
    this.errors.set(errors);
    if (errors.length) {
      return;
    }
    this.saving.set(true);
    const nextSlug = this.isEdit && this.slug ? this.slug : this.slugify(value.title);
    void this.router.navigate(['/article', nextSlug]);
  }

  cancel(): void {
    if (this.isEdit && this.slug) {
      void this.router.navigate(['/article', this.slug]);
      return;
    }
    void this.router.navigate(['/']);
  }
}
