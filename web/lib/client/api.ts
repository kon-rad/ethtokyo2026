/** JSON fetch that throws the server's `error` message on failure. */
export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    headers: json !== undefined ? { "content-type": "application/json", ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export function errorMessage(e: unknown): string {
  if (e && typeof e === "object") {
    const any = e as { shortMessage?: string; message?: string };
    if (any.shortMessage) return any.shortMessage;
    if (any.message) return any.message.split("\n")[0];
  }
  return "Something went wrong";
}
