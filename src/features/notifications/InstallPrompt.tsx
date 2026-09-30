import { useEffect, useState } from 'react';
import { registerPushSubscription } from './api';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('cortex-install-dismissed') === '1');
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isStandaloneMode()) {
      setDismissed(true);
      return undefined;
    }

    function onBeforeInstall(event: Event) {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  if (dismissed || !deferred) return null;

  async function handleInstall() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') {
      const push = await registerPushSubscription();
      setPushStatus(push.ok ? 'Push enabled' : 'Install complete — enable notifications in settings');
    }
    setDeferred(null);
    setDismissed(true);
    localStorage.setItem('cortex-install-dismissed', '1');
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg rounded border border-outline bg-surface-container-high p-4 shadow-lg md:left-auto">
      <p className="font-headline text-headline-sm text-on-surface">Install Cortex</p>
      <p className="mt-1 text-body-sm text-on-surface-variant">
        Add to your home screen for faster access and real-time task alerts.
      </p>
      {pushStatus && <p className="mt-2 text-body-sm text-tertiary">{pushStatus}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" className="cortex-btn-primary" onClick={() => void handleInstall()}>
          Install
        </button>
        <button
          type="button"
          className="cortex-btn-secondary"
          onClick={() => {
            setDismissed(true);
            localStorage.setItem('cortex-install-dismissed', '1');
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}

export function PushEnableBanner() {
  const [hidden, setHidden] = useState(() => localStorage.getItem('cortex-push-dismissed') === '1');
  const [message, setMessage] = useState<string | null>(null);

  if (hidden || !import.meta.env.VITE_VAPID_PUBLIC_KEY || Notification.permission === 'granted') return null;

  async function enablePush() {
    try {
      const result = await registerPushSubscription();
      if (result.ok) {
        setMessage('Notifications enabled');
        setHidden(true);
        localStorage.setItem('cortex-push-dismissed', '1');
      } else if (result.reason === 'denied') {
        setMessage('Notification permission denied in browser settings');
      } else {
        setMessage('Push not supported on this device');
        setHidden(true);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to enable push');
    }
  }

  return (
    <div className="mb-4 rounded border border-outline bg-surface-container p-3">
      <p className="text-body-sm text-on-surface">Enable push alerts for assignments and QC updates.</p>
      {message && <p className="mt-1 text-body-sm text-tertiary">{message}</p>}
      <button type="button" className="cortex-btn-secondary mt-2" onClick={() => void enablePush()}>
        Enable notifications
      </button>
    </div>
  );
}
