import { useMutation, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { said } from "../lib/said.ts";
import { useToast } from "./Toaster.tsx";

export function AdminPanel() {
  const guests = useQuery(api.users.guests);
  const connection = useQuery(api.photos.connection);
  const setBride = useMutation(api.users.setBride);
  const clearBride = useMutation(api.users.clearBride);
  const renameGuest = useMutation(api.users.renameGuest);
  const toast = useToast();

  async function choose(userId: Id<"users">) {
    try {
      await setBride({ userId });
      toast.ok("Quedó marcada como novia.");
    } catch (caught) {
      toast.error(said(caught, "No se pudo marcar a la novia."));
    }
  }

  async function forget() {
    try {
      await clearBride();
      toast.ok("Ya no está marcada como novia.");
    } catch (caught) {
      toast.error(said(caught, "No se pudo quitar a la novia."));
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
        Si alguien no carga su nombre, lo podés escribir vos.
      </p>
      <ul className="guests">
        {guests?.map((guest) => (
          <GuestRow
            key={guest.id}
            guest={guest}
            onBride={() => void choose(guest.id)}
            onForget={() => void forget()}
            onRename={(firstName, lastName) => renameGuest({ userId: guest.id, firstName, lastName })}
          />
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

function GuestRow({
  guest,
  onBride,
  onForget,
  onRename,
}: {
  guest: {
    email: string;
    displayName: string;
    firstName: string;
    lastName: string;
    hasName: boolean;
    isAdmin: boolean;
    isBride: boolean;
  };
  onBride: () => void;
  onForget: () => void;
  onRename: (firstName: string, lastName: string) => Promise<null>;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(guest.firstName);
  const [lastName, setLastName] = useState(guest.lastName);
  const [pending, setPending] = useState(false);

  function open() {
    setFirstName(guest.firstName);
    setLastName(guest.lastName);
    setEditing(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await onRename(firstName, lastName);
      toast.ok("Quedó el nombre.");
      setEditing(false);
    } catch (caught) {
      toast.error(said(caught, "No se pudo guardar el nombre."));
    } finally {
      setPending(false);
    }
  }

  return (
    <li className={editing ? "is-editing" : undefined}>
      <div>
        <strong>{guest.displayName || "Sin nombre"}</strong>
        <span>{guest.email}</span>
        {!guest.hasName && <span className="guest-missing">Falta el nombre</span>}
      </div>
      {editing ? (
        <form className="guest-edit" onSubmit={(event) => void submit(event)}>
          <input
            value={firstName}
            aria-label="Nombre"
            placeholder="Nombre"
            autoComplete="given-name"
            required
            onChange={(event) => setFirstName(event.target.value)}
          />
          <input
            value={lastName}
            aria-label="Apellido"
            placeholder="Apellido"
            autoComplete="family-name"
            required
            onChange={(event) => setLastName(event.target.value)}
          />
          <div className="guest-actions">
            <button type="submit" className="pill pill-button" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </button>
            <button type="button" className="pill" disabled={pending} onClick={() => setEditing(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="guest-actions">
          <button type="button" className="pill pill-button" onClick={open}>
            Editar nombre
          </button>
          {guest.isAdmin ? (
            <span className="pill">Admin</span>
          ) : guest.isBride ? (
            <button type="button" className="pill pill-button" onClick={onForget}>
              Novia · quitar
            </button>
          ) : (
            <button type="button" className="pill pill-button" onClick={onBride}>
              Es la novia
            </button>
          )}
        </div>
      )}
    </li>
  );
}
