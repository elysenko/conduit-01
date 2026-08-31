import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Comment } from '../../core/models';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-comment-list',
  imports: [ReactiveFormsModule, RouterLink, DatePipe],
  templateUrl: './comment-list.component.html',
  styleUrl: './comment-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentListComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);

  private slug = '';

  /**
   * Setter rather than a plain field: the parent swaps the slug when the router reuses
   * this component for a different article, and the thread has to reload with it.
   */
  @Input({ required: true })
  set articleSlug(value: string) {
    if (value === this.slug) {
      return;
    }
    this.slug = value;
    void this.load();
  }
  get articleSlug(): string {
    return this.slug;
  }

  readonly currentUser = this.auth.currentUser;
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly comments = signal<Comment[]>([]);

  readonly form = this.fb.nonNullable.group({
    body: ['', [Validators.required]],
  });

  readonly canSubmit = computed(() => this.isAuthenticated());

  private requestId = 0;

  private async load(): Promise<void> {
    const id = ++this.requestId;
    const slug = this.slug;
    if (!slug) {
      this.comments.set([]);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const comments = await this.api.listComments(slug);
      if (id !== this.requestId) {
        return;
      }
      this.comments.set(comments);
    } catch (err) {
      if (id !== this.requestId) {
        return;
      }
      this.comments.set([]);
      this.error.set(apiErrorMessage(err, 'Could not load comments.'));
    } finally {
      if (id === this.requestId) {
        this.loading.set(false);
      }
    }
  }

  async post(): Promise<void> {
    const body = this.form.getRawValue().body.trim();
    if (!body || !this.currentUser() || !this.slug) {
      return;
    }
    this.error.set(null);
    try {
      const created = await this.api.addComment(this.slug, body);
      this.comments.update((list) => [...list, created]);
      this.form.reset({ body: '' });
    } catch (err) {
      this.error.set(apiErrorMessage(err, 'Could not post your comment.'));
    }
  }

  isOwn(comment: Comment): boolean {
    return comment.author.username === this.currentUser()?.username;
  }

  async remove(comment: Comment): Promise<void> {
    const previous = this.comments();
    this.comments.update((list) => list.filter((item) => item.id !== comment.id));
    try {
      await this.api.deleteComment(this.slug, comment.id);
    } catch (err) {
      // Put it back: the delete was rejected (403 when it is not the caller's comment).
      this.comments.set(previous);
      this.error.set(apiErrorMessage(err, 'Could not delete that comment.'));
    }
  }
}
