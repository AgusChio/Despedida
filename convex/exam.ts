import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { examBank } from "../src/data/exam.ts";
import { currentUser, displayNameOf, isAdminEmail } from "./helpers";

function optionOk(index: number, answer: string) {
  const options: readonly string[] = examBank[index]?.options ?? [];
  return options.includes(answer);
}

function cleanAnswers(values: string[]) {
  if (values.length !== examBank.length) return null;
  const answers = values.map((value) => value.trim().replace(/\s+/g, " "));
  if (answers.some((answer, index) => !optionOk(index, answer))) return null;
  return answers;
}

async function brideRow(ctx: QueryCtx | MutationCtx) {
  const users = await ctx.db.query("users").collect();
  const bride = users.find((user) => user.isBride === true && !isAdminEmail(user.email));
  if (!bride) return null;
  const row = await ctx.db
    .query("examAnswers")
    .withIndex("by_user", (q) => q.eq("userId", bride._id))
    .unique();
  if (!row) return null;
  const answers = cleanAnswers(row.answers);
  if (!answers) return null;
  return { userId: bride._id, answers };
}

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return [];
    const row = await ctx.db
      .query("examAnswers")
      .withIndex("by_user", (q) => q.eq("userId", user.id))
      .unique();
    return cleanAnswers(row?.answers ?? []) ?? [];
  },
});

export const open = query({
  args: {},
  handler: async (ctx) => {
    const key = await brideRow(ctx);
    return key !== null;
  },
});

export const roster = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return null;
    const key = await brideRow(ctx);
    if (!key) return { ready: false as const, people: [] };
    const rows = await ctx.db.query("examAnswers").collect();
    const people = (
      await Promise.all(
        rows.map(async (row) => {
          if (row.userId === key.userId) return null;
          const answers = cleanAnswers(row.answers);
          if (!answers) return null;
          const person = await ctx.db.get(row.userId);
          if (!person || person.isBride) return null;
          const displayName = displayNameOf(person) || person.name?.trim() || "Invitada";
          if (user.isAdmin) {
            const score = answers.filter((answer, index) => answer === key.answers[index]).length;
            return { userId: row.userId, displayName, score };
          }
          return { userId: row.userId, displayName };
        }),
      )
    )
      .flatMap((person) => (person ? [person] : []))
      .sort((a, b) => {
        const scoreA = "score" in a ? (a.score ?? 0) : 0;
        const scoreB = "score" in b ? (b.score ?? 0) : 0;
        return scoreB - scoreA || a.displayName.localeCompare(b.displayName, "es");
      });
    return { ready: true as const, people };
  },
});

export const save = mutation({
  args: { answers: v.array(v.string()) },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user) throw new Error("Tenés que entrar con Gmail.");
    if (!user.hasName) throw new Error("Primero confirmá tu nombre y apellido.");
    const answers = cleanAnswers(args.answers);
    if (!answers) throw new Error("Elegí una opción en cada pregunta.");
    if (!user.isBride) {
      const key = await brideRow(ctx);
      if (!key) throw new Error("Caro todavía no terminó las respuestas.");
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
