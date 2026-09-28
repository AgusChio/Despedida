import { Album } from "./Album.tsx";
import { Rsvp } from "./Rsvp.tsx";
import { moments } from "../data/itinerary.ts";

type MomentCopy = {
  lead: string;
  details: string[];
  note: string | null;
};

function forBride(text: string, isBride: boolean) {
  return isBride ? text.replace("de negro", "de blanco").replace("De negro", "De blanco") : text;
}

export function Invitation({
  copies,
  isAdmin,
  isBride,
  uploaderName,
  named,
  connected,
}: {
  copies: { tarde: MomentCopy | null; escapada: MomentCopy | null } | null | undefined;
  isAdmin: boolean;
  isBride: boolean;
  uploaderName: string;
  named: boolean;
  connected: boolean;
}) {
  return (
    <>
      <header className="hero">
        <p className="eyebrow">Despedida de soltera · 2026</p>
        <h1>Caro</h1>
        <p className="dates">
          <span>10</span>
          <span className="dates-line" aria-hidden="true" />
          <span>12</span>
        </p>
        <p className="month">de octubre</p>
        <p className="lede">
          Un fin de semana para estar juntas, reírnos y despedirla despacio.
        </p>
      </header>

      <section className="timeline" aria-label="Momentos del finde">
        {moments.map((moment) => {
          const extra =
            moment.id === "tarde"
              ? copies?.tarde
              : moment.id === "escapada"
                ? copies?.escapada
                : null;
          const lead =
            extra?.lead ??
            (moment.id === "tarde" ? forBride(moment.lead, isBride) : moment.lead);
          const details = (extra?.details ?? [...moment.details]).map((detail) =>
            moment.id === "tarde" ? forBride(detail, isBride) : detail,
          );
          const note = extra?.note ?? null;
          return (
            <article key={moment.id} id={moment.id} className="moment">
              <div className="moment-mark" aria-hidden="true">
                <span>{moment.step}</span>
              </div>
              <div className="moment-copy">
                <p className="moment-when">{moment.when}</p>
                <h2>{moment.title}</h2>
                <p className="moment-lead">{lead}</p>
                {note && <p className="secret-note">{note}</p>}
                {details.length > 0 && (
                  <ul className="details">
                    {details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                )}
                <Rsvp slug={moment.id} named={named} />
                <Album
                  slug={moment.id}
                  connected={connected}
                  isAdmin={isAdmin}
                  uploaderName={uploaderName}
                  named={named}
                />
              </div>
            </article>
          );
        })}
      </section>

      <footer className="closing">
        <p>Para Caro, con todo el cariño.</p>
      </footer>
    </>
  );
}
