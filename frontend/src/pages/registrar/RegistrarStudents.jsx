import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { registrarApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function RegistrarStudents() {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    registrarApi
      .students({ search: search || undefined, status: statusFilter || undefined })
      .then((res) => setStudents(res.data.results || res.data))
      .catch(() => setError("Could not load students."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [search, statusFilter]);

  if (loading) {
    return <LoadingSpinner text="Loading students..." />;
  }

  const STATUS_BADGE = {
    active: "success",
    deferred: "warning",
    graduated: "info",
    suspended: "danger",
    discontinued: "danger",
    expelled: "danger",
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-people" />
            Students
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Registrar <span className="separator">/</span> Students
          </div>
        </div>
        
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}

      {/* Students Table */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-people" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
            All Students
          </h4>
          <span className="mu-badge mu-badge-primary">
            {students.length} Student(s)
          </span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {/* Filters inside table */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--mu-border)", background: "var(--mu-gray-50)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <div style={{ position: "relative", flex: "1 1 220px" }}>
                <i className="bi bi-search" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--mu-gray-400)" }} />
                <input
                  className="mu-input"
                  style={{ paddingLeft: 32 }}
                  placeholder="Search by name or reg no..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="mu-select"
                style={{ width: 160, padding: "3px 8px", fontSize: "var(--mu-font-size-xs)", minHeight: "auto", height: 32 }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="deferred">Deferred</option>
                <option value="graduated">Graduated</option>
                <option value="suspended">Suspended</option>
                <option value="discontinued">Discontinued</option>
                <option value="expelled">Expelled</option>
              </select>
              {(search || statusFilter) && (
                <button
                  className="mu-btn mu-btn-secondary"
                  style={{ padding: "2px 10px", fontSize: "var(--mu-font-size-xs)", height: 32, minHeight: "auto" }}
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("");
                  }}
                >
                  <i className="bi bi-arrow-counterclockwise" />
                  Reset
                </button>
              )}
              <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", marginLeft: "auto" }}>
                {students.length} student(s) found
              </span>
            </div>
          </div>

          {students.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-people" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Students Found</h3>
              <p style={{ margin: "8px 0 0" }}>No students match your search criteria.</p>
            </div>
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Reg. Number</th>
                    <th>Name</th>
                    <th>Programme</th>
                    <th>Year/Sem</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((st) => (
                    <tr key={st.id}>
                      <td>
                        <strong>{st.registration_number}</strong>
                      </td>
                      <td>
                        {st.user_detail?.first_name} {st.user_detail?.last_name}
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-primary">
                          {st.programme_detail?.code || "N/A"}
                        </span>
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-info">
                          Y{st.current_year} S{st.current_semester}
                        </span>
                      </td>
                      <td>
                        <span className={`mu-badge mu-badge-${STATUS_BADGE[st.status] || "gray"}`}>
                          {st.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {students.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Total: {students.length} student(s)
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