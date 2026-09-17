// Best-effort, per-instance sliding-window limiter. Enough to stop a single
// client from draining the Groq free tier; Phase 5 replaces it with a shared store.
const buckets = new Map<string, number[]>();

export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

export function rateLimit(req: Request, scope: string, limit: number, windowMs = 60_000): Response | null {
  const key = `${scope}:${clientKey(req)}`;
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    const retryAfter = Math.ceil((windowMs - (now - hits[0])) / 1000);
    return Response.json(
      { error: "rate_limited", message: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  hits.push(now);
  buckets.set(key, hits);
  return null;
}
