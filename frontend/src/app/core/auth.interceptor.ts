import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

/**
 * Attaches the RealWorld-convention `Authorization: Token <jwt>` header.
 * The mockup makes no network calls, but the wiring is real so the service layer
 * only has to swap the data source.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).currentUser()?.token;
  if (!token) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { Authorization: `Token ${token}` } }));
};
