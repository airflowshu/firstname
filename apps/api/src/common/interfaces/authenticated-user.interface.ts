import { PlatformRole, UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  sub: string;
  username: string;
  phone?: string | null;
  displayName?: string | null;
  platformRole: PlatformRole;
  activeFamilyId?: string | null;
  familyRole?: UserRole | null;
  role: UserRole;
  tokenVersion: number;
}
