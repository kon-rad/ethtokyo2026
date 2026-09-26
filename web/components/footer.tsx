import Link from "next/link";
import { config } from "@/lib/config";
import { addressUrl } from "@/lib/format";

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-1">
          <p className="font-medium text-foreground">AI City</p>
          <p>Pop-up cities, funded together. Payments in USDC on Ethereum.</p>
          <p className="text-xs">Unaudited software. Only deposit what you can afford to lose.</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <Link href="/#how" className="hover:text-foreground">
            How it works
          </Link>
          <a href={addressUrl(config.factoryAddress)} target="_blank" rel="noreferrer" className="hover:text-foreground">
            Contract
          </a>
          <a href="https://world.org/world-id" target="_blank" rel="noreferrer" className="hover:text-foreground">
            World ID
          </a>
        </div>
      </div>
    </footer>
  );
}
