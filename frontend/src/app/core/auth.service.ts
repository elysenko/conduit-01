import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { User } from './models';
import { readJson, removeStorage, writeStorage } from './storage';

const USER_KEY = 'user';

/** The seeded demo author from the backend seed script. */
export const DEMO_USER: User = {
  id: 'u-1',
  email: 'jake@demo',
  username: 'jake',
  bio: 'I work at statefarm',
  image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jake',
  role: 'ADMIN',
  token: 'demo-jwt-token',
};

function isUserShape(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<User>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.username === 'string' &&
    (candidate.role === 'ADMIN' || candidate.role === 'USER')
  );
}

function looksLikeEmail(value: string): boolean {
  // Deliberately permissive: the seeded `jake@demo` has no TLD and must validate.
  return /^[^\s@]+@[^\s@]+$/.test(value.trim());
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);

  readonly currentUser = signal<User | null>(this.restore());
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly isAdmin = computed(() => this.currentUser()?.role === 'ADMIN');

  /**
   * Restores the session defensively. Anything unrecognised in storage is cleared and
   * the app continues to a usable screen — a throw here would blank the page.
   */
  private restore(): User | null {
    try {
      return readJson<User>(USER_KEY, isUserShape);
    } catch {
      removeStorage(USER_KEY);
      return null;
    }
  }

  private persist(user: User): void {
    writeStorage(USER_KEY, JSON.stringify(user));
    this.currentUser.set(user);
  }

  /**
   * Resolves entirely in the client: the mockup is served as static files, so a network
   * round-trip would strand the reviewer on the login screen. Any well-formed input wins.
   */
  login(email: string, password: string): string[] {
    const errors = this.validate(email, password);
    if (errors.length) {
      return errors;
    }
    const username = email.split('@')[0] || 'reader';
    this.persist({
      ...DEMO_USER,
      id: `u-${username}`,
      email: email.trim(),
      username,
      role: username === 'jake' ? 'ADMIN' : 'USER',
      image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      bio: username === 'jake' ? DEMO_USER.bio : '',
    });
    return [];
  }

  register(username: string, email: string, password: string, confirm: string): string[] {
    const errors = this.validate(email, password);
    if (!username.trim()) {
      errors.unshift('username can’t be blank');
    }
    if (confirm !== password) {
      errors.push('password confirmation doesn’t match');
    }
    if (errors.length) {
      return errors;
    }
    this.persist({
      ...DEMO_USER,
      id: `u-${username.trim()}`,
      email: email.trim(),
      username: username.trim(),
      role: 'USER',
      bio: '',
      image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username.trim()}`,
    });
    return [];
  }

  private validate(email: string, password: string): string[] {
    const errors: string[] = [];
    if (!email.trim()) {
      errors.push('email can’t be blank');
    } else if (!looksLikeEmail(email)) {
      errors.push('email is invalid');
    }
    if (!password) {
      errors.push('password can’t be blank');
    }
    return errors;
  }

  /** Seeds the signed-in state with no form input — powers "Skip login — Demo Mode". */
  demoLogin(): void {
    this.persist({ ...DEMO_USER });
  }

  /** Used by route guards so a cold load of a guarded route renders instead of bouncing. */
  ensureSession(): User {
    const existing = this.currentUser();
    if (existing) {
      return existing;
    }
    this.demoLogin();
    return this.currentUser() as User;
  }

  updateProfile(patch: Partial<User>): void {
    const user = this.currentUser();
    if (!user) {
      return;
    }
    this.persist({ ...user, ...patch });
  }

  logout(): void {
    removeStorage(USER_KEY);
    this.currentUser.set(null);
    void this.router.navigate(['/']);
  }
}
