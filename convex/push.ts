"use node";

import webpush from "web-push";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, type ActionCtx } from "./_generated/server";
import { rsvpText } from "./alerts";

const moment = v.union(v.literal("tarde"), v.literal("escapada"), v.literal("cafe"));

function sender() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:agus.chio25790@gmail.com";
  if (!publicKey || !privateKey) return null;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return webpush;
}

async function fanout(
  ctx: ActionCtx,
  userId: Id<"users">,
  payload: { title: string; body: string; hash: string },
) {
  const push = sender();
  if (!push) return;
  const targets: Array<{ endpoint: string; p256dh: string; auth: string }> = await ctx.runQuery(
    internal.alerts.targets,
    { userId },
  );
  for (const target of targets) {
    try {
      await push.sendNotification(
        {
          endpoint: target.endpoint,
          keys: { p256dh: target.p256dh, auth: target.auth },
        },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          hash: payload.hash,
        }),
      );
    } catch (caught) {
      const status = (caught as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await ctx.runMutation(internal.alerts.drop, { endpoint: target.endpoint });
      }
    }
  }
}

export const flush = internalAction({
  args: {
    userId: v.id("users"),
    itinerarySlug: moment,
    token: v.string(),
  },
  handler: async (ctx, args): Promise<null> => {
    const note: { body: string; hash: string } | null = await ctx.runMutation(internal.alerts.takeUpload, {
      userId: args.userId,
      itinerarySlug: args.itinerarySlug,
      token: args.token,
    });
    if (!note) return null;
    await fanout(ctx, args.userId, {
      title: "Despedida de Caro",
      body: note.body,
      hash: note.hash,
    });
    return null;
  },
});

export const sendRsvp = internalAction({
  args: {
    userId: v.id("users"),
    name: v.string(),
    itinerarySlug: moment,
    going: v.boolean(),
  },
  handler: async (ctx, args): Promise<null> => {
    await fanout(ctx, args.userId, {
      title: "Despedida de Caro",
      body: rsvpText(args.name, args.going, args.itinerarySlug),
      hash: args.itinerarySlug,
    });
    return null;
  },
});
