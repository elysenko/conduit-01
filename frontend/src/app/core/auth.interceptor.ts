import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_BASE } from './api.service';
import { AuthService, readStoredToken } from './auth.service';

/** True for calls aimed at our own API — third-party URLs must never see the token. */
function isApiRequest(url: string): boolean {
  return url.startsWith(API_BASE) || url.startsWith(`${window.location.origin}${API_BASE}`);
}

/**
 * Attaches the RealWorld-convention `Authorization: Token <jwt>` header (the backend's
 * JWT extractor accepts both `Token` and `Bearer`) and turns an expired session into a
 * clean sign-in prompt instead of a wall of 401s.
 *
 * The token is read straight from storage rather than from AuthService: AuthService
 * depends on ApiService, which depends on HttpClient, so injecting it eagerly here
 * would close a DI cycle. The service is only resolved lazily, on the 401 path, by
 * which point it is guaranteed to be constructible.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);
  const token = isApiRequest(req.url) ? readStoredToken() : null;

  const authorized = token
    ? req.clone({ setHeaders: { Authorization: `Token ${token}` } })
    : req;

  return next(authorized).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && token) {
        injector.get(AuthService).clear();
        // The login and register endpoints answer 401 for bad credentials; bouncing
        // the user off those screens would hide the error message they need to read.
        if (!/\/users(\/login)?$/.test(req.url)) {
          const returnUrl = injector.get(Router).url;
          void injector.get(Router).navigate(['/login'], { queryParams: { returnUrl } });
        }
      }
      return throwError(() => error);
    }),
  );
};
