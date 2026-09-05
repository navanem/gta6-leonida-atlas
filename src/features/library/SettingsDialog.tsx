import { useState } from 'react';
import { atlasRepository } from '../../db/repository';
import { saveLocal, usePersistenceStore, useUserStore } from '../../stores/atlas';
import { Modal } from '../../app/Modal';

export default function SettingsDialog({ onClose }: { onClose: () => void }) {
  const preferences = useUserStore((s) => s.preferences);
  const ready = usePersistenceStore((s) => s.ready);
  const [storageMessage, setStorageMessage] = useState('');
  return (
    <Modal title="Atlas settings" onClose={onClose}>
      <div className="settings-list">
        {(
          [
            {
              key: 'showLabels',
              title: 'Map labels',
              description: 'Show place names when zoomed in.',
            },
            {
              key: 'clusterMarkers',
              title: 'Group nearby markers',
              description: 'Cluster points to keep dense areas readable.',
            },
            {
              key: 'reducedMotion',
              title: 'Reduce motion',
              description: 'Use immediate map movements and quiet transitions.',
            },
          ] as const
        ).map((option) => (
          <label className="setting-row" key={option.key}>
            <span>
              {option.title}
              <small>{option.description}</small>
            </span>
            <input
              type="checkbox"
              disabled={!ready}
              checked={preferences[option.key]}
              onChange={(e) => {
                const checked = e.currentTarget.checked;
                void saveLocal(() =>
                  atlasRepository.savePreferences({
                    ...useUserStore.getState().preferences,
                    [option.key]: checked,
                  }),
                );
              }}
            />
          </label>
        ))}
      </div>
      <section className="detail-section">
        <h3>Storage on this device</h3>
        <p className="help-text">
          Your browser stores personal data in IndexedDB. Backups protect your work if browser data
          is cleared. The map and app can reopen offline after the first complete load; 3D textures
          are cached as you explore.
        </p>
        <button
          className="button"
          disabled={!ready}
          onClick={async () => {
            const persisted = await atlasRepository.requestPersistence();
            setStorageMessage(
              persisted
                ? 'Persistent storage is enabled.'
                : 'Your browser did not grant persistent storage. Local saves still work; keep an exported backup.',
            );
          }}
        >
          Protect local storage
        </button>
        {storageMessage && (
          <p role="status" className="help-text">
            {storageMessage}
          </p>
        )}
      </section>
      <section className="detail-section">
        <h3>Keyboard</h3>
        <p className="help-text">
          / to search · Escape to close the selected place or cancel placement · arrow keys to pan
          the focused map · + / − to zoom. Use the marker coordinate form to place a point without a
          mouse.
        </p>
      </section>
    </Modal>
  );
}
