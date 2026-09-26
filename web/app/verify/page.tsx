"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { VerifyPanel } from "@/components/verify-panel";

function VerifyInner() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  return <VerifyPanel onVerified={() => next && next.startsWith("/") && router.push(next)} />;
}

export default function VerifyPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Verify</h1>
      <Suspense>
        <VerifyInner />
      </Suspense>
    </div>
  );
}
