import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { currentUser, displayNameOf, isAdminEmail } from "./helpers";

function cleanName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 40);
}

function validName(value: string) {
  return /^[\p{L}][\p{L}'’\- ]{1,39}$/u.test(value);
}

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return null;
    return {
      email: user.email,
      image: user.image,
      profileName: user.profileName,
      firstName: user.firstName,
      lastName: user.lastName,
      hasName: user.hasName,
      isAdmin: user.isAdmin,
      isBride: user.isBride,
      displayName: user.displayName,
    };
  },
});

export const saveName = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user) throw new Error("Tenés que entrar con Gmail.");
    const firstName = cleanName(args.firstName);
    const lastName = cleanName(args.lastName);
    if (!validName(firstName) || !validName(lastName)) {
      throw new Error("Poné nombre y apellido, sin números.");
    }
    await ctx.db.patch(user.id, { firstName, lastName });
  },
});

export const guests = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user?.isAdmin) return null;
    const people = await ctx.db.query("users").collect();
    return people
      .map((person: Doc<"users">) => ({
        id: person._id,
        email: person.email ?? "",
        displayName: displayNameOf(person),
        firstName: person.firstName?.trim() ?? "",
        lastName: person.lastName?.trim() ?? "",
        hasName: Boolean(person.firstName?.trim() && person.lastName?.trim()),
        isAdmin: isAdminEmail(person.email),
        isBride: person.isBride === true && !isAdminEmail(person.email),
      }))
      .sort((a, b) => {
        if (a.isBride !== b.isBride) return a.isBride ? -1 : 1;
        if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
        return (a.displayName || a.email).localeCompare(
          b.displayName || b.email,
          "es",
        );
      });
  },
});

export const renameGuest = mutation({
  args: {
    userId: v.id("users"),
    firstName: v.string(),
    lastName: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user?.isAdmin) throw new Error("Solo la admin puede cambiar nombres.");
    const person = await ctx.db.get(args.userId);
    if (!person) throw new Error("No encontré a esa invitada.");
    const firstName = cleanName(args.firstName);
    const lastName = cleanName(args.lastName);
    if (!validName(firstName) || !validName(lastName)) {
      throw new Error("Poné nombre y apellido, sin números.");
    }
    await ctx.db.patch(person._id, { firstName, lastName });
  },
});

export const setBride = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user?.isAdmin) throw new Error("Solo la admin puede elegir a la novia.");
    const chosen = await ctx.db.get(args.userId);
    if (!chosen) throw new Error("No encontré a esa invitada.");
    if (isAdminEmail(chosen.email)) {
      throw new Error("La cuenta de admin no puede ser la novia.");
    }
    const people = await ctx.db.query("users").collect();
    for (const person of people) {
      if (person.isBride && person._id !== chosen._id) {
        await ctx.db.patch(person._id, { isBride: false });
      }
    }
    await ctx.db.patch(chosen._id, { isBride: true });
  },
});

export const clearBride = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user?.isAdmin) throw new Error("Solo la admin puede cambiar a la novia.");
    const people = await ctx.db.query("users").collect();
    for (const person of people) {
      if (person.isBride) await ctx.db.patch(person._id, { isBride: false });
    }
  },
});
