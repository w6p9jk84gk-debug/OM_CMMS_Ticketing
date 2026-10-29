import Link from "next/link";
export default function NotFound() {
  return (
    <main className="standalone-state">
      <h1>Seite nicht gefunden</h1>
      <p>Diese Seite ist nicht verfügbar.</p>
      <Link className="button primary" href="/">
        Zum Dashboard
      </Link>
    </main>
  );
}
