import "server-only";
import { getAddress, isAddress, type Address } from "viem";
import { getMe, type Me } from "./session";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}

/** Wraps a route handler: HttpErrors become JSON responses, anything else a logged 500. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
      console.error(e);
      return Response.json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}

export async function requireSession(): Promise<Me> {
  const me = await getMe();
  if (!me) fail(401, "Sign in with your wallet first");
  return me;
}

/** Signed in in a browser, with the cookie. API keys can't manage API keys. */
export async function requireCookieSession(): Promise<Me> {
  const me = await requireSession();
  if (me.via !== "session") fail(403, "Manage API keys from the site, signed in with your wallet");
  return me;
}

/** Signed in, World ID verified and 18+ attested. */
export async function requireVerified(): Promise<Me> {
  const me = await requireSession();
  if (!me.verified || !me.adult) fail(403, "Verify you're a human over 18 first");
  return me;
}

export function parseAddress(value: string): Address {
  if (!isAddress(value)) fail(400, "Invalid address");
  return getAddress(value);
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    fail(400, "Expected a JSON body");
  }
}
