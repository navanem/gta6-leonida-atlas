import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import {
  analyticsAvailable,
  getAnalyticsConsent,
  setAnalyticsConsent,
  subscribeAnalyticsConsent,
} from './analytics';
import { projectPath } from '../features/explorer/public-path';
import './analytics-consent.css';

function useConsent() {
  return useSyncExternalStore(subscribeAnalyticsConsent, getAnalyticsConsent, () => 'unknown');
}

function Choices({ consent, beforeChoose }: { consent: string; beforeChoose?: () => void }) {
  function choose(value: 'granted' | 'denied') {
    beforeChoose?.();
    setAnalyticsConsent(value);
  }
  return (
    <div
      className="analytics-choices"
      onKeyDown={(event) => {
        // Global 3D shortcuts must leave native button activation to the browser.
        if (event.key !== 'Escape') event.stopPropagation();
      }}
    >
      <button type="button" aria-pressed={consent === 'denied'} onClick={() => choose('denied')}>
        {consent === 'denied' ? 'Analytics declined' : 'Decline analytics'}
      </button>
      <button type="button" aria-pressed={consent === 'granted'} onClick={() => choose('granted')}>
        {consent === 'granted' ? 'Analytics allowed' : 'Allow analytics'}
      </button>
    </div>
  );
}

export function AnalyticsConsent() {
  const consent = useConsent();
  const notice = useRef<HTMLElement>(null);
  const restoreFocus = useRef(false);
  useLayoutEffect(() => {
    if (consent === 'unknown' || !restoreFocus.current) return;
    restoreFocus.current = false;
    const preference = document.querySelector<HTMLElement>(
      '#analytics-preferences button[aria-pressed="true"]',
    );
    const destination =
      preference ??
      document.querySelector<HTMLElement>(
        'main button:not(:disabled), main a[href], main input:not(:disabled), .explorer-view button:not(:disabled)',
      );
    destination?.focus();
  }, [consent]);
  if (!analyticsAvailable() || consent !== 'unknown') return null;
  return (
    <section ref={notice} className="analytics-notice" aria-labelledby="analytics-notice-title">
      <h2 id="analytics-notice-title">Help us understand visits</h2>
      <p>
        Allow Google Analytics to count visits using a random browser ID? Your account, notes,
        favorites and searches stay out of Analytics. You can change your choice in{' '}
        <a href={`${projectPath('about')}#analytics-preferences`}>About</a>.
      </p>
      <Choices
        consent={consent}
        beforeChoose={() => {
          restoreFocus.current = Boolean(notice.current?.contains(document.activeElement));
        }}
      />
    </section>
  );
}

export function AnalyticsPreferences() {
  const consent = useConsent();
  if (!analyticsAvailable()) return null;
  return (
    <section className="project-section" id="analytics-preferences" tabIndex={-1}>
      <h2>Audience measurement</h2>
      <p>
        Google Analytics counts visits and returning browsers only after you allow it. A random
        browser ID is saved on this device, separately from your Atlas account. Advertising features
        stay off. Account details, notes, favorites, searches and personal locations are never sent
        to Analytics.
      </p>
      <p>
        Declining stops measurement and removes the saved measurement ID. Your Atlas data and
        account remain available.
      </p>
      <Choices consent={consent} />
    </section>
  );
}
