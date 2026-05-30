// Simple in-memory per-IP rate limiter for API routes. Each call to
// `createRateLimiter` returns an independent limiter with its own counter map,
// so routes keep separate request budgets rather than sharing one global limit.

export type RateLimiter = (ip: string) => boolean;

export function createRateLimiter(max = 10, windowMs = 60_000): RateLimiter {
  const map = new Map<string, { count: number; resetAt: number }>();
  return (ip: string): boolean => {
    const now = Date.now();
    const entry = map.get(ip);
    if (!entry || now >= entry.resetAt) {
      map.set(ip, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= max) return false;
    entry.count++;
    return true;
  };
}

// Best-effort client IP from common proxy headers, for rate-limiting keys.
export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
