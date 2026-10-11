import { useMutation, useQuery } from "convex/react";
import { Component, useState, type FormEvent, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import { examBank } from "../data/exam.ts";
import { said } from "../lib/said.ts";
import { useToast } from "./Toaster.tsx";

function blank() {
  return Array.from({ length: examBank.length }, () => "");
}

class ExamBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <section className="exam" aria-label="Examen sorpresa">
          <p className="album-note">El examen no está disponible ahora.</p>
        </section>
      );
    }
    return this.props.children;
  }
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
  return (
    <ExamBoundary>
      {isBride ? <BrideExam named={named} preview={preview} /> : <GuestExam isAdmin={isAdmin} named={named} />}
    </ExamBoundary>
  );
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
      toast.ok("Listo. Ya pueden contestar las chicas.");
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
        {done && !preview
          ? "Tus respuestas ya quedaron. No se pueden cambiar."
          : "Estas las respondés vos, una sola vez. Cuando estén las veinte, las chicas pueden contestar."}
      </p>
      <ChoiceForm
        answers={answers}
        named={named}
        pending={pending}
        locked={done && !preview}
        submitLabel="Guardar respuestas"
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
  const roster = useQuery(api.exam.roster);
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

  const people = roster?.people ?? [];
  const top = people[0] && "score" in people[0] ? (people[0].score ?? 0) : 0;
  const closest = people.filter((person) => "score" in person && person.score === top && top > 0);

  return (
    <section className="exam" aria-label="Examen sorpresa">
      <p className="eyebrow">Solo en esta tarde</p>
      <h3>¿Quién conoce más a la novia?</h3>
      {open ? (
        <>
          <p className="moment-lead">Elegí lo que haría Caro. Las respuestas no se muestran.</p>
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
      <div className="exam-results">
        <p className="eyebrow">Ya contestaron</p>
        {roster && !roster.ready && <p className="album-note">Caro todavía no terminó las suyas.</p>}
        {roster?.ready && people.length === 0 && <p className="album-note">Todavía nadie contestó.</p>}
        {isAdmin && closest.length > 0 && (
          <p className="moment-lead">
            {closest.map((person) => person.displayName).join(", ")} · {top} de {examBank.length}.
          </p>
        )}
        {people.map((person) => (
          <details key={person.userId} className="exam-acc">
            <summary>
              <span>{person.displayName}</span>
              {isAdmin && "score" in person && (
                <span className="exam-score">
                  {person.score} de {examBank.length}
                </span>
              )}
            </summary>
            <p className="album-note">
              {isAdmin && "score" in person
                ? `Acertó ${person.score} de ${examBank.length}.`
                : "Ya entregó."}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

function ChoiceForm({
  answers,
  named,
  pending,
  locked = false,
  submitLabel,
  onChange,
  onSubmit,
}: {
  answers: string[];
  named: boolean;
  pending: boolean;
  locked?: boolean;
  submitLabel: string;
  onChange: (index: number, value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form className="exam-form" onSubmit={onSubmit}>
      {examBank.map((item, index) => (
        <fieldset key={item.question} className="exam-choices" disabled={!named || pending || locked}>
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
      {!locked && (
        <button type="submit" className="gmail" disabled={!named || pending}>
          {pending ? "Guardando…" : submitLabel}
        </button>
      )}
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
