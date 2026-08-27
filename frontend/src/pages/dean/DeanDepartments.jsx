import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deanApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function DeanDepartments() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    deanApi
      .departments()
      .then((res) => setDepartments(res.data.results || res.data))
      .catch(() => setError("Could not load departments."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <LoadingSpinner text="Loading departments..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-diagram-3" />
            Departments
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Dean <span className="separator">/</span> Departments
          </div>
        </div>
        
      </div>

      {/* Info Alert */}
      <div className="mu-alert mu-alert-info" style={{ marginBottom: 24 }}>
        <i className="bi bi-info-circle" />
        <div>
          Read-only — department records are managed by admin/registrar.
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}

      {/* Departments Table */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-diagram-3" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
            All Departments
          </h4>
          <span className="mu-badge mu-badge-primary">
            {departments.length} Department(s)
          </span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {departments.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-diagram-3" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Departments Found</h3>
              <p style={{ margin: "8px 0 0" }}>No departments found in this faculty.</p>
            </div>
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Code</th>
                    <th>Head of Department</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <strong>{d.name}</strong>
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-primary">{d.code}</span>
                      </td>
                      <td>
                        {d.head_of_department_detail ? (
                          <span style={{ fontWeight: 500 }}>{d.head_of_department_detail}</span>
                        ) : (
                          <span className="mu-badge mu-badge-gray">Not Assigned</span>
                        )}
                      </td>
                      <td>
                        <span className={`mu-badge ${d.is_active ? "mu-badge-success" : "mu-badge-gray"}`}>
                          {d.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {departments.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Total: {departments.length} department(s)
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