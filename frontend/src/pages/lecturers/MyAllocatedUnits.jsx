import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { lecturerApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function MyAllocatedUnits() {
  const [loading, setLoading] = useState(true);
  const [allocations, setAllocations] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await lecturerApi.myAllocations();
        setAllocations(Array.isArray(res.data) ? res.data : res.data.results || []);
      } catch (err) {
        console.error("Error fetching allocations:", err);
        setError("Failed to load your allocated units.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <LoadingSpinner text="Loading your allocated units..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-journal-bookmark" />
            My Allocated Units
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Lecturer <span className="separator">/</span> My Units
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/lecturer/dashboard" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}

      {/* Allocations Table */}
      {allocations.length > 0 ? (
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>Allocated Units</h4>
            <span className="mu-badge mu-badge-primary">
              {allocations.length} Units
            </span>
          </div>
          <div className="mu-card-body" style={{ padding: 0 }}>
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Programme</th>
                    <th>Year/Sem</th>
                    <th>Semester</th>
                    <th style={{ textAlign: "center" }}>Students</th>
                    <th style={{ textAlign: "center" }}>Supplementary</th>
                    <th style={{ textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <strong>{a.course_detail?.code}</strong>
                        <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
                          {a.course_detail?.name}
                        </div>
                      </td>
                      <td>{a.programme}</td>
                      <td>
                        <span className="mu-badge mu-badge-primary" style={{ marginRight: 4 }}>
                          Y{a.year}
                        </span>
                        <span className="mu-badge mu-badge-info">
                          S{a.programme_semester}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: "var(--mu-font-size-sm)" }}>
                          <span style={{ color: "var(--mu-gray-500)" }}>
                            {a.semester_detail?.academic_year_detail?.year || "N/A"}
                          </span>
                          <br />
                          <span className="mu-badge mu-badge-gray">
                            S{a.semester_detail?.semester_number}
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="mu-badge mu-badge-success">
                          <i className="bi bi-people" style={{ marginRight: 4 }} />
                          {a.student_count || 0}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {a.is_supplementary_offering ? (
                          <span className="mu-badge mu-badge-warning">
                            <i className="bi bi-check-circle" style={{ marginRight: 4 }} />
                            Yes
                          </span>
                        ) : (
                          <span className="mu-badge mu-badge-gray">
                            <i className="bi bi-x-circle" style={{ marginRight: 4 }} />
                            No
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                          <Link
                            to={`/lecturer/enter-marks/${a.id}`}
                            className="mu-btn mu-btn-sm mu-btn-primary"
                          >
                            <i className="bi bi-pencil-square" />
                            Marks
                          </Link>
                          <Link
                            to={`/lecturer/roster/${a.id}`}
                            className="mu-btn mu-btn-sm mu-btn-outline-primary"
                          >
                            <i className="bi bi-people" />
                            Roster
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Total: {allocations.length} unit(s)
            </span>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-clock-history" style={{ marginRight: 4 }} />
              Last updated: {new Date().toLocaleDateString()}
            </span>
          </div>
        </div>
      ) : (
        <div className="mu-card">
          <div className="mu-card-body" style={{ padding: 48, textAlign: "center" }}>
            <i className="bi bi-inbox" style={{ fontSize: 48, display: "block", marginBottom: 16, color: "var(--mu-gray-400)" }} />
            <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Allocated Units</h3>
            <p style={{ margin: "8px 0 16px", color: "var(--mu-gray-400)" }}>
              You have no units allocated for this semester.
            </p>
            <Link to="/lecturer/dashboard" className="mu-btn mu-btn-primary">
              <i className="bi bi-arrow-left" style={{ marginRight: 8 }} />
              Back to Dashboard
            </Link>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Link to="/lecturer/dashboard" className="mu-btn mu-btn-secondary">
          <i className="bi bi-arrow-left" style={{ marginRight: 8 }} />
          Back to Dashboard
        </Link>
        <Link to="/lecturer/attendance" className="mu-btn mu-btn-outline-primary">
          <i className="bi bi-qr-code" style={{ marginRight: 8 }} />
          QR Attendance
        </Link>
      </div>
    </div>
  );
}