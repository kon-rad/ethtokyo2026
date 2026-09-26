"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useSession } from "./session";

export function Header() {
  const { me, signedIn } = useSession();
  const verified = signedIn && me?.verified && me?.adult;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gray-900 text-xs text-white">AI</span>
          AI City
        </Link>
        <nav className="hidden items-center gap-1 text-sm sm:flex">
          <Link href="/#explore" className="rounded-full px-3 py-1.5 text-muted hover:bg-gray-100 hover:text-foreground">
            Explore
          </Link>
          <Link href="/launch" className="rounded-full px-3 py-1.5 text-muted hover:bg-gray-100 hover:text-foreground">
            Launch a city
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {signedIn &&
            (verified ? (
              <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 sm:inline-flex">
                ✓ Verified human
              </span>
            ) : (
              <Link
                href="/verify"
                className="hidden rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 sm:inline-flex"
              >
                Verify you&apos;re human
              </Link>
            ))}
          <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
        </div>
      </div>
    </header>
  );
}
