import { useEffect, useState } from 'react';

import { fetchIsAdmin } from '@/lib/api/admin';

/** 'checking' until the server answers; 'denied' for everyone who is not in `app_admins`. */
export function useAdminGuard(): 'checking' | 'allowed' | 'denied' {
  const [state, setState] = useState<'checking' | 'allowed' | 'denied'>('checking');
  useEffect(() => {
    let alive = true;
    fetchIsAdmin().then((ok) => {
      if (alive) setState(ok ? 'allowed' : 'denied');
    });
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
