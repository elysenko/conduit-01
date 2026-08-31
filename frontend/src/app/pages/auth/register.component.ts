import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './auth.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly errors = signal<string[]>([]);
  readonly submitting = signal(false);

  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    email: ['', [Validators.required]],
    password: ['', [Validators.required]],
    confirmPassword: ['', [Validators.required]],
  });

  async submit(): Promise<void> {
    if (this.submitting()) {
      return;
    }
    this.submitting.set(true);
    try {
      const { username, email, password, confirmPassword } = this.form.getRawValue();
      const errors = await this.auth.register(username, email, password, confirmPassword);
      this.errors.set(errors);
      if (errors.length === 0) {
        await this.router.navigate(['/']);
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
