import type { Backup } from '../domain/types';

export interface Session {
  userId: string;
  displayName: string;
}
export interface AuthProvider {
  enabled: boolean;
  getSession(): Promise<Session | null>;
  signIn?(): Promise<void>;
  signOut?(): Promise<void>;
}
export interface UserProvider {
  getProfile(): Promise<{ id: string; displayName: string } | null>;
}
export interface SyncProvider {
  enabled: boolean;
  sync(backup?: Backup): Promise<{ status: 'disabled' | 'synced' | 'offline'; backup?: Backup }>;
}
export interface Capabilities {
  auth: AuthProvider;
  user: UserProvider;
  sync: SyncProvider;
}

export function createGuestCapabilities(): Capabilities {
  return {
    auth: { enabled: false, getSession: async () => null },
    user: { getProfile: async () => null },
    sync: { enabled: false, sync: async () => ({ status: 'disabled' }) },
  };
}

/** Private builds may supply a bundled factory. Public defaults never discover endpoints. */
export async function resolveCapabilities(
  factory?: () => Promise<Capabilities>,
): Promise<Capabilities> {
  if (!factory) return createGuestCapabilities();
  try {
    return await factory();
  } catch {
    return createGuestCapabilities();
  }
}
