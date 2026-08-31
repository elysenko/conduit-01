import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Preview contract: a cold load of a guarded route RENDERS that route rather than
 * redirecting to /login. The guard seeds a demo session and always returns true, so it
 * can never enter a guard/shell redirect loop.
 */
export const authGuard: CanActivateFn = () => {
  inject(AuthService).ensureSession();
  return true;
};

/** Admin routes behave the same way, but promote the seeded session to ADMIN. */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  auth.ensureSession();
  if (!auth.isAdmin()) {
    auth.updateProfile({ role: 'ADMIN' });
  }
  return true;
};
