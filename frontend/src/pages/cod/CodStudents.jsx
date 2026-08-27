import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { codApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function CodStudents() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const STATUS_OPTIONS = ["active", "deferred", "graduated", "suspended", "discontinued", "expelled"];
  const STATUS_BADGE = {
    active: "success",
    deferred: "warning",
    graduated: "info",
    suspended: "danger",
    discontinued: "danger",
    expelled: "danger",
  };

  const loadStudents = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (search) params.search = search;
      if (yearFilter) params.year = yearFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await codApi.students(params);
      const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setStudents(data);
    } catch (err) {
      console.error("Error fetching department students:", err);
      setError(err.response?.data?.detail || "Failed to load students.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    loadStudents();
  };

  const clearFilters = () => {
    setSearch("");
    setYearFilter("");
    setStatusFilter("");
    setTimeout(loadStudents, 0);
  };

  if (loading) {
    return <LoadingSpinner text="Loading department students..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-people" />
            Department Students
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> COD <span className="separator">/</span> Students
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/cod/dashboard" className="mu-btn mu-btn-outline-primary">
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

      {/* Table with Filters Above Header */}
      <div className="mu-card">
        <div className="mu-card-body" style={{ padding: 0 }}>
          <div className="mu-table-wrapper">
            <table className="mu-table">
              <thead>
                {/* Filter Row */}
                <tr style={{ background: "var(--mu-gray-50)" }}>
                  <th colSpan={9} style={{ padding: "8px 12px" }}>
                    <form onSubmit={handleFilterSubmit} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", width: "100%", margin: 0 }}>
                      {/* Search - First */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "1 1 220px" }}>
                        <div style={{ position: "relative", width: "100%" }}>
                          <i className="bi bi-search" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--mu-gray-400)" }} />
                          <input
                            type="text"
                            className="mu-input"
                            placeholder="Search by reg no. or name..."
                            style={{ 
                              width: "100%", 
                              padding: "3px 8px 3px 26px", 
                              fontSize: "var(--mu-font-size-xs)",
                              minHeight: "auto",
                              height: 28
                            }}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Year Filter */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", fontWeight: 500 }}>Year:</span>
                        <select
                          className="mu-select"
                          style={{ width: 90, padding: "3px 8px", fontSize: "var(--mu-font-size-xs)", minHeight: "auto", height: 28 }}
                          value={yearFilter}
                          onChange={(e) => setYearFilter(e.target.value)}
                        >
                          <option value="">All</option>
                          {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>Y{y}</option>)}
                        </select>
                      </div>

                      {/* Status Filter */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", fontWeight: 500 }}>Status:</span>
                        <select
                          className="mu-select"
                          style={{ width: 110, padding: "3px 8px", fontSize: "var(--mu-font-size-xs)", minHeight: "auto", height: 28 }}
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                        >
                          <option value="">All</option>
                          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                        </select>
                      </div>

                      {/* Search Button */}
                      <button
                        type="submit"
                        className="mu-btn mu-btn-primary"
                        style={{ padding: "2px 12px", fontSize: "var(--mu-font-size-xs)", height: 28, minHeight: "auto" }}
                      >
                        <i className="bi bi-search" />
                        Search
                      </button>

                      {/* Clear Button */}
                      <button
                        type="button"
                        className="mu-btn mu-btn-secondary"
                        style={{ padding: "2px 10px", fontSize: "var(--mu-font-size-xs)", height: 28, minHeight: "auto" }}
                        onClick={clearFilters}
                      >
                        <i className="bi bi-arrow-counterclockwise" />
                        Clear
                      </button>

                      {/* Results count */}
                      <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", marginLeft: "auto" }}>
                        {students.length} student(s) found
                      </span>
                    </form>
                  </th>
                </tr>
                {/* Column Headers */}
                <tr>
                  <th>Reg. Number</th>
                  <th>Name</th>
                  <th>Programme</th>
                  <th>Year</th>
                  <th>Semester</th>
                  <th>Status</th>
                  <th>Sponsor Type</th>
                  <th>CGPA</th>
                  <th>Admission Date</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
                      <i className="bi bi-inbox" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
                      <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Students Found</h3>
                      <p style={{ margin: "8px 0 0" }}>No students found for this department.</p>
                    </td>
                  </tr>
                ) : (
                  students.map((student) => (
                    <tr key={student.id}>
                      <td>
                        <strong>{student.registration_number}</strong>
                      </td>
                      <td>
                        {student.user_detail?.first_name} {student.user_detail?.last_name}
                      </td>
                      <td>{student.programme_detail?.code || "N/A"}</td>
                      <td>
                        <span className="mu-badge mu-badge-primary">Y{student.current_year}</span>
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-info">S{student.current_semester}</span>
                      </td>
                      <td>
                        <span className={`mu-badge mu-badge-${STATUS_BADGE[student.status] || "gray"}`}>
                          {student.status}
                        </span>
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-gray">
                          {student.sponsor_type?.replace("_", " ") || "N/A"}
                        </span>
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-primary">
                          {student.cumulative_gpa ?? "N/A"}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
                          {student.admission_date || "N/A"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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