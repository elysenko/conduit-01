import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService, apiErrors } from '../../core/api.service';

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
  private readonly api = inject(ApiService);

  readonly slug = this.route.snapshot.paramMap.get('slug');
  readonly isEdit = this.slug !== null;
  readonly errors = signal<string[]>([]);
  readonly saving = signal(false);
  readonly tags = signal<string[]>([]);
  readonly tagInput = signal('');

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    description: ['', [Validators.required]],
    body: ['', [Validators.required]],
  });

  readonly heading = computed(() => (this.isEdit ? 'Edit article' : 'New article'));

  constructor() {
    if (this.isEdit) {
      void this.loadDraft();
    }
  }

  private async loadDraft(): Promise<void> {
    const slug = this.slug;
    if (!slug) {
      return;
    }
    // The form is disabled while loading so a fast typist cannot have their input
    // overwritten by the response landing a moment later.
    this.form.disable({ emitEvent: false });
    try {
      const article = await this.api.getArticle(slug);
      this.form.patchValue({
        title: article.title,
        description: article.description,
        body: article.body,
      });
      this.tags.set([...article.tagList]);
    } catch (err) {
      this.errors.set(apiErrors(err, 'Could not load that article for editing.'));
    } finally {
      this.form.enable({ emitEvent: false });
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

  async publish(): Promise<void> {
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

    const payload = {
      title: value.title.trim(),
      description: value.description.trim(),
      body: value.body.trim(),
      tagList: this.tags(),
    };

    this.saving.set(true);
    try {
      // The server owns the slug — it re-slugs on a title change and appends a suffix
      // on collision — so navigate to whatever it returns, never to a guess.
      const saved =
        this.isEdit && this.slug
          ? await this.api.updateArticle(this.slug, payload)
          : await this.api.createArticle(payload);
      // Awaited, not fire-and-forget: keeping the navigation inside this async task
      // means Angular is not reported "stable" in the gap between the save resolving
      // and the route actually changing.
      await this.router.navigate(['/article', saved.slug]);
    } catch (err) {
      this.errors.set(apiErrors(err, 'Could not save the article.'));
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    if (this.isEdit && this.slug) {
      void this.router.navigate(['/article', this.slug]);
      return;
    }
    void this.router.navigate(['/']);
  }
}
