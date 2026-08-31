import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Profile } from '../../core/models';
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
  private readonly auth = inject(AuthService);

  readonly currentUser = this.auth.currentUser;
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  profiles = signal<Profile[]>([
    { username: 'jake', bio: 'I work at statefarm', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jake', following: false },
    { username: 'ada', bio: 'Field recordist and essayist. Six months in a rainforest, one microphone.', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ada', following: true },
    { username: 'marcus', bio: 'Building small things carefully.', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=marcus', following: true },
    { username: 'priya', bio: 'Platform engineer. Recovering architect.', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=priya', following: false },
  ]);

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  readonly username = computed(() => this.params().get('username') ?? '');

  /** Unknown usernames still render a reviewable profile rather than a dead end. */
  readonly profile = computed<Profile>(() => {
    const name = this.username();
    return (
      this.profiles().find((item) => item.username === name) ?? {
        username: name || 'reader',
        bio: '',
        image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name || 'reader'}`,
        following: false,
      }
    );
  });

  readonly isOwnProfile = computed(() => this.profile().username === this.currentUser()?.username);

  toggleFollow(): void {
    const name = this.profile().username;
    this.profiles.update((list) =>
      list.map((item) => (item.username === name ? { ...item, following: !item.following } : item)),
    );
  }
}
