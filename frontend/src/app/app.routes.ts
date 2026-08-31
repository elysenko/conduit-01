import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
    title: 'Conduit',
    data: { flow: 'home' },
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login.component').then((m) => m.LoginComponent),
    title: 'Sign in — Conduit',
    data: { flow: 'auth-login' },
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/auth/register.component').then((m) => m.RegisterComponent),
    title: 'Sign up — Conduit',
    data: { flow: 'auth-register' },
  },
  { path: 'signup', redirectTo: 'register', pathMatch: 'full' },
  {
    path: 'article/:slug',
    loadComponent: () =>
      import('./pages/article/article.component').then((m) => m.ArticleComponent),
    title: 'Article — Conduit',
    data: { flow: 'article-read' },
  },
  {
    path: 'editor',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/editor/editor.component').then((m) => m.EditorComponent),
    title: 'New Article — Conduit',
    data: { flow: 'article-create' },
  },
  {
    path: 'editor/:slug',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/editor/editor.component').then((m) => m.EditorComponent),
    title: 'Edit Article — Conduit',
    data: { flow: 'article-edit' },
  },
  {
    path: 'profile/:username',
    loadComponent: () =>
      import('./pages/profile/profile.component').then((m) => m.ProfileComponent),
    title: 'Profile — Conduit',
    data: { flow: 'profile' },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/profile/profile-articles.component').then(
            (m) => m.ProfileArticlesComponent,
          ),
        data: { flow: 'profile-articles', favorites: false },
      },
      {
        path: 'favorites',
        loadComponent: () =>
          import('./pages/profile/profile-articles.component').then(
            (m) => m.ProfileArticlesComponent,
          ),
        data: { flow: 'profile-favorites', favorites: true },
      },
    ],
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/settings/settings.component').then((m) => m.SettingsComponent),
    title: 'Settings — Conduit',
    data: { flow: 'settings' },
  },
  {
    path: 'admin/settings',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/admin/settings.component').then((m) => m.AdminSettingsComponent),
    title: 'Service settings — Conduit',
    data: { flow: 'admin-settings' },
  },
  { path: '**', redirectTo: '' },
];
