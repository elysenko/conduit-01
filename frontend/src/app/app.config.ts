import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideProtractorTestingSupport } from '@angular/platform-browser';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Hash routing keeps every screen deep-linkable on a plain static host and behind
    // NestJS's ServeStaticModule, neither of which has an SPA fallback for deep paths.
    provideRouter(routes, withComponentInputBinding(), withHashLocation()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    // Publishes `window.getAllAngularTestabilities()`. Angular does NOT expose it in a
    // production build by default, and it is the documented readiness signal for this
    // stack (colossus.stack.json -> frontend.browser_verify.wait_strategy), because this
    // SPA is hash-routed and polls the API, so `networkidle` never fires. Without this,
    // any harness following that strategy waits forever against the deployed bundle.
    provideProtractorTestingSupport(),
  ],
};
