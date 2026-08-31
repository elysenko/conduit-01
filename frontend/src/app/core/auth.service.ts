import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService, UpdateUserInput, apiErrors } from './api.service';
import { User } from './models';
import { readJson, removeStorage, writeStorage } from './storage';

const USER_KEY = 'user';

/** Credentials created by backend/prisma/seed/seed.js. Used by the "Demo Mode" shortcut. */
export const DEMO_CREDENTIALS = { email: 'jake@demo', password: 'Demo1234!' } as const;

function isUserShape(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<User>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.username === 'string' &&
    typeof candidate.token === 'string' &&
    (candidate.role === 'ADMIN' || candidate.role === 'USER')
  );
}

/** Read by the HTTP interceptor without constructing this service (avoids a DI cycle). */
export function readStoredToken(): string | null {
  const user = readJson<User>(USER_KEY, isUserShape);
  return user?.token ?? null;
}

export function clearStoredUser(): void {
  removeStorage(USER_KEY);
}

/**
 * Session state, backed by the live NestJS auth endpoints.
 *
 * The JWT is the only thing that actually authenticates a request; the cached `User`
 * exists so the header renders the signed-in state on the first paint instead of
 * flickering through the signed-out shell while `GET /api/user` is in flight.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly currentUser = signal<User | null>(this.restore());
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly isAdmin = computed(() => this.currentUser()?.role === 'ADMIN');

  constructor() {
    // Re-validate the cached session against the API. A token that has expired or was
    // issued by a previous deployment is dropped here rather than surfacing as a
    // confusing 401 on the user's first action.
    void this.hydrate();
  }

  /**
   * Restores defensively. Anything unrecognised in storage is cleared and the app
   * continues to a usable screen — a throw here would blank the page.
   */
  private restore(): User | null {
    try {
      return readJson<User>(USER_KEY, isUserShape);
    } catch {
      clearStoredUser();
      return null;
    }
  }

  private persist(user: User): void {
    writeStorage(USER_KEY, JSON.stringify(user));
    this.currentUser.set(user);
  }

  /** Refreshes the cached profile from `GET /api/user`, keeping the stored token. */
  async hydrate(): Promise<void> {
    const cached = this.currentUser();
    if (!cached) {
      return;
    }
    try {
      const fresh = await this.api.currentUser();
      // `GET /api/user` re-issues a token; fall back to the stored one if it does not.
      this.persist({ ...fresh, token: fresh.token || cached.token });
    } catch {
      // 401 (expired/invalid) or the API being briefly unreachable both land here.
      // Dropping the session is the safe read: the guards will ask for a fresh sign-in.
      this.clear();
    }
  }

  /** Returns [] on success, or the API's validation/authentication messages. */
  async login(email: string, password: string): Promise<string[]> {
    const local = this.validate(email, password);
    if (local.length) {
      return local;
    }
    try {
      this.persist(await this.api.login(email.trim(), password));
      return [];
    } catch (error) {
      return apiErrors(error, 'email or password is invalid');
    }
  }

  async register(
    username: string,
    email: string,
    password: string,
    confirm: string,
  ): Promise<string[]> {
    const local = this.validate(email, password);
    if (!username.trim()) {
      local.unshift('username can’t be blank');
    }
    if (confirm !== password) {
      local.push('password confirmation doesn’t match');
    }
    if (local.length) {
      return local;
    }
    try {
      this.persist(await this.api.register(username.trim(), email.trim(), password));
      return [];
    } catch (error) {
      return apiErrors(error, 'registration failed');
    }
  }

  /** Persists profile edits through `PUT /api/user`. Returns [] on success. */
  async updateProfile(patch: UpdateUserInput): Promise<string[]> {
    if (!this.currentUser()) {
      return ['You need to be signed in to update your settings.'];
    }
    try {
      const updated = await this.api.updateUser(patch);
      this.persist({ ...updated, token: updated.token || (this.currentUser() as User).token });
      return [];
    } catch (error) {
      return apiErrors(error, 'could not save your settings');
    }
  }

  /**
   * Client-side pre-checks that mirror the server DTOs, so the obvious mistakes are
   * caught without a round trip. Deliberately permissive on the email shape: the seeded
   * `jake@demo` has no TLD and the backend accepts it (`@IsEmail({ require_tld: false })`).
   */
  private validate(email: string, password: string): string[] {
    const errors: string[] = [];
    if (!email.trim()) {
      errors.push('email can’t be blank');
    } else if (!/^[^\s@]+@[^\s@]+$/.test(email.trim())) {
      errors.push('email is invalid');
    }
    if (!password) {
      errors.push('password can’t be blank');
    }
    return errors;
  }

  /** Secondary shortcut on the sign-in screen: a real login as the seeded demo author. */
  async demoLogin(): Promise<string[]> {
    return this.login(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password);
  }

  /** Drops the session without navigating — used by the 401 interceptor path. */
  clear(): void {
    clearStoredUser();
    this.currentUser.set(null);
  }

  logout(): void {
    this.clear();
    void this.router.navigate(['/']);
  }
}
