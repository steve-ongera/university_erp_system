export default function PlaceholderPage({ title }) {
  return (
    <div className="mu-card" style={{ textAlign: "center", padding: 48 }}>
      <i className="bi bi-cone-striped" style={{ fontSize: "2rem", color: "var(--mu-text-muted)" }} />
      <h3 style={{ marginTop: 12 }}>{title}</h3>
      <p style={{ color: "var(--mu-text-muted)" }}>This page is wired into routing and ready for its API-backed build-out.</p>
    </div>
  );
}
