"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import {
  RainbowKitProvider,
  RainbowKitAuthenticationProvider,
  createAuthenticationAdapter,
  connectorsForWallets,
  lightTheme,
} from "@rainbow-me/rainbowkit";
import { metaMaskWallet, rainbowWallet, roninWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { createSiweMessage } from "viem/siwe";
import { config } from "@/lib/config";
import { api } from "@/lib/client/api";
import { SessionProvider, useSession, type Me } from "./session";

const connectors = connectorsForWallets(
  [{ groupName: "Wallets", wallets: [metaMaskWallet, rainbowWallet, roninWallet, walletConnectWallet] }],
  { appName: "AI City", projectId: config.walletConnectProjectId || "missing-project-id" },
);

const wagmiConfig = createConfig({
  chains: [config.chain],
  connectors,
  transports: { [config.chain.id]: http(config.rpcUrl) },
  ssr: true,
});

/** Sign-In with Ethereum, wired into RainbowKit's connect flow. */
function AuthLayer({ children }: { children: React.ReactNode }) {
  const { signedIn, loading, setMe } = useSession();

  const adapter = useMemo(
    () =>
      createAuthenticationAdapter({
        getNonce: async () => (await api<{ nonce: string }>("/api/auth/nonce")).nonce,
        createMessage: ({ nonce, address, chainId }) =>
          createSiweMessage({
            domain: window.location.host,
            address,
            statement: "Sign in to AI City.",
            uri: window.location.origin,
            version: "1",
            chainId,
            nonce,
          }),
        verify: async ({ message, signature }) => {
          try {
            const { me } = await api<{ me: Me }>("/api/auth/verify", { method: "POST", json: { message, signature } });
            setMe(me);
            return true;
          } catch {
            return false;
          }
        },
        signOut: async () => {
          await api("/api/auth/logout", { method: "POST" });
          setMe(null);
        },
      }),
    [setMe],
  );

  const status = loading ? "loading" : signedIn ? "authenticated" : "unauthenticated";
  return (
    <RainbowKitAuthenticationProvider adapter={adapter} status={status}>
      <RainbowKitProvider
        initialChain={config.chain}
        theme={lightTheme({ accentColor: "#111827", borderRadius: "medium", fontStack: "system" })}
      >
        {children}
      </RainbowKitProvider>
    </RainbowKitAuthenticationProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <AuthLayer>{children}</AuthLayer>
        </SessionProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
