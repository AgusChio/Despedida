import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { currentUser, displayNameOf } from "./helpers";

const slug = v.union(
  v.literal("tarde"),
  v.literal("escapada"),
  v.literal("cafe"),
);

export const list = query({
  args: { itinerarySlug: slug },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user) return [];
    const rows = await ctx.db
      .query("rsvps")
      .withIndex("by_itinerary", (q) =>
        q.eq("itinerarySlug", args.itinerarySlug),
      )
      .collect();
    const people = await Promise.all(
      rows.map(async (row) => {
        const person = await ctx.db.get(row.userId);
        if (!person) return null;
        const displayName =
          displayNameOf(person) || person.name?.trim() || "Invitada";
        return {
          userId: row.userId,
          going: row.going,
          displayName,
          image: person.image ?? "",
          mine: person._id === user.id,
        };
      }),
    );
    return people.flatMap((person) => (person ? [person] : []));
  },
});

export const answer = mutation({
  args: { itinerarySlug: slug, going: v.boolean() },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user) throw new Error("Tenés que entrar con Gmail.");
    if (!user.hasName) throw new Error("Primero confirmá tu nombre y apellido.");
    const existing = await ctx.db
      .query("rsvps")
      .withIndex("by_user_itinerary", (q) =>
        q.eq("userId", user.id).eq("itinerarySlug", args.itinerarySlug),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { going: args.going });
      return;
    }
    await ctx.db.insert("rsvps", {
      userId: user.id,
      itinerarySlug: args.itinerarySlug,
      going: args.going,
    });
  },
});
