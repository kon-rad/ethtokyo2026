import type { NextConfig } from "next";

const empty = "./lib/stubs/empty.js";

const nextConfig: NextConfig = {
  turbopack: {
    // wagmi's Base Account connector → @coinbase/cdp-sdk lazily imports x402 packages we don't use.
    resolveAlias: {
      "@x402/core/client": empty,
      "@x402/evm": empty,
      "@x402/evm/exact/client": empty,
      "@x402/evm/upto/client": empty,
      "@x402/svm/exact/client": empty,
    },
  },
};

export default nextConfig;
