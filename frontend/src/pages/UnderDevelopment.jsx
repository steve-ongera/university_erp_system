// src/pages/UnderDevelopment.jsx
import { useAuth } from "../context/AuthContext";

export default function UnderDevelopment({
  title = "This area is under development",
  message,
  plannedFeatures = [],
}) {
  const { user } = useAuth();
  const roleLabel = user?.user_type?.replace(/_/g, " ") || "your role";

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "60px 16px" }}>
      <div style={{ maxWidth: 480, textAlign: "center" }}>
        <div
          style={{
            width: 72, height: 72, borderRadius: "50%", background: "#eef1fb",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <i className="bi bi-cone-striped" style={{ fontSize: 30, color: "#3b6ce0" }} />
        </div>
        <h2 style={{ margin: "0 0 8px" }}>{title}</h2>
        <p style={{ color: "#666", margin: "0 0 20px" }}>
          {message || `There's no dedicated workspace for the "${roleLabel}" role in this portal yet. Your account is active and can log in, but no modules have been assigned to it.`}
        </p>

        {plannedFeatures.length > 0 && (
          <div style={{ textAlign: "left", background: "#f8f9fc", borderRadius: 10, padding: "16px 20px", marginBottom: 20 }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", color: "#999", marginBottom: 8, fontWeight: 600 }}>
              Planned for this role
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, color: "#444", fontSize: 14 }}>
              {plannedFeatures.map((f) => <li key={f} style={{ marginBottom: 4 }}>{f}</li>)}
            </ul>
          </div>
        )}

        <p style={{ fontSize: 13, color: "#999" }}>
          If you believe you should have access to something specific, contact your system administrator.
        </p>
      </div>
    </div>
  );
}