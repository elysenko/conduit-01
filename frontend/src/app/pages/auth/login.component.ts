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

  submit(): void {
    this.submitting.set(true);
    const { email, password } = this.form.getRawValue();
    const errors = this.auth.login(email, password);
    this.errors.set(errors);
    this.submitting.set(false);
    if (errors.length === 0) {
      this.redirect();
    }
  }

  /** Secondary shortcut: seeds the signed-in state with no input at all. */
  demoLogin(): void {
    this.auth.demoLogin();
    this.redirect();
  }

  private redirect(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    void this.router.navigateByUrl(returnUrl && returnUrl.startsWith('/') ? returnUrl : '/');
  }
}
