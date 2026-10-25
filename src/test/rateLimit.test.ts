import { describe, expect, it } from "vitest";
import {
  AI_GENERATION_LIMIT,
  AI_PROBE_LIMIT,
  enforceRateLimit,
  type RateLimitState,
} from "@/convex/rateLimit";

/**
 * The limiter is the only thing standing between a scripted client and the
 * provider budget, so every branch of the fixed-window decision is asserted
 * here (the Convex wiring around it is thin: read row → decide → persist).
 */
describe("enforceRateLimit", () => {
  const LIMIT = 3;
  const WINDOW = 60_000;
  const t0 = 1_000_000;

  it("accepts the first request and starts a window", () => {
    const decision = enforceRateLimit(null, t0, LIMIT, WINDOW);
    expect(decision.ok).toBe(true);
    expect(decision.state).toEqual({ windowStart: t0, count: 1 });
    expect(decision.retryAfterMs).toBe(0);
  });

  it("counts consecutive requests inside the window", () => {
    const now = t0 + 7;
    let state: RateLimitState | null = null;
    for (let i = 1; i <= LIMIT; i += 1) {
      const decision = enforceRateLimit(state, now, LIMIT, WINDOW);
      expect(decision.ok, `requête ${i}`).toBe(true);
      expect(decision.state.count, `compteur après requête ${i}`).toBe(i);
      expect(decision.state.windowStart).toBe(now);
      state = decision.state;
    }
    expect(state).toEqual({ windowStart: now, count: LIMIT });
  });

  it("refuses the request after the limit and reports the remaining time", () => {
    const full: RateLimitState = { windowStart: t0, count: LIMIT };
    const decision = enforceRateLimit(full, t0 + 10_000, LIMIT, WINDOW);

    expect(decision.ok).toBe(false);
    expect(decision.state).toEqual(full); // refused request must not consume a slot
    expect(decision.retryAfterMs).toBe(WINDOW - 10_000);
  });

  it("refusal delay shrinks as the window ages", () => {
    const full: RateLimitState = { windowStart: t0, count: LIMIT };
    const early = enforceRateLimit(full, t0 + 5_000, LIMIT, WINDOW);
    const late = enforceRateLimit(full, t0 + 50_000, LIMIT, WINDOW);
    expect(late.retryAfterMs).toBeLessThan(early.retryAfterMs);
  });

  it("resets the counter when the window has expired", () => {
    const expired: RateLimitState = { windowStart: t0, count: LIMIT };
    const decision = enforceRateLimit(expired, t0 + WINDOW, LIMIT, WINDOW);

    expect(decision.ok).toBe(true);
    expect(decision.state).toEqual({ windowStart: t0 + WINDOW, count: 1 });
  });

  it("refuses everything when configured with a non-positive limit", () => {
    const decision = enforceRateLimit(null, t0, 0, WINDOW);
    expect(decision.ok).toBe(false);
  });
});

describe("configured thresholds", () => {
  it("matches the documented values", () => {
    // 10 sends+retries per 5 minutes, 3 provider probes per 5 minutes — see
    // rateLimit.ts header and README §Rate limiting.
    expect(AI_GENERATION_LIMIT).toEqual({ limit: 10, windowMs: 300_000 });
    expect(AI_PROBE_LIMIT).toEqual({ limit: 3, windowMs: 300_000 });
  });

  it("keeps the worst-case boundary burst below a sane spend", () => {
    // Fixed windows can allow 2× the limit across a boundary: assert that
    // worst case stays bounded (20 generations / 5 min here).
    expect(AI_GENERATION_LIMIT.limit * 2).toBeLessThanOrEqual(20);
    expect(AI_PROBE_LIMIT.limit * 2).toBeLessThanOrEqual(6);
  });
});
