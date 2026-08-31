import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './auth.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly errors = signal<string[]>([]);
  readonly submitting = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['jake@demo', [Validators.required]],
    password: ['Demo1234!', [Validators.required]],
  });

  async submit(): Promise<void> {
    if (this.submitting()) {
      return;
    }
    this.submitting.set(true);
    try {
      const { email, password } = this.form.getRawValue();
      const errors = await this.auth.login(email, password);
      this.errors.set(errors);
      if (errors.length === 0) {
        await this.redirect();
      }
    } finally {
      this.submitting.set(false);
    }
  }

  /** Secondary shortcut: signs in as the seeded demo author against the real API. */
  async demoLogin(): Promise<void> {
    if (this.submitting()) {
      return;
    }
    this.submitting.set(true);
    try {
      const errors = await this.auth.demoLogin();
      this.errors.set(errors);
      if (errors.length === 0) {
        await this.redirect();
      }
    } finally {
      this.submitting.set(false);
    }
  }

  private async redirect(): Promise<void> {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    // Only same-app paths are honoured, so a crafted ?returnUrl= cannot bounce the
    // user to another origin after a successful sign-in.
    await this.router.navigateByUrl(
      returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/',
    );
  }
}
