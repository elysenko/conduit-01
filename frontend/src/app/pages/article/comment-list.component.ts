import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Comment } from '../../core/models';
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

  @Input({ required: true }) articleSlug = '';

  readonly currentUser = this.auth.currentUser;
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  comments = signal<Comment[]>([
    {
      id: 'c-1',
      body: 'The recall whistle tip alone was worth the read. Three notes, every time — it works.',
      createdAt: '2026-08-25T10:02:00.000Z',
      author: { username: 'ada', bio: 'Field recordist and essayist.', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ada', following: true },
    },
    {
      id: 'c-2',
      body: 'Week one being "sit there and do nothing" is the part everyone skips, and then wonders why week three goes badly.',
      createdAt: '2026-08-25T14:31:00.000Z',
      author: { username: 'marcus', bio: 'Building small things carefully.', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=marcus', following: true },
    },
    {
      id: 'c-3',
      body: 'Glad this landed. Happy to answer questions in the replies.',
      createdAt: '2026-08-26T08:15:00.000Z',
      author: { username: 'jake', bio: 'I work at statefarm', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jake', following: false },
    },
  ]);

  readonly form = this.fb.nonNullable.group({
    body: ['', [Validators.required]],
  });

  readonly canSubmit = computed(() => this.isAuthenticated());

  post(): void {
    const body = this.form.getRawValue().body.trim();
    const user = this.currentUser();
    if (!body || !user) {
      return;
    }
    this.comments.update((list) => [
      ...list,
      {
        id: `c-${list.length + 1}-${body.length}`,
        body,
        createdAt: new Date().toISOString(),
        author: {
          username: user.username,
          bio: user.bio,
          image: user.image,
          following: false,
        },
      },
    ]);
    this.form.reset({ body: '' });
  }

  isOwn(comment: Comment): boolean {
    return comment.author.username === this.currentUser()?.username;
  }

  remove(comment: Comment): void {
    this.comments.update((list) => list.filter((item) => item.id !== comment.id));
  }
}
