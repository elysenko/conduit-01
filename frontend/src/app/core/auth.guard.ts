import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Guards the authenticated routes (/editor, /editor/:slug, /settings).
 *
 * Now that the SPA talks to the live API, letting an anonymous visitor into the editor
 * would only produce a 401 on publish. Redirecting to /login carries the intended
 * destination in `returnUrl` so the sign-in flow lands where the user was headed.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Admin-only routes. Anonymous users sign in; signed-in non-admins go home. */
export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
  return auth.isAdmin() ? true : router.createUrlTree(['/']);
};
