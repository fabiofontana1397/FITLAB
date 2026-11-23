import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { fetchLatestConsents, recordConsents } from '@/lib/api/consents';
import { CONSENT_ITEMS, LEGAL_VERSION } from '@/lib/legal/content';
import { appJsonStorage } from '@/store/storage';

/**
 * Whether the signed-in person has accepted the current legal texts (age 18+, Terms + health disclaimer, explicit
 * consent to health data). The app gate (app/_layout.tsx) sends anyone without it to /consent before the
 * questionnaire, because the questionnaire already collects health data.
 *
 * `status`: 'unknown' until the server answered (or the local copy already says accepted), then 'accepted' or
 * 'required'. The local copy only avoids a flash of the consent screen on every cold start; the server log is
 * the record.
 */
type ConsentState = {
  acceptedVersion: string | null;
  status: 'unknown' | 'accepted' | 'required';
  syncFromServer: () => Promise<void>;
  accept: (userId: string) => Promise<string | null>;
  clearLocal: () => void;
};

const ALL_KINDS = CONSENT_ITEMS.map((c) => c.id);

export const useConsentStore = create<ConsentState>()(
  persist(
    (set, get) => ({
      acceptedVersion: null,
      status: 'unknown',
      syncFromServer: async () => {
        if (get().acceptedVersion === LEGAL_VERSION) set({ status: 'accepted' });
        const latest = await fetchLatestConsents();
        if (!latest) {
          // Offline or server error: trust a local acceptance of this version, otherwise ask (accepting retries the save).
          set({ status: get().acceptedVersion === LEGAL_VERSION ? 'accepted' : 'required' });
          return;
        }
        const ok = ALL_KINDS.every((k) => latest[k]?.granted && latest[k]?.version === LEGAL_VERSION);
        set({ status: ok ? 'accepted' : 'required', acceptedVersion: ok ? LEGAL_VERSION : null });
      },
      accept: async (userId) => {
        const error = await recordConsents(userId, ALL_KINDS, LEGAL_VERSION);
        if (error) return 'Non è stato possibile salvare il consenso. Controlla la connessione e riprova.';
        set({ acceptedVersion: LEGAL_VERSION, status: 'accepted' });
        return null;
      },
      clearLocal: () => set({ acceptedVersion: null, status: 'unknown' }),
    }),
    {
      name: 'fitlab/consent',
      storage: appJsonStorage,
      // The status is recomputed on every start; only the accepted version is kept.
      partialize: (s) => ({ acceptedVersion: s.acceptedVersion }),
    }
  )
);
