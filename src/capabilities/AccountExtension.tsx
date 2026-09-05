import { useCallback } from 'react';
import Extension from 'virtual:atlas-account';
import { useExtensionHost } from './extension-host';
import {
  deleteLocalWorkspace,
  exportWorkspaceBackup,
  importWorkspaceBackup,
  switchLocalWorkspace,
  usePersistenceStore,
  useWorkspaceStore,
} from '../stores/atlas';

export function AccountExtension() {
  const entryTarget = useExtensionHost((s) => s.entryTarget);
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const switching = useWorkspaceStore((s) => s.switching);
  const ready = usePersistenceStore((s) => s.ready);
  const exportBackup = useCallback(() => exportWorkspaceBackup(workspaceId), [workspaceId]);
  const importBackup = useCallback(
    (backup: unknown) => importWorkspaceBackup(workspaceId, backup),
    [workspaceId],
  );
  return (
    <Extension
      entryTarget={entryTarget}
      workspaceId={workspaceId}
      workspaceReady={ready && !switching}
      switchWorkspace={switchLocalWorkspace}
      deleteWorkspace={deleteLocalWorkspace}
      exportBackup={exportBackup}
      importBackup={importBackup}
    />
  );
}
