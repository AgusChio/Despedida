import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { currentUser, displayNameOf } from "./helpers";

const QUESTION_COUNT = 5;

function cleanAnswer(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 240);
}

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user || user.isBride) return null;
    const row = await ctx.db
      .query("examAnswers")
      .withIndex("by_user", (q) => q.eq("userId", user.id))
      .unique();
    return row?.answers ?? [];
  },
});

export const results = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user?.isAdmin) return null;
    const rows = await ctx.db.query("examAnswers").collect();
    const people = await Promise.all(
      rows.map(async (row) => {
        const person = await ctx.db.get(row.userId);
        if (!person) return null;
        return {
          userId: row.userId,
          displayName: displayNameOf(person) || person.name?.trim() || "Invitada",
          answers: row.answers,
        };
      }),
    );
    return people
      .flatMap((person) => (person ? [person] : []))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "es"));
  },
});

export const save = mutation({
  args: { answers: v.array(v.string()) },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user) throw new Error("Tenés que entrar con Gmail.");
    if (user.isBride) throw new Error("Este examen es para las invitadas.");
    if (!user.hasName) throw new Error("Primero confirmá tu nombre y apellido.");
    if (args.answers.length !== QUESTION_COUNT) {
      throw new Error("Contestá las cinco preguntas.");
    }
    const answers = args.answers.map(cleanAnswer);
    if (answers.some((answer) => answer.length < 2)) {
      throw new Error("Contestá las cinco preguntas.");
    }
    const existing = await ctx.db
      .query("examAnswers")
      .withIndex("by_user", (q) => q.eq("userId", user.id))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { answers, updatedAt: Date.now() });
      return;
    }
    await ctx.db.insert("examAnswers", {
      userId: user.id,
      answers,
      updatedAt: Date.now(),
    });
  },
});
