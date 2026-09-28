import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { SATURDAY_UNLOCK_AT, currentUser } from "./helpers";

function activity(name: string) {
  return process.env[name]?.trim() || "";
}

export const copies = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user?.isAdmin) return null;
    const saturday = activity("SATURDAY_ACTIVITY");
    const escapada = activity("ESCAPADA_ACTIVITY");
    return {
      tarde: saturday
        ? {
            lead: saturday,
            details: ["18:00", "Deán Funes 244", "De negro"],
            note: "La actividad solo la ves vos.",
          }
        : null,
      escapada: escapada
        ? {
            lead: escapada,
            details: [] as string[],
            note: "La actividad solo la ves vos.",
          }
        : null,
    };
  },
});

export const arm = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return;
    const existing = await ctx.db
      .query("reveal")
      .withIndex("by_key", (q) => q.eq("key", "saturday"))
      .unique();
    if (existing?.scheduled) return;
    if (!existing) {
      await ctx.db.insert("reveal", { key: "saturday", scheduled: true });
    } else {
      await ctx.db.patch(existing._id, { scheduled: true });
    }
    await ctx.scheduler.runAt(
      SATURDAY_UNLOCK_AT,
      internal.plan.markRevealed,
      {},
    );
  },
});

export const markRevealed = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("reveal")
      .withIndex("by_key", (q) => q.eq("key", "saturday"))
      .unique();
    if (!existing) {
      await ctx.db.insert("reveal", {
        key: "saturday",
        scheduled: true,
        at: Date.now(),
      });
      return;
    }
    await ctx.db.patch(existing._id, { at: Date.now(), scheduled: true });
  },
});
