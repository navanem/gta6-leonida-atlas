import { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import type { Backup } from '../../domain/types';
import { atlasRepository } from '../../db/repository';
import { MAX_BACKUP_BYTES, parseBackup } from '../../db/backup';
import { saveLocal, usePersistenceStore } from '../../stores/atlas';
import { Modal } from '../../app/Modal';

export default function BackupDialog({ onClose }: { onClose: () => void }) {
  const ready = usePersistenceStore((s) => s.ready);
  const [preview, setPreview] = useState<Backup | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function exportData() {
    try {
      const backup = await atlasRepository.exportBackup();
      const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `leonida-atlas-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Backup downloaded. Store it somewhere safe.');
    } catch {
      setError('Could not read local data for export. Retry after checking storage.');
    }
  }
  async function inspect(file: File | undefined) {
    setPreview(null);
    setError('');
    setMessage('');
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setError('This file exceeds the 10 MB backup limit.');
      return;
    }
    try {
      setPreview(parseBackup(JSON.parse(await file.text())));
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Invalid backup file. No data was changed.',
      );
    }
  }
  async function merge() {
    if (!preview) return;
    setBusy(true);
    const ok = await saveLocal(() => atlasRepository.importBackup(preview));
    setBusy(false);
    if (ok) {
      setPreview(null);
      setMessage('Backup merged. Your local data is saved.');
    } else setError('Import failed. Existing data is preserved. Retry after checking storage.');
  }
  return (
    <Modal title="Your local backup" onClose={onClose}>
      <p className="panel-intro">
        Export your favorites, collections, notes, markers and preferences. No account is needed.
      </p>
      <button className="button primary" disabled={!ready} onClick={() => void exportData()}>
        <Download size={18} />
        Export backup
      </button>
      <section className="detail-section">
        <label className="file-label" htmlFor="backup-file">
          <Upload size={18} />
          Import a backup
        </label>
        <input
          id="backup-file"
          type="file"
          accept=".json,application/json"
          disabled={!ready || busy}
          onChange={(e) => void inspect(e.target.files?.[0])}
        />
        <p className="help-text">
          Versioned JSON · up to 10 MB. Review the contents before merging. Existing entries are
          kept; newer matching entries are updated.
        </p>
      </section>
      {preview && (
        <section className="backup-preview" aria-label="Backup preview">
          <h3>Ready to merge</h3>
          <p>
            {preview.favorites.length} favorites · {preview.collections.length} collections ·{' '}
            {preview.notes.length} notes · {preview.markers.length} markers
          </p>
          <p className="help-text">
            Imported display preferences will replace current preferences.
          </p>
          <button className="button primary" disabled={busy} onClick={() => void merge()}>
            {busy ? 'Importing…' : 'Merge backup'}
          </button>
          <button className="text-button" onClick={() => setPreview(null)}>
            Cancel import
          </button>
        </section>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success-message" role="status">
          {message}
        </p>
      )}
    </Modal>
  );
}
