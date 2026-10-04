import { useMutation, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import { examQuestions } from "../data/exam.ts";
import { said } from "../lib/said.ts";
import { useToast } from "./Toaster.tsx";

export function Exam({ isBride, isAdmin, named }: { isBride: boolean; isAdmin: boolean; named: boolean }) {
  if (isBride) {
    return (
      <section className="exam" aria-label="Examen sorpresa">
        <p className="eyebrow">Solo en esta tarde</p>
        <h3>Examen sorpresa</h3>
        <p className="moment-lead">Las chicas lo contestan. Vos no.</p>
      </section>
    );
  }
  return <GuestExam isAdmin={isAdmin} named={named} />;
}

function GuestExam({ isAdmin, named }: { isAdmin: boolean; named: boolean }) {
  const saved = useQuery(api.exam.mine);
  const results = useQuery(api.exam.results, isAdmin ? {} : "skip");
  const save = useMutation(api.exam.save);
  const toast = useToast();
  const [draft, setDraft] = useState<string[] | null>(null);
  const [pending, setPending] = useState(false);
  const answers = draft ?? (saved && saved.length === examQuestions.length ? saved : examQuestions.map(() => ""));

  if (saved === undefined) {
    return (
      <section className="exam" aria-label="Examen sorpresa">
        <p className="album-note">Cargando el examen…</p>
      </section>
    );
  }

  function setAnswer(index: number, value: string) {
    setDraft(answers.map((answer, item) => (item === index ? value : answer)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await save({ answers });
      toast.ok("Listo. Quedó tu examen.");
    } catch (caught) {
      toast.error(said(caught, "No se pudo guardar el examen."));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="exam" aria-label="Examen sorpresa">
      <p className="eyebrow">Solo en esta tarde</p>
      <h3>Examen sorpresa</h3>
      <p className="moment-lead">Sobre Caro. Las respuestas las ve la organizadora.</p>
      <form className="exam-form" onSubmit={(event) => void submit(event)}>
        {examQuestions.map((question, index) => (
          <label key={question}>
            <span>{question}</span>
            <textarea
              value={answers[index] ?? ""}
              required
              rows={2}
              disabled={!named || pending}
              onChange={(event) => setAnswer(index, event.target.value)}
            />
          </label>
        ))}
        {!named && <p className="album-note">Confirmá tu nombre para contestarlo.</p>}
        <button type="submit" className="gmail" disabled={!named || pending}>
          {pending ? "Guardando…" : saved && saved.length > 0 ? "Guardar de nuevo" : "Entregar"}
        </button>
      </form>
      {isAdmin && (
        <div className="exam-results">
          <p className="eyebrow">Respuestas</p>
          {results && results.length === 0 && <p className="album-note">Todavía nadie contestó.</p>}
          {results?.map((person) => (
            <article key={person.userId}>
              <h4>{person.displayName}</h4>
              <ol>
                {person.answers.map((answer, index) => (
                  <li key={examQuestions[index]}>
                    <span>{examQuestions[index]}</span>
                    {answer}
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
