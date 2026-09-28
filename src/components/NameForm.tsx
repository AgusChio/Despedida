import { useMutation } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import { said } from "../lib/said.ts";
import { useToast } from "./Toaster.tsx";

function seedName(profileName: string, first: string, last: string) {
  if (first.trim() || last.trim()) return { first, last };
  const parts = profileName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { first: parts[0] ?? "", last: "" };
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

export function NameForm({
  profileName,
  initialFirst,
  initialLast,
  onDone,
  intent = "confirm",
}: {
  profileName: string;
  initialFirst: string;
  initialLast: string;
  onDone?: () => void;
  intent?: "confirm" | "edit";
}) {
  const saveName = useMutation(api.users.saveName);
  const toast = useToast();
  const seeded = seedName(profileName, initialFirst, initialLast);
  const [firstName, setFirstName] = useState(seeded.first);
  const [lastName, setLastName] = useState(seeded.last);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await saveName({ firstName, lastName });
      toast.ok(intent === "edit" ? "Quedó tu nombre." : "Listo. Ya podés ver el finde.");
      onDone?.();
    } catch (caught) {
      toast.error(said(caught, "No se pudo guardar el nombre."));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="name-card">
      <p className="eyebrow">Tu lugar en el álbum</p>
      <h2>{intent === "edit" ? "Cambiar nombre" : "Nombre y apellido"}</h2>
      <p className="lede">
        {intent === "edit"
          ? "Así figuran tus fotos en el álbum y en Google Drive."
          : "Confirmalo una vez. Así van a figurar tus fotos en el álbum y en Google Drive."}
      </p>
      <form className="name-form" onSubmit={(event) => void submit(event)}>
        <label>
          <span>Nombre</span>
          <input
            value={firstName}
            autoComplete="given-name"
            required
            onChange={(event) => setFirstName(event.target.value)}
          />
        </label>
        <label>
          <span>Apellido</span>
          <input
            value={lastName}
            autoComplete="family-name"
            required
            onChange={(event) => setLastName(event.target.value)}
          />
        </label>
        <button type="submit" className="gmail" disabled={pending}>
          {pending ? "Guardando…" : intent === "edit" ? "Guardar" : "Listo"}
        </button>
      </form>
    </section>
  );
}
