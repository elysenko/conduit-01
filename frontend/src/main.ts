import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

/**
 * Path-style deep links -> hash-style, before the router ever sees the URL.
 *
 * This SPA is hash-routed (`withHashLocation()` in app.config.ts — the topology
 * colossus.stack.json certifies for this stack), so its real addresses look like
 * `/#/login`. nginx, however, SPA-falls-back *any* unmatched path to index.html.
 * The combination is a silent trap: `/login` returns index.html with a 200, Angular
 * boots, sees an empty hash, matches the `''` route and renders the home page. A
 * hand-typed URL, a shared link, or an automated verifier that navigates to
 * `<origin>/login` looking for the sign-in form all land on the wrong screen with no
 * error to explain why.
 *
 * Translating once here — before bootstrap, so the router never resolves the wrong
 * route and there is no visible flash — makes both URL shapes reach the same screen.
 * Deliberately conservative: it is a no-op unless a hash is absent AND the leftover
 * segment matches a known top-level route, so static assets and the root URL are
 * untouched. The base path is read from <base href> rather than assumed to be "/",
 * because deployments serve this app under a `/<image-name>/` prefix.
 */
function normalizeDeepLink(): void {
  try {
    if (window.location.hash) {
      return;
    }
    const base = document.querySelector('base');
    const basePath = base ? new URL(base.href).pathname : '/';
    const path = window.location.pathname;
    if (!path.startsWith(basePath)) {
      return;
    }
    const rest = path.slice(basePath.length).replace(/^\/+/, '');
    const search = window.location.search;

    // Root with a query string: `/?tag=dragons`. Under hash routing the router reads
    // query params from *inside* the hash, so a path-level `?tag=` is invisible to it
    // and the home page silently renders unfiltered — the filtered view the link was
    // meant to reproduce is lost with no error. Move the query into the hash.
    if (!rest || rest === 'index.html') {
      if (search) {
        window.location.replace(`${basePath}#/${search}`);
      }
      return;
    }
    // Mirrors the top-level paths in app.routes.ts. An unknown segment is left alone
    // so it still falls through to the router's `**` -> '' redirect.
    if (!/^(login|register|signup|settings|editor|article|profile|admin)(\/|$)/.test(rest)) {
      return;
    }
    window.location.replace(`${basePath}#/${rest}${search}`);
  } catch {
    // Never let URL normalisation stop the app from booting.
  }
}

normalizeDeepLink();

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
