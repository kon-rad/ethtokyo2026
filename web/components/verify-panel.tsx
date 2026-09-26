"use client";

import { useState } from "react";
import { IDKitRequestWidget, proofOfHuman, type RpContext, type IDKitResult } from "@worldcoin/idkit";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { config } from "@/lib/config";
import { api, errorMessage } from "@/lib/client/api";
import { useSession, type Me } from "./session";
import { Button, Card, Notice } from "./ui";

const DEV_VERIFY = process.env.NEXT_PUBLIC_ALLOW_DEV_VERIFY === "1";

/** World ID Proof of Human + 18+ attestation. Renders nothing extra once verified. */
export function VerifyPanel({ onVerified }: { onVerified?: () => void }) {
  const { me, signedIn, setMe } = useSession();
  const { openConnectModal } = useConnectModal();
  const [adult, setAdult] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!signedIn || !me)
    return (
      <Card className="space-y-4 text-center">
        <p className="font-medium">Connect and sign in with your wallet first.</p>
        <Button onClick={openConnectModal}>Connect wallet</Button>
      </Card>
    );

  if (me.verified && me.adult)
    return <Notice tone="success">✓ You&apos;re verified as a unique human, 18 or older.</Notice>;

  async function start() {
    setError(null);
    setBusy(true);
    try {
      const { rp_context } = await api<{ rp_context: RpContext }>("/api/world/rp-context", { method: "POST" });
      setRpContext(rp_context);
      setOpen(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(result: IDKitResult) {
    const { me } = await api<{ me: Me }>("/api/world/verify", { method: "POST", json: { adult: true, idkitResult: result } });
    setMe(me);
  }

  async function devVerify() {
    setBusy(true);
    try {
      const { me } = await api<{ me: Me }>("/api/world/dev-verify", { method: "POST" });
      setMe(me);
      onVerified?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Verify you&apos;re a human</h2>
        <p className="text-sm text-muted">
          AI City uses World ID Proof of Human so each person has one account. We never learn who you are: World
          only tells us this is a unique human, and your proof is tied to this wallet.
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-line p-4 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
        <span>I confirm I&apos;m 18 years or older.</span>
      </label>

      {error && <Notice tone="error">{error}</Notice>}

      <div className="flex flex-wrap gap-3">
        <Button onClick={start} disabled={!adult} loading={busy}>
          Verify with World ID
        </Button>
        {DEV_VERIFY && (
          <Button variant="secondary" onClick={devVerify} disabled={!adult} loading={busy}>
            Dev: skip World ID
          </Button>
        )}
      </div>
      <p className="text-xs text-muted">Needs the World App with an Orb-verified World ID.</p>

      {rpContext && (
        <IDKitRequestWidget
          open={open}
          onOpenChange={setOpen}
          app_id={config.worldAppId}
          action={config.worldAction}
          rp_context={rpContext}
          allow_legacy_proofs={true}
          preset={proofOfHuman({ signal: me.address.toLowerCase() })}
          environment={config.worldEnvironment}
          handleVerify={handleVerify}
          onSuccess={() => onVerified?.()}
          onError={(code) =>
            setError(
              code === "failed_by_host_app"
                ? "This World ID is already linked to another wallet, or the proof was rejected."
                : code === "user_rejected"
                  ? "Verification cancelled in World App."
                  : `World ID error: ${code}`,
            )
          }
        />
      )}
    </Card>
  );
}
