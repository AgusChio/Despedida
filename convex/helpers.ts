import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export const ADMIN_EMAIL = "agus.chio25790@gmail.com";
export const SATURDAY_UNLOCK_AT = Date.parse("2026-10-10T18:00:00-03:00");

export const UPLOAD_OPENS_AT = {
  tarde: Date.parse("2026-10-10T00:00:00-03:00"),
  escapada: Date.parse("2026-10-11T00:00:00-03:00"),
  cafe: Date.parse("2026-10-12T00:00:00-03:00"),
} as const;

export const UPLOAD_OPEN_LABEL = {
  tarde: "el sábado 10 de octubre",
  escapada: "el domingo 11 de octubre",
  cafe: "el lunes 12 de octubre",
} as const;

export function uploadsOpen(
  slug: keyof typeof UPLOAD_OPENS_AT,
  now = Date.now(),
) {
  return now >= UPLOAD_OPENS_AT[slug];
}

export function isAdminEmail(email: string | undefined) {
  return email?.trim().toLowerCase() === ADMIN_EMAIL;
}

export function displayNameOf(user: {
  firstName?: string;
  lastName?: string;
}) {
  return [user.firstName?.trim(), user.lastName?.trim()]
    .filter(Boolean)
    .join(" ");
}

export async function currentUser(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const user = await ctx.db.get(userId);
  if (!user) return null;
  const firstName = user.firstName?.trim() ?? "";
  const lastName = user.lastName?.trim() ?? "";
  return {
    id: user._id,
    email: user.email ?? "",
    image: user.image ?? "",
    profileName: user.name?.trim() ?? "",
    firstName,
    lastName,
    hasName: firstName.length >= 2 && lastName.length >= 2,
    isAdmin: isAdminEmail(user.email),
    isBride: user.isBride === true && !isAdminEmail(user.email),
    displayName: displayNameOf(user),
  };
}
