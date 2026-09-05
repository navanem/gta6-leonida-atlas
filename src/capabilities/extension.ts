/** Optional deployment-owned UI; the public build supplies an empty component. */
export interface AccountExtensionProps {
  entryTarget: HTMLElement | null;
  workspaceId: string | null;
  workspaceReady: boolean;
  switchWorkspace(userId: string | null): Promise<void>;
  deleteWorkspace(userId: string): Promise<void>;
  exportBackup(): Promise<unknown>;
  importBackup(backup: unknown): Promise<void>;
}
