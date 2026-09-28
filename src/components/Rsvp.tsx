import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { MomentId } from "../data/itinerary.ts";

export function Rsvp({ slug, named }: { slug: MomentId; named: boolean }) {
  const people = useQuery(api.rsvp.list, { itinerarySlug: slug });
  const answer = useMutation(api.rsvp.answer);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const mine = people?.find((person) => person.mine);
  const coming = people?.filter((person) => person.going) ?? [];
  const staying = people?.filter((person) => !person.going) ?? [];

  async function choose(going: boolean) {
    setPending(true);
    setError(null);
    try {
      await answer({ itinerarySlug: slug, going });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo guardar.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rsvp" aria-label="Quién va">
      <p className="eyebrow">¿Venís?</p>
      <div className="rsvp-choice">
        <button
          type="button"
          className={mine?.going === true ? "is-yes" : ""}
          disabled={!named || pending}
          onClick={() => void choose(true)}
        >
          Sí
        </button>
        <button
          type="button"
          className={mine?.going === false ? "is-no" : ""}
          disabled={!named || pending}
          onClick={() => void choose(false)}
        >
          No
        </button>
      </div>
      {!named && (
        <p className="album-note">Confirmá tu nombre para responder.</p>
      )}
      {error && <p className="form-error">{error}</p>}
      {people && people.length === 0 && (
        <p className="album-note">Todavía nadie contestó.</p>
      )}
      {people && people.length > 0 && (
        <details className="rsvp-fold">
          <summary>
            {coming.length === 1 ? "Viene 1" : `Vienen ${coming.length}`}
          </summary>
          {coming.length > 0 && (
            <ul className="rsvp-people">
              {coming.map((person) => (
                <li key={person.userId}>
                  <Face name={person.displayName} image={person.image} />
                  <span>{person.displayName}</span>
                </li>
              ))}
            </ul>
          )}
          {staying.length > 0 && (
            <p className="album-note">
              No pueden: {staying.map((person) => person.displayName).join(", ")}.
            </p>
          )}
        </details>
      )}
    </section>
  );
}

function Face({ name, image }: { name: string; image: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  if (image) {
    return <img className="face" src={image} alt="" referrerPolicy="no-referrer" />;
  }
  return (
    <span className="face face-fallback" aria-hidden="true">
      {initial}
    </span>
  );
}
