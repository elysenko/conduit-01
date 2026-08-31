import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Profile } from '../../core/models';
import { ApiService, apiErrorMessage, avatarFor } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { FollowButtonComponent } from '../../shared/follow-button.component';

@Component({
  selector: 'app-profile',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, FollowButtonComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);

  readonly currentUser = this.auth.currentUser;
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private readonly loaded = signal<Profile | null>(null);

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  readonly username = computed(() => this.params().get('username') ?? '');

  /**
   * The banner renders unconditionally, so this never returns null: while the request
   * is in flight (or if the username is unknown) it falls back to a placeholder built
   * from the route param, which keeps the header stable instead of collapsing.
   */
  readonly profile = computed<Profile>(() => {
    const loaded = this.loaded();
    if (loaded) {
      return loaded;
    }
    const name = this.username() || 'reader';
    return { username: name, bio: '', image: avatarFor(name), following: false };
  });

  readonly isOwnProfile = computed(() => this.profile().username === this.currentUser()?.username);

  private requestId = 0;

  constructor() {
    effect(() => {
      const name = this.username();
      void this.load(name);
    });
  }

  private async load(username: string): Promise<void> {
    const id = ++this.requestId;
    if (!username) {
      this.loaded.set(null);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const profile = await this.api.getProfile(username);
      if (id !== this.requestId) {
        return;
      }
      this.loaded.set(profile);
    } catch (err) {
      if (id !== this.requestId) {
        return;
      }
      this.loaded.set(null);
      const status = (err as { status?: number } | null)?.status;
      this.error.set(status === 404 ? null : apiErrorMessage(err, 'Could not load this profile.'));
    } finally {
      if (id === this.requestId) {
        this.loading.set(false);
      }
    }
  }

  async toggleFollow(): Promise<void> {
    const current = this.loaded();
    if (!current) {
      return;
    }
    if (!this.auth.isAuthenticated()) {
      await this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    const next = !current.following;
    this.loaded.set({ ...current, following: next });
    try {
      this.loaded.set(await this.api.followProfile(current.username, next));
    } catch {
      this.loaded.set(current);
    }
  }
}
