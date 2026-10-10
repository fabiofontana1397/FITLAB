// Web (and any platform without a native health store): nothing to read.
// The iPhone and Android versions live in health-provider.ios.ts / .android.ts.
import type { HealthProvider } from './types';

export const healthProvider: HealthProvider = {
  availability: async () => ({ available: false, provider: null, reason: 'web' }),
  requestAccess: async () => false,
  readDays: async () => [],
};
