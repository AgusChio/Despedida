import type { MomentId } from "../data/itinerary.ts";

export type Page = "inicio" | "perfil" | "panel";

const moments: { id: MomentId; label: string; mark: string }[] = [
  { id: "tarde", label: "Tarde", mark: "01" },
  { id: "escapada", label: "Escapada", mark: "02" },
  { id: "cafe", label: "Cafecito", mark: "03" },
];

export function TabBar({
  page,
  moment,
  isAdmin,
  image,
  onMoment,
  onNavigate,
}: {
  page: Page;
  moment: MomentId | null;
  isAdmin: boolean;
  image: string;
  onMoment: (id: MomentId) => void;
  onNavigate: (page: Page) => void;
}) {
  return (
    <nav className="tabbar" aria-label="Navegación">
      {moments.map((item) => (
        <button
          key={item.id}
          type="button"
          className={page === "inicio" && moment === item.id ? "is-active" : ""}
          onClick={() => onMoment(item.id)}
        >
          <span className="tab-mark">{item.mark}</span>
          <span>{item.label}</span>
        </button>
      ))}
      {isAdmin && (
        <button
          type="button"
          className={page === "panel" ? "is-active" : ""}
          onClick={() => onNavigate("panel")}
        >
          <IconPanel />
          <span>Panel</span>
        </button>
      )}
      <button
        type="button"
        className={page === "perfil" ? "is-active" : ""}
        onClick={() => onNavigate("perfil")}
      >
        {image ? (
          <img className="tab-avatar" src={image} alt="" referrerPolicy="no-referrer" />
        ) : (
          <IconUser />
        )}
        <span>Vos</span>
      </button>
    </nav>
  );
}

function IconPanel() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.4" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19.2c1.2-3 3.5-4.4 6.5-4.4s5.3 1.4 6.5 4.4" />
    </svg>
  );
}
