import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function AdminPanel() {
  const guests = useQuery(api.users.guests);
  const connection = useQuery(api.photos.connection);
  const setBride = useMutation(api.users.setBride);
  const clearBride = useMutation(api.users.clearBride);
  const [error, setError] = useState<string | null>(null);

  async function choose(userId: Id<"users">) {
    setError(null);
    try {
      await setBride({ userId });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo marcar a la novia.",
      );
    }
  }

  return (
    <section className="admin" aria-label="Panel de invitadas">
      <div className="album-head">
        <h2>Invitadas</h2>
        <p>{guests ? `${guests.length}` : ""}</p>
      </div>
      <p className="album-note">
        Las invitadas ven el plan. La actividad del sábado y la de la escapada solo las ves vos.
      </p>
      {error && <p className="form-error">{error}</p>}
      <ul className="guests">
        {guests?.map((guest) => (
          <li key={guest.id}>
            <div>
              <strong>{guest.displayName || "Sin nombre"}</strong>
              <span>{guest.email}</span>
            </div>
            {guest.isAdmin ? (
              <span className="pill">Admin</span>
            ) : guest.isBride ? (
              <button
                type="button"
                className="pill pill-button"
                onClick={() => void clearBride()}
              >
                Novia · quitar
              </button>
            ) : (
              <button
                type="button"
                className="pill pill-button"
                onClick={() => void choose(guest.id)}
              >
                Es la novia
              </button>
            )}
          </li>
        ))}
      </ul>
      {guests?.length === 0 && (
        <p className="album-note">Todavía no entró nadie.</p>
      )}
      <section className="drive-help" aria-label="Google Drive">
        <h3>Google Drive</h3>
        {connection === undefined ? null : connection.connected ? (
          <p className="album-note">
            Drive está conectado. Las fotos nuevas también se guardan en las
            carpetas de cada momento.
          </p>
        ) : (
          <>
            <p className="album-note">
              Todavía no está conectado. Las fotos ya se ven en la página. Para
              que además se copien a tu Drive:
            </p>
            <ol className="steps">
              <li>
                En Google Cloud, activá la API de Google Drive en el mismo
                proyecto.
              </li>
              <li>
                Creá un cliente de OAuth de tipo Aplicación de escritorio. Es
                otro, distinto del de Gmail.
              </li>
              <li>
                En la carpeta del proyecto, con la página corriendo, ejecutá{" "}
                <code>npm run drive:conectar</code>.
              </li>
              <li>
                Pegá el Client ID y el Client secret, y entrá con el Gmail donde
                querés las fotos.
              </li>
            </ol>
            <p className="album-note">
              El script crea la carpeta Despedida Caro y una por cada momento.
            </p>
          </>
        )}
      </section>
    </section>
  );
}
