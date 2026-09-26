"use client";

import type { ReactNode } from "react";
import { useSession } from "./session";
import { VerifyPanel } from "./verify-panel";

/** Shows children only to signed-in, verified, 18+ users; otherwise the verify panel. */
export function RequireVerified({ children, reason }: { children: ReactNode; reason: string }) {
  const { me, signedIn, loading } = useSession();
  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />;
  if (!signedIn || !me?.verified || !me?.adult)
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <p className="text-sm text-muted">{reason}</p>
        <VerifyPanel />
      </div>
    );
  return <>{children}</>;
}
