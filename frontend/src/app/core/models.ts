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
}
