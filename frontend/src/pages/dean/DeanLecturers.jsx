import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deanApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function DeanLecturers() {
  const [lecturers, setLecturers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      deanApi
        .lecturers({ search: search || undefined })
        .then((res) => setLecturers(res.data.results || res.data))
        .catch(() => setError("Could not load lecturers."))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  if (loading) {
    return <LoadingSpinner text="Loading lecturers..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-person-video3" />
            Lecturers
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Dean <span className="separator">/</span> Lecturers
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/dean/dashboard" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Info Alert */}
      <div className="mu-alert mu-alert-info" style={{ marginBottom: 24 }}>
        <i className="bi bi-info-circle" />
        <div>
          Read-only — lecturer accounts are managed by their department's COD.
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}

      {/* Lecturers Table */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-person-video3" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
            All Lecturers
          </h4>
          <span className="mu-badge mu-badge-primary">
            {lecturers.length} Lecturer(s)
          </span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {/* Search Bar inside table */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--mu-border)", background: "var(--mu-gray-50)" }}>
            <div style={{ position: "relative", maxWidth: 320 }}>
              <i className="bi bi-search" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--mu-gray-400)" }} />
              <input
                className="mu-input"
                style={{ paddingLeft: 32 }}
                placeholder="Search by name or employee no..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {lecturers.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-person-video3" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Lecturers Found</h3>
              <p style={{ margin: "8px 0 0" }}>No lecturers found in this faculty.</p>
            </div>
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Employee No.</th>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Rank</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lecturers.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <strong>{l.employee_number}</strong>
                      </td>
                      <td>
                        {l.user_detail?.first_name} {l.user_detail?.last_name}
                      </td>
                      <td>{l.department_detail?.name}</td>
                      <td>
                        <span className="mu-badge mu-badge-info">
                          {l.academic_rank || "—"}
                        </span>
                      </td>
                      <td>
                        <span className={`mu-badge ${l.is_active ? "mu-badge-success" : "mu-badge-gray"}`}>
                          {l.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {lecturers.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Total: {lecturers.length} lecturer(s)
            </span>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-clock-history" style={{ marginRight: 4 }} />
              Last updated: {new Date().toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}