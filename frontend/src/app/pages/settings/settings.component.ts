import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

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

  submit(): void {
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
    this.auth.updateProfile({
      image: value.image.trim(),
      username: value.username.trim(),
      bio: value.bio.trim(),
      email: value.email.trim(),
    });
    this.form.patchValue({ password: '' });
    this.saved.set(true);
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/']);
  }
}
