import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { said } from "../lib/said.ts";
import { useToast } from "./Toaster.tsx";

export function Gate() {
  const { signIn } = useAuthActions();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  async function enter() {
    setPending(true);
    try {
      const home = new URL(import.meta.env.BASE_URL, window.location.origin).href;
      await signIn("google", { redirectTo: home });
    } catch (caught) {
      setPending(false);
      toast.error(said(caught, "No se pudo abrir Google. Probá de nuevo en un momento."));
    }
  }

  return (
    <main className="invitation gate">
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
      <p className="legal-links">
        <a href={`${import.meta.env.BASE_URL}privacidad.html`}>Política de privacidad</a>
        <a href={`${import.meta.env.BASE_URL}condiciones.html`}>Condiciones del servicio</a>
      </p>
    </main>
  );
}
