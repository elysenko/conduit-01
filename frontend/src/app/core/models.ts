/** Shapes mirror the backend DTO envelopes described in the Surface contract. */

export type UserRole = 'ADMIN' | 'USER';

export interface User {
  id: string;
  email: string;
  username: string;
  bio: string;
  image: string;
  role: UserRole;
  token: string;
}

export interface Profile {
  username: string;
  bio: string;
  image: string;
  following: boolean;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  tagList: string[];
  createdAt: string;
  updatedAt: string;
  favorited: boolean;
  favoritesCount: number;
  author: Profile;
}

export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  /** Present on the API payload; unused by the templates but kept for round-tripping. */
  updatedAt?: string;
  author: Profile;
}

export interface Tag {
  name: string;
  count: number;
}

export interface SystemSettingView {
  service: string;
  label: string;
  description: string;
  configured: boolean;
  fields: SystemSettingField[];
}

export interface SystemSettingField {
  key: string;
  label: string;
  value: string;
  secret: boolean;
  placeholder: string;
  /**
   * Which layer supplied the effective value: an env var, a `SystemSetting` row, or
   * nothing. Env-provisioned fields cannot be overridden by a PATCH, so the client uses
   * this to avoid sending edits that the resolver would ignore.
   */
  source?: 'env' | 'db' | null;
}
