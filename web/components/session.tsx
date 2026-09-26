"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { api } from "@/lib/client/api";

export type Me = { address: `0x${string}`; verified: boolean; adult: boolean };

type SessionState = {
  me: Me | null;
  loading: boolean;
  /** Signed in AND the session wallet is the connected wallet. */
  signedIn: boolean;
  refresh: () => Promise<Me | null>;
  setMe: (me: Me | null) => void;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const { address } = useAccount();

  const refresh = useCallback(async () => {
    try {
      const { me } = await api<{ me: Me | null }>("/api/me");
      setMe(me);
      return me;
    } catch {
      setMe(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load the session once on mount; state is set asynchronously after the fetch resolves.
    void api<{ me: Me | null }>("/api/me")
      .then(({ me }) => setMe(me))
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, []);

  const signedIn = !!me && !!address && me.address.toLowerCase() === address.toLowerCase();
  const value = useMemo(() => ({ me, loading, signedIn, refresh, setMe }), [me, loading, signedIn, refresh]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession outside SessionProvider");
  return ctx;
}
