export function Opening({
  slow,
  onRetry,
}: {
  slow: boolean;
  onRetry: () => void;
}) {
  return (
    <main className="invitation gate opening">
      <p className="eyebrow">Despedida de soltera · 2026</p>
      <h1>Caro</h1>
      <p className="dates">
        <span>10</span>
        <span className="dates-line" aria-hidden="true" />
        <span>12</span>
      </p>
      <p className="month">de octubre</p>
      {slow ? (
        <>
          <p className="lede">
            Está tardando más de lo normal. Volvé a entrar con tu Gmail.
          </p>
          <button type="button" className="gmail" onClick={onRetry}>
            Volver a entrar
          </button>
        </>
      ) : (
        <>
          <div className="opening-line" aria-hidden="true" />
          <p className="opening-status">Abriendo la invitación</p>
        </>
      )}
    </main>
  );
}
