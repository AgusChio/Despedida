import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../convex/_generated/api";
import { AdminPanel } from "./components/AdminPanel.tsx";
import { Gate } from "./components/Gate.tsx";
import { Invitation } from "./components/Invitation.tsx";
import { Opening } from "./components/Opening.tsx";
import { Profile } from "./components/Profile.tsx";
import { Sprig } from "./components/Sprig.tsx";
import { TabBar, type Page } from "./components/TabBar.tsx";
import { useToast } from "./components/Toaster.tsx";
import type { MomentId } from "./data/itinerary.ts";

export default function App({ connected }: { connected: boolean }) {
  if (!connected) {
    return (
      <main className="invitation gate">
        <p className="lede">Falta conectar Convex para abrir la despedida.</p>
      </main>
    );
  }
  return <AuthedApp />;
}

function readPage(): Page {
  const value = window.location.hash.replace("#", "");
  if (value === "perfil" || value === "panel") return value;
  return "inicio";
}

function readMoment(): MomentId | null {
  const value = window.location.hash.replace("#", "");
  if (value === "tarde" || value === "escapada" || value === "cafe") return value;
  return null;
}

function AuthedApp() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const toast = useToast();
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");
  const copies = useQuery(api.plan.copies, isAuthenticated ? {} : "skip");
  const arm = useMutation(api.plan.arm);
  const [page, setPage] = useState<Page>(readPage);
  const [moment, setMoment] = useState<MomentId | null>(readMoment);
  const [slow, setSlow] = useState(false);
  const waiting = isLoading || (isAuthenticated && viewer === undefined);

  useEffect(() => {
    if (viewer?.hasName) void arm();
  }, [arm, viewer?.hasName]);

  useEffect(() => {
    if (!waiting) {
      setSlow(false);
      return;
    }
    const timer = window.setTimeout(() => setSlow(true), 4500);
    return () => window.clearTimeout(timer);
  }, [waiting]);

  useEffect(() => {
    const onHash = () => {
      setPage(readPage());
      setMoment(readMoment());
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (page !== "inicio" || !moment) return;
    document.getElementById(moment)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [page, moment]);

  useEffect(() => {
    if (viewer && !viewer.isAdmin && page === "panel") {
      window.location.hash = "#inicio";
    }
  }, [page, viewer]);

  if (waiting) {
    return (
      <Opening
        slow={slow}
        onRetry={() => {
          window.location.replace(window.location.origin);
        }}
      />
    );
  }

  if (!isAuthenticated || !viewer) return <Gate />;

  function go(next: Page) {
    const hash = `#${next}`;
    if (window.location.hash === hash) {
      setPage(next);
      window.scrollTo(0, 0);
      return;
    }
    window.location.hash = hash;
    window.scrollTo(0, 0);
  }

  function leave() {
    toast.ask("¿Salís de la invitación?", () => void signOut(), "Salir", "Quedarme");
  }

  function goMoment(id: MomentId) {
    setPage("inicio");
    setMoment(id);
    const hash = `#${id}`;
    if (window.location.hash !== hash) window.location.hash = hash;
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  const current = page === "panel" && !viewer.isAdmin ? "inicio" : page;

  return (
    <div className="app-shell">
      <main className="invitation">
        {current === "inicio" && (
          <Invitation
            copies={copies}
            isAdmin={viewer.isAdmin}
            uploaderName={viewer.displayName}
            named={viewer.hasName}
            connected
          />
        )}
        {current === "perfil" && (
          <Profile
            email={viewer.email}
            image={viewer.image}
            displayName={viewer.displayName}
            profileName={viewer.profileName}
            firstName={viewer.firstName}
            lastName={viewer.lastName}
            isBride={viewer.isBride}
            isAdmin={viewer.isAdmin}
            hasName={viewer.hasName}
          />
        )}
        {current === "panel" && viewer.isAdmin && (
          <>
            <header className="hero">
              <Sprig />
              <p className="eyebrow">Solo vos</p>
              <h1 className="profile-name">Panel</h1>
              <p className="lede">Las invitadas, la novia y Drive.</p>
            </header>
            <AdminPanel />
          </>
        )}
      </main>
      <TabBar
        page={current}
        moment={current === "inicio" ? moment : null}
        isAdmin={viewer.isAdmin}
        image={viewer.image}
        onMoment={goMoment}
        onNavigate={go}
        onSignOut={leave}
      />
    </div>
  );
}
