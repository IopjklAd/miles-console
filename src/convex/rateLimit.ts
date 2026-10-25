/**
 * Server-side rate limiting for every server action that spends provider
 * tokens: `conversations.postMessage`, `conversations.retryMessage` (both
 * schedule `ai.generate`) and the `ai.probe` connectivity test.
 *
 * Design notes:
 * - The check runs INSIDE the mutation transaction (same `ctx.db`), so two
 *   concurrent requests cannot both slip past the last slot — the limiter is
 *   authoritative regardless of what the browser does.
 * - Keys are per authenticated identity (including Convex anonymous sessions),
 *   so a guest account is limited exactly like a registered one.
 * - Fixed window (simple, cheap, predictable). Documented consequence: up to
 *   `2 × limit` requests can slip through at a window boundary; the chosen
 *   limits stay well below provider-spend danger at that worst case.
 *
 * Thresholds (see README §Rate limiting for the rationale):
 * - generation (send + retry combined): 10 requests / 5 minutes, per user.
 * - provider probe (one completion per call): 3 requests / 5 minutes, per user.
 */

import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";

export const AI_GENERATION_LIMIT = { limit: 10, windowMs: 5 * 60_000 } as const;
export const AI_PROBE_LIMIT = { limit: 3, windowMs: 5 * 60_000 } as const;

export interface RateLimitState {
  windowStart: number;
  count: number;
}

export interface RateLimitDecision {
  /** Whether the request may proceed. */
  ok: boolean;
  /** State to persist (unchanged when the request is refused). */
  state: RateLimitState;
  /** Milliseconds until the window resets (0 when `ok`). */
  retryAfterMs: number;
}

/**
 * Pure fixed-window decision — kept free of Convex types so it can be unit
 * tested directly (src/test/rateLimit.test.ts).
 */
export function enforceRateLimit(
  previous: RateLimitState | null,
  now: number,
  limit: number,
  windowMs: number,
): RateLimitDecision {
  if (limit <= 0 || windowMs <= 0) {
    return { ok: false, state: previous ?? { windowStart: now, count: 0 }, retryAfterMs: windowMs };
  }

  // No bucket yet, or the previous window has expired: start a fresh one.
  if (!previous || now - previous.windowStart >= windowMs) {
    return {
      ok: true,
      state: { windowStart: now, count: 1 },
      retryAfterMs: 0,
    };
  }

  if (previous.count >= limit) {
    return {
      ok: false,
      state: previous,
      retryAfterMs: Math.max(0, previous.windowStart + windowMs - now),
    };
  }

  return {
    ok: true,
    state: { windowStart: previous.windowStart, count: previous.count + 1 },
    retryAfterMs: 0,
  };
}

/** Read the bucket, apply the decision, persist it — inside the caller's transaction. */
export async function consumeRateLimit(
  ctx: MutationCtx,
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitDecision> {
  const row = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();

  const decision = enforceRateLimit(
    row ? { windowStart: row.windowStart, count: row.count } : null,
    Date.now(),
    limit,
    windowMs,
  );

  if (row) {
    const changed =
      decision.state.windowStart !== row.windowStart ||
      decision.state.count !== row.count;
    if (changed) await ctx.db.patch(row._id, decision.state);
  } else if (decision.ok) {
    await ctx.db.insert("rateLimits", { key, ...decision.state });
  }

  return decision;
}

function refusalMessage(decision: RateLimitDecision, limit: number, windowMs: number): string {
  const seconds = Math.max(1, Math.ceil(decision.retryAfterMs / 1000));
  const minutes = Math.floor(windowMs / 60_000);
  return `Limite de requêtes IA atteinte (${limit} toutes les ${minutes} minutes). Réessayez dans ${seconds} s.`;
}

/** Throwing guard used by public mutations (postMessage / retryMessage). */
export async function enforceOrThrow(
  ctx: MutationCtx,
  key: string,
  limit: number,
  windowMs: number,
): Promise<void> {
  const decision = await consumeRateLimit(ctx, key, limit, windowMs);
  if (!decision.ok) {
    throw new Error(refusalMessage(decision, limit, windowMs));
  }
}

/**
 * Non-throwing variant for `ai.probe`, which answers `{ ok, error }` instead
 * of throwing (callable from an action via `ctx.runMutation`).
 */
export const consume = internalMutation({
  args: { key: v.string(), limit: v.number(), windowMs: v.number() },
  handler: async (ctx, { key, limit, windowMs }) => {
    const decision = await consumeRateLimit(ctx, key, limit, windowMs);
    return {
      ok: decision.ok,
      retryAfterMs: decision.retryAfterMs,
      message: decision.ok ? "" : refusalMessage(decision, limit, windowMs),
    };
  },
});
