import { useMutation, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import { examQuestions, tagOptions, tagQuestion } from "../data/exam.ts";
import { said } from "../lib/said.ts";
import { useToast } from "./Toaster.tsx";

const total = examQuestions.length + 1;

function blank() {
  return Array.from({ length: total }, () => "");
}

export function Exam({ isBride, isAdmin, named }: { isBride: boolean; isAdmin: boolean; named: boolean }) {
  if (isBride) {
    return (
      <section className="exam" aria-label="Examen sorpresa">
        <p className="eyebrow">Solo en esta tarde</p>
        <h3>¿Quién conoce más a la novia?</h3>
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
  const answers =
    draft ??
    (saved && saved.length > 0 ? blank().map((item, index) => saved[index] ?? item) : blank());
  const tag = answers[examQuestions.length] ?? "";
  const other = tag.startsWith("Otra:") ? tag.slice(5).trim() : "";
  const picked = tag.startsWith("Otra") ? "Otra" : tag;

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

  function setTag(option: string) {
    const value = option === "Otra" ? `Otra: ${other}` : option;
    setAnswer(examQuestions.length, value);
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

  const closest = results?.filter((person) => person.knowsHer) ?? [];
  const rest = results?.filter((person) => !person.knowsHer) ?? [];

  return (
    <section className="exam" aria-label="Examen sorpresa">
      <p className="eyebrow">Solo en esta tarde</p>
      <h3>¿Quién conoce más a la novia?</h3>
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
        <fieldset className="exam-choices" disabled={!named || pending}>
          <legend>{tagQuestion}</legend>
          {tagOptions.map((option) => (
            <label key={option}>
              <input
                type="radio"
                name="etiqueta"
                value={option}
                checked={picked === option}
                required
                onChange={() => setTag(option)}
              />
              {option}
            </label>
          ))}
          {picked === "Otra" && (
            <textarea
              value={other}
              required
              rows={2}
              placeholder="Contá qué hace"
              onChange={(event) => setAnswer(examQuestions.length, `Otra: ${event.target.value}`)}
            />
          )}
        </fieldset>
        {!named && <p className="album-note">Confirmá tu nombre para contestarlo.</p>}
        <button type="submit" className="gmail" disabled={!named || pending}>
          {pending ? "Guardando…" : saved && saved.length > 0 ? "Guardar de nuevo" : "Entregar"}
        </button>
      </form>
      {isAdmin && (
        <div className="exam-results">
          <p className="eyebrow">Quién conoce más a la novia</p>
          {results && results.length === 0 && <p className="album-note">Todavía nadie contestó.</p>}
          {closest.length > 0 && (
            <p className="moment-lead">{closest.map((person) => person.displayName).join(", ")}.</p>
          )}
          {rest.length > 0 && closest.length > 0 && (
            <p className="album-note">
              También contestaron: {rest.map((person) => person.displayName).join(", ")}.
            </p>
          )}
          {results?.map((person) => (
            <article key={person.userId}>
              <h4>{person.displayName}</h4>
              <ol>
                {examQuestions.map((question, index) => (
                  <li key={question}>
                    <span>{question}</span>
                    {person.answers[index]}
                  </li>
                ))}
                <li>
                  <span>{tagQuestion}</span>
                  {person.answers[examQuestions.length]}
                </li>
              </ol>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
