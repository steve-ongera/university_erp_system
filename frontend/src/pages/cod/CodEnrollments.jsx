import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { codApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function CodEnrollments() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [enrollments, setEnrollments] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [courses, setCourses] = useState([]);
  const [semesterFilter, setSemesterFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");

  const loadFilters = async () => {
    try {
      const [semRes, courseRes] = await Promise.all([
        codApi.semesters(),
        codApi.courses(),
      ]);
      setSemesters(semRes.data?.results || semRes.data || []);
      setCourses(courseRes.data?.results || courseRes.data || []);
    } catch (err) {
      console.error("Error loading filter options:", err);
    }
  };

  const loadEnrollments = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (semesterFilter) params.semester = semesterFilter;
      if (courseFilter) params.course = courseFilter;

      const res = await codApi.enrollments(params);
      const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setEnrollments(data);
    } catch (err) {
      console.error("Error fetching enrollments:", err);
      setError(err.response?.data?.detail || "Failed to load enrollments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFilters();
    loadEnrollments();
  }, []);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    loadEnrollments();
  };

  const clearFilters = () => {
    setSemesterFilter("");
    setCourseFilter("");
    setTimeout(loadEnrollments, 0);
  };

  if (loading) {
    return <LoadingSpinner text="Loading enrollments..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-journal-bookmark" />
            Department Enrollments
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> COD <span className="separator">/</span> Enrollments
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
                  <th colSpan={5} style={{ padding: "8px 12px" }}>
                    <form onSubmit={handleFilterSubmit} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", width: "100%", margin: 0 }}>
                      {/* Semester Filter */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", fontWeight: 500 }}>
                          <i className="bi bi-calendar3" style={{ marginRight: 4 }} />
                          Semester:
                        </span>
                        <select
                          className="mu-select"
                          style={{ width: 180, padding: "3px 8px", fontSize: "var(--mu-font-size-xs)", minHeight: "auto", height: 28 }}
                          value={semesterFilter}
                          onChange={(e) => setSemesterFilter(e.target.value)}
                        >
                          <option value="">All Semesters</option>
                          {semesters.map((sem) => (
                            <option key={sem.id} value={sem.id}>
                              {sem.academic_year_detail?.year || sem.academic_year} S{sem.semester_number}
                              {sem.is_current ? " (Current)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Course Filter */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", fontWeight: 500 }}>
                          <i className="bi bi-journal-bookmark" style={{ marginRight: 4 }} />
                          Course:
                        </span>
                        <select
                          className="mu-select"
                          style={{ width: 180, padding: "3px 8px", fontSize: "var(--mu-font-size-xs)", minHeight: "auto", height: 28 }}
                          value={courseFilter}
                          onChange={(e) => setCourseFilter(e.target.value)}
                        >
                          <option value="">All Courses</option>
                          {courses.map((course) => (
                            <option key={course.id} value={course.id}>
                              {course.code} - {course.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Filter Button */}
                      <button
                        type="submit"
                        className="mu-btn mu-btn-primary"
                        style={{ padding: "2px 12px", fontSize: "var(--mu-font-size-xs)", height: 28, minHeight: "auto" }}
                      >
                        <i className="bi bi-funnel" />
                        Filter
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
                        {enrollments.length} enrollment(s) found
                      </span>
                    </form>
                  </th>
                </tr>
                {/* Column Headers */}
                <tr>
                  <th>Reg. Number</th>
                  <th>Student</th>
                  <th>Course</th>
                  <th>Semester</th>
                  <th style={{ textAlign: "center" }}>Active</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
                      <i className="bi bi-inbox" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
                      <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Enrollments Found</h3>
                      <p style={{ margin: "8px 0 0" }}>No enrollments found for this selection.</p>
                    </td>
                  </tr>
                ) : (
                  enrollments.map((en) => (
                    <tr key={en.id}>
                      <td>
                        <strong>{en.student_detail?.registration_number || "N/A"}</strong>
                      </td>
                      <td>
                        {en.student_detail?.user_detail?.first_name} {en.student_detail?.user_detail?.last_name}
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>
                          {en.course_detail?.code}
                        </div>
                        <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
                          {en.course_detail?.name}
                        </div>
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-info">
                          {en.semester_detail?.academic_year_detail?.year} S{en.semester_detail?.semester_number}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {en.is_active ? (
                          <span className="mu-badge mu-badge-success">
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        {enrollments.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Total: {enrollments.length} enrollment(s)
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