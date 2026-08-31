import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { UpdateUserInput } from '../../core/api.service';

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly currentUser = this.auth.currentUser;
  readonly isAdmin = this.auth.isAdmin;
  readonly errors = signal<string[]>([]);
  readonly saved = signal(false);

  readonly form = this.fb.nonNullable.group({
    image: [this.currentUser()?.image ?? ''],
    username: [this.currentUser()?.username ?? ''],
    bio: [this.currentUser()?.bio ?? ''],
    email: [this.currentUser()?.email ?? ''],
    password: [''],
  });

  constructor() {
    // The form is seeded from the cached session so it paints instantly, but AuthService
    // re-validates that cache against GET /api/user a moment later. Without this, a stale
    // cached username/email would be written straight back on save, silently reverting a
    // change made elsewhere. Only untouched controls are refreshed, so it can never
    // clobber what the user is currently typing.
    effect(() => {
      const user = this.currentUser();
      if (!user) {
        return;
      }
      const fresh = {
        image: user.image ?? '',
        username: user.username,
        bio: user.bio ?? '',
        email: user.email,
      };
      for (const [key, value] of Object.entries(fresh)) {
        const control = this.form.get(key);
        if (control?.pristine) {
          control.setValue(value, { emitEvent: false });
        }
      }
    });
  }

  async submit(): Promise<void> {
    const value = this.form.getRawValue();
    const errors: string[] = [];
    if (!value.username.trim()) {
      errors.push('username can’t be blank');
    }
    if (!value.email.trim()) {
      errors.push('email can’t be blank');
    }
    this.errors.set(errors);
    this.saved.set(false);
    if (errors.length) {
      return;
    }

    const patch: UpdateUserInput = {
      image: value.image.trim(),
      username: value.username.trim(),
      bio: value.bio.trim(),
      email: value.email.trim(),
    };
    // The password field is omitted unless filled in: the backend DTO treats an absent
    // password as "leave the stored hash untouched", and sending '' would be a 400.
    if (value.password) {
      patch.password = value.password;
    }

    const failures = await this.auth.updateProfile(patch);
    this.errors.set(failures);
    if (failures.length) {
      return;
    }
    this.form.patchValue({ password: '' });
    this.saved.set(true);
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/']);
  }
}
