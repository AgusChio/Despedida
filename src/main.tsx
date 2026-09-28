import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ToasterProvider } from "./components/Toaster.tsx";
import "./index.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToasterProvider>
      {convex ? (
        <ConvexAuthProvider client={convex}>
          <App connected />
        </ConvexAuthProvider>
      ) : (
        <App connected={false} />
      )}
    </ToasterProvider>
  </StrictMode>,
);
