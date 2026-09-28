import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";

const ALLOWED_ORIGINS = ["http://localhost:5173", "https://aguschio.github.io"];

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],
  callbacks: {
    async redirect({ redirectTo }) {
      const url = new URL(redirectTo);
      if (!ALLOWED_ORIGINS.includes(url.origin)) {
        throw new Error("Esa vuelta no está permitida.");
      }
      return url.toString();
    },
  },
});
