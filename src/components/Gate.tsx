import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { Sprig } from "./Sprig.tsx";

export function Gate() {
  const { signIn } = useAuthActions();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enter() {
    setPending(true);
    setError(null);
    try {
      const home = new URL(import.meta.env.BASE_URL, window.location.origin).href;
      await signIn("google", { redirectTo: home });
    } catch {
      setPending(false);
      setError("No se pudo abrir Google. Probá de nuevo en un momento.");
    }
  }

  return (
    <main className="invitation gate">
      <Sprig />
      <p className="eyebrow">Despedida de soltera · 2026</p>
      <h1>Caro</h1>
      <p className="dates">
        <span>10</span>
        <span className="dates-line" aria-hidden="true" />
        <span>12</span>
      </p>
      <p className="month">de octubre</p>
      <p className="lede">
        Entrá con tu Gmail para ver el finde y subir las fotos.
      </p>
      <button
        type="button"
        className="gmail"
        disabled={pending}
        onClick={() => void enter()}
      >
        {pending ? "Abriendo Google…" : "Entrar con Gmail"}
      </button>
      {error && <p className="form-error">{error}</p>}
    </main>
  );
}
