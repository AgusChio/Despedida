import { useMutation, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import { examBank } from "../data/exam.ts";
import { said } from "../lib/said.ts";
import { useToast } from "./Toaster.tsx";

function blank() {
  return Array.from({ length: examBank.length }, () => "");
}

export function Exam({
  isBride,
  isAdmin,
  named,
  preview = false,
}: {
  isBride: boolean;
  isAdmin: boolean;
  named: boolean;
  preview?: boolean;
}) {
  if (isBride) return <BrideExam named={named} preview={preview} />;
  return <GuestExam isAdmin={isAdmin} named={named} />;
}

function BrideExam({ named, preview }: { named: boolean; preview: boolean }) {
  const saved = useQuery(api.exam.mine);
  const save = useMutation(api.exam.save);
  const toast = useToast();
  const [draft, setDraft] = useState<string[] | null>(null);
  const [pending, setPending] = useState(false);
  const answers = draft ?? (saved && saved.length === examBank.length ? saved : blank());
  const done = saved !== undefined && saved.length === examBank.length;

  if (saved === undefined) return <Loading />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (preview) {
      toast.note("Esto es una vista. Caro lo guarda desde su Gmail.");
      return;
    }
    setPending(true);
    try {
      await save({ answers });
      setDraft(null);
      toast.ok(done ? "Listo. Quedaron los cambios." : "Listo. Ya pueden contestar las chicas.");
    } catch (caught) {
      toast.error(said(caught, "No se pudieron guardar las respuestas."));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="exam" aria-label="Examen sorpresa">
      <p className="eyebrow">Solo en esta tarde</p>
      <h3>¿Quién conoce más a la novia?</h3>
      <p className="moment-lead">
        Estas las respondés vos. Podés cambiarlas cuando quieras. Cuando estén las veinte, las chicas
        pueden contestar.
      </p>
      <ChoiceForm
        answers={answers}
        named={named}
        pending={pending}
        submitLabel={done ? "Guardar cambios" : "Guardar respuestas"}
        onChange={(index, value) =>
          setDraft(answers.map((answer, item) => (item === index ? value : answer)))
        }
        onSubmit={(event) => void submit(event)}
      />
    </section>
  );
}

function GuestExam({ isAdmin, named }: { isAdmin: boolean; named: boolean }) {
  const open = useQuery(api.exam.open);
  const saved = useQuery(api.exam.mine);
  const results = useQuery(api.exam.results, isAdmin ? {} : "skip");
  const save = useMutation(api.exam.save);
  const toast = useToast();
  const [draft, setDraft] = useState<string[] | null>(null);
  const [pending, setPending] = useState(false);
  const answers = draft ?? (saved && saved.length === examBank.length ? saved : blank());
  const done = saved !== undefined && saved.length === examBank.length;

  if (open === undefined || saved === undefined) return <Loading />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await save({ answers });
      setDraft(null);
      toast.ok("Listo. Quedó tu examen.");
    } catch (caught) {
      toast.error(said(caught, "No se pudo guardar el examen."));
    } finally {
      setPending(false);
    }
  }

  const ranking = results?.ranking ?? [];
  const top = ranking[0]?.score ?? 0;
  const closest = ranking.filter((person) => person.score === top && top > 0);

  return (
    <section className="exam" aria-label="Examen sorpresa">
      <p className="eyebrow">Solo en esta tarde</p>
      <h3>¿Quién conoce más a la novia?</h3>
      {open ? (
        <>
          <p className="moment-lead">Elegí lo que haría Caro. Las respuestas las ve la organizadora.</p>
          <ChoiceForm
            answers={answers}
            named={named}
            pending={pending}
            submitLabel={done ? "Guardar de nuevo" : "Entregar"}
            onChange={(index, value) =>
              setDraft(answers.map((answer, item) => (item === index ? value : answer)))
            }
            onSubmit={(event) => void submit(event)}
          />
        </>
      ) : (
        <p className="moment-lead">
          Caro elige primero las respuestas. Cuando termine las veinte, se abre y pueden contestar.
        </p>
      )}
      {isAdmin && (
        <div className="exam-results">
          <p className="eyebrow">Quién conoce más a la novia</p>
          {!results?.ready && <p className="album-note">Caro todavía no terminó las suyas.</p>}
          {results?.ready && ranking.length === 0 && <p className="album-note">Todavía nadie contestó.</p>}
          {closest.length > 0 && (
            <p className="moment-lead">
              {closest.map((person) => person.displayName).join(", ")} · {top} de {examBank.length}.
            </p>
          )}
          {ranking.map((person) => (
            <article key={person.userId}>
              <h4>
                {person.displayName}
                <span className="exam-score">
                  {person.score} de {examBank.length}
                </span>
              </h4>
              <ol>
                {examBank.map((item, index) => {
                  const hers = results?.brideAnswers[index];
                  const picked = person.answers[index];
                  return (
                    <li key={item.question}>
                      <span>
                        {index + 1}. {item.question}
                      </span>
                      {picked}
                      {picked !== hers && <em className="exam-miss">Caro: {hers}</em>}
                    </li>
                  );
                })}
              </ol>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ChoiceForm({
  answers,
  named,
  pending,
  submitLabel,
  onChange,
  onSubmit,
}: {
  answers: string[];
  named: boolean;
  pending: boolean;
  submitLabel: string;
  onChange: (index: number, value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form className="exam-form" onSubmit={onSubmit}>
      {examBank.map((item, index) => (
        <fieldset key={item.question} className="exam-choices" disabled={!named || pending}>
          <legend>
            {index + 1}. {item.question}
          </legend>
          {item.options.map((option) => (
            <label key={option}>
              <input
                type="radio"
                name={`pregunta-${index}`}
                value={option}
                checked={answers[index] === option}
                required
                onChange={() => onChange(index, option)}
              />
              {option}
            </label>
          ))}
        </fieldset>
      ))}
      {!named && <p className="album-note">Confirmá tu nombre para contestarlo.</p>}
      <button type="submit" className="gmail" disabled={!named || pending}>
        {pending ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}

function Loading() {
  return (
    <section className="exam" aria-label="Examen sorpresa">
      <p className="album-note">Cargando el examen…</p>
    </section>
  );
}
