"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone-state">
      <h1>Die Seite konnte nicht geladen werden.</h1>
      <p>Bitte versuchen Sie es erneut.</p>
      <button className="button primary" onClick={reset}>
        Erneut versuchen
      </button>
    </main>
  );
}
