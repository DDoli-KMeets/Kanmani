export function Spinner({ dark = false }: { dark?: boolean }) {
  return <span className={`spinner ${dark ? "spinner-dark" : ""}`} role="status" aria-label="Loading" />;
}
