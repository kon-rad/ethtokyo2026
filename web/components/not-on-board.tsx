"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Hides site chrome (header, footer) on the full-screen status board at /r/<address>/board. */
export function NotOnBoard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (/^\/r\/[^/]+\/board\/?$/.test(pathname ?? "")) return null;
  return <>{children}</>;
}
