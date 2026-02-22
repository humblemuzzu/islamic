import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const checkAndIncrement = internalMutation({
  args: {
    identifier: v.string(),
    maxRequests: v.number(),
    windowMs: v.number(),
  },
  handler: async (ctx, { identifier, maxRequests, windowMs }) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("rateLimits")
      .withIndex("by_identifier", (q) => q.eq("identifier", identifier))
      .first();

    if (!existing) {
      await ctx.db.insert("rateLimits", {
        identifier,
        windowStart: now,
        requestCount: 1,
        updatedAt: now,
      });
      return { allowed: true, remaining: maxRequests - 1 };
    }

    const elapsed = now - existing.windowStart;
    if (elapsed >= windowMs) {
      await ctx.db.patch(existing._id, {
        windowStart: now,
        requestCount: 1,
        updatedAt: now,
      });
      return { allowed: true, remaining: maxRequests - 1 };
    }

    if (existing.requestCount >= maxRequests) {
      return { allowed: false, retryAfterMs: windowMs - elapsed };
    }

    await ctx.db.patch(existing._id, {
      requestCount: existing.requestCount + 1,
      updatedAt: now,
    });

    return {
      allowed: true,
      remaining: maxRequests - existing.requestCount - 1,
    };
  },
});

export const cleanupOldRateLimits = internalMutation({
  args: { olderThanMs: v.number() },
  handler: async (ctx, { olderThanMs }) => {
    const cutoff = Date.now() - olderThanMs;
    const rows = await ctx.db.query("rateLimits").collect();
    let deleted = 0;

    for (const row of rows) {
      if (row.updatedAt < cutoff) {
        await ctx.db.delete(row._id);
        deleted += 1;
      }
    }

    return { deleted };
  },
});
