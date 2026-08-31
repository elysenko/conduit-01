import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@prisma/client';

export const ROLES_KEY = 'conduit:roles';

/** Restricts a handler (or whole controller) to the listed roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
