import { describe, expect, it } from "vitest";
import type { MutationCtx } from "@/convex/_generated/server";
import {
  AI_GENERATION_LIMIT,
  AI_PROBE_LIMIT,
  consumeRateLimit,
  enforceOrThrow,
  generationBucketKey,
  probeBucketKey,
} from "@/convex/rateLimit";

/**
 * Wiring tests for the server-side limiter.
 *
 * `convex-test` (the official harness that runs real Convex functions) needs a
 * running backend, which CI does not have — see README §Rate limiting. These
 * tests instead drive the exact persistence path the mutations use
 * (`read row → decide → write row`, same `ctx.db` calls) against an in-memory
 * store, so the transactional behaviour, the shared send/retry bucket and the
 * refusal semantics are asserted without any provider call.
 */

interface RateRow {
  _id: string;
  key: string;
  windowStart: number;
  count: number;
}

/** Minimal `MutationCtx` exposing only what `consumeRateLimit` touches. */
function createFakeCtx(store: RateRow[]): MutationCtx {
  let seq = store.length;
  const db = {
    query: (table: string) => {
      if (table !== "rateLimits") throw new Error(`table inattendue: ${table}`);
      return {
        withIndex: (
          _index: string,
          builder: (q: { eq: (field: string, value: string) => unknown }) => unknown,
        ) => {
          const condition = builder({
            eq: (field, value) => ({ field, value }),
          }) as { field: keyof RateRow; value: string };
          return {
            unique: async () =>
              store.find((row) => row[condition.field] === condition.value) ?? null,
          };
        },
      };
    },
    insert: async (table: string, doc: Record<string, unknown>) => {
      if (table !== "rateLimits") throw new Error(`table inattendue: ${table}`);
      seq += 1;
      const row = { _id: `row_${seq}`, ...doc } as RateRow;
      store.push(row);
      return row._id;
    },
    patch: async (id: string, patch: Record<string, unknown>) => {
      const row = store.find((candidate) => candidate._id === id);
      if (row) Object.assign(row, patch);
    },
  };
  return { db } as unknown as MutationCtx;
}

const SUBJECT = "user-1";
const BUCKET = generationBucketKey(SUBJECT);

describe("envoi et relance partagent le même quota", () => {
  it("10 requêtes combinées passent, la 11e est refusée", async () => {
    const store: RateRow[] = [];
    const ctx = createFakeCtx(store);

    for (let i = 1; i <= AI_GENERATION_LIMIT.limit; i += 1) {
      // The two call sites (postMessage / retryMessage) both build their key
      // through `generationBucketKey`, which is what is simulated here.
      await expect(
        enforceOrThrow(ctx, BUCKET, AI_GENERATION_LIMIT.limit, AI_GENERATION_LIMIT.windowMs),
        `requête ${i}`,
      ).resolves.toBeUndefined();
    }

    await expect(
      enforceOrThrow(ctx, BUCKET, AI_GENERATION_LIMIT.limit, AI_GENERATION_LIMIT.windowMs),
    ).rejects.toThrow(/Limite de requêtes IA atteinte \(10 toutes les 5 minutes\)/);

    expect(store).toHaveLength(1);
    expect(store[0].count).toBe(AI_GENERATION_LIMIT.limit);
  });

  it("le refus indique un délai avant nouvelle tentative", async () => {
    const store: RateRow[] = [];
    const ctx = createFakeCtx(store);
    store.push({
      _id: "row_1",
      key: BUCKET,
      windowStart: Date.now(),
      count: AI_GENERATION_LIMIT.limit,
    });

    await expect(
      enforceOrThrow(ctx, BUCKET, AI_GENERATION_LIMIT.limit, AI_GENERATION_LIMIT.windowMs),
    ).rejects.toThrow(/Réessayez dans [1-9][0-9]* s\./);
  });

  it("un refus ne consomme pas de slot et la fenêtre suivante repart à zéro", async () => {
    const store: RateRow[] = [];
    const ctx = createFakeCtx(store);
    const { limit, windowMs } = AI_GENERATION_LIMIT;

    for (let i = 0; i < limit; i += 1) {
      await enforceOrThrow(ctx, BUCKET, limit, windowMs);
    }
    const before = { ...store[0] };

    await expect(enforceOrThrow(ctx, BUCKET, limit, windowMs)).rejects.toThrow();
    expect(store[0]).toEqual(before); // refusal must not advance the counter

    // Simulate the window elapsing (consumeRateLimit reads Date.now() itself).
    store[0].windowStart = Date.now() - windowMs;
    await expect(enforceOrThrow(ctx, BUCKET, limit, windowMs)).resolves.toBeUndefined();
    expect(store[0].count).toBe(1);
  });

  it("les quotas sont isolés entre identités", async () => {
    const store: RateRow[] = [];
    const ctx = createFakeCtx(store);
    const { limit, windowMs } = AI_GENERATION_LIMIT;

    for (let i = 0; i < limit; i += 1) {
      await enforceOrThrow(ctx, generationBucketKey("user-1"), limit, windowMs);
    }
    await expect(
      enforceOrThrow(ctx, generationBucketKey("user-1"), limit, windowMs),
    ).rejects.toThrow();

    // A second identity still has its full budget.
    await expect(
      enforceOrThrow(ctx, generationBucketKey("user-2"), limit, windowMs),
    ).resolves.toBeUndefined();
    expect(store).toHaveLength(2);
  });
});

describe("persistance transactionnelle", () => {
  it("un compteur écrit par une transaction est lu par la suivante", async () => {
    const store: RateRow[] = [];
    const { limit, windowMs } = AI_GENERATION_LIMIT;

    // Two distinct contexts over the same store = two sequential transactions
    // against the same database row.
    const first = createFakeCtx(store);
    const second = createFakeCtx(store);

    for (let i = 0; i < limit; i += 1) {
      const ctx = i % 2 === 0 ? first : second;
      await enforceOrThrow(ctx, BUCKET, limit, windowMs);
    }

    await expect(enforceOrThrow(second, BUCKET, limit, windowMs)).rejects.toThrow();
    expect(store).toHaveLength(1);
    expect(store[0].count).toBe(limit);
  });

  it("refus non bloquant : la voie sonde retourne ok=false avec un message", async () => {
    // `ai.probe` uses the non-throwing variant so it can answer { ok, error }.
    const store: RateRow[] = [];
    const ctx = createFakeCtx(store);
    const { limit, windowMs } = AI_PROBE_LIMIT;
    const key = probeBucketKey(SUBJECT);

    for (let i = 0; i < limit; i += 1) {
      const decision = await consumeRateLimit(ctx, key, limit, windowMs);
      expect(decision.ok).toBe(true);
    }

    const refused = await consumeRateLimit(ctx, key, limit, windowMs);
    expect(refused.ok).toBe(false);
    expect(refused.retryAfterMs).toBeGreaterThan(0);
    expect(refused.retryAfterMs).toBeLessThanOrEqual(windowMs);
  });
});

describe("namespaces de quotas", () => {
  it("génération et test fournisseur n'utilisent pas le même seau", () => {
    expect(generationBucketKey(SUBJECT)).not.toBe(probeBucketKey(SUBJECT));
    expect(generationBucketKey(SUBJECT)).toBe("ai:gen:user-1");
    expect(probeBucketKey(SUBJECT)).toBe("ai:probe:user-1");
  });

  it("épuiser le quota de test ne touche pas au budget de génération", async () => {
    const store: RateRow[] = [];
    const ctx = createFakeCtx(store);
    const { limit, windowMs } = AI_PROBE_LIMIT;

    for (let i = 0; i < limit; i += 1) {
      await consumeRateLimit(ctx, probeBucketKey(SUBJECT), limit, windowMs);
    }
    const exhaustedProbe = await consumeRateLimit(
      ctx,
      probeBucketKey(SUBJECT),
      limit,
      windowMs,
    );
    expect(exhaustedProbe.ok).toBe(false);

    // The generation budget is untouched: its own bucket is still empty.
    await expect(
      enforceOrThrow(
        ctx,
        generationBucketKey(SUBJECT),
        AI_GENERATION_LIMIT.limit,
        AI_GENERATION_LIMIT.windowMs,
      ),
    ).resolves.toBeUndefined();

    const probeRow = store.find((row) => row.key === "ai:probe:user-1");
    const genRow = store.find((row) => row.key === "ai:gen:user-1");
    expect(probeRow?.count).toBe(limit);
    expect(genRow?.count).toBe(1);
  });
});
