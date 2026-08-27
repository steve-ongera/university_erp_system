import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { gradesApi, studentsApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

const groupGradesByYearSemester = (gradesList) => {
  const groups = {};
  gradesList.forEach((grade) => {
    const py = grade.enrollment?.programme_year;
    const ps = grade.enrollment?.programme_semester;
    const key = py && ps ? `Y${py}S${ps}` : "unassigned";
    if (!groups[key]) {
      groups[key] = {
        key,
        year: py || 999,
        semester: ps || 999,
        label: py && ps ? `Year ${py} · Sem ${ps}` : "Unassigned",
        grades: [],
      };
    }
    groups[key].grades.push(grade);
  });
  return Object.values(groups).sort((a, b) => a.year - b.year || a.semester - b.semester);
};

export default function MyGrades() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState([]);
  const [transcript, setTranscript] = useState([]);
  const [studentProfile, setStudentProfile] = useState(null);
  const [error, setError] = useState("");
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTabKey, setActiveTabKey] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    passed: 0,
    failed: 0,
    supplementary: 0,
    gpa: null,
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        // Fetch student profile
        const profileRes = await studentsApi.myProfile();
        setStudentProfile(profileRes.data);

        // Fetch grades - handle empty response
        let gradesData = [];
        try {
          const gradesRes = await gradesApi.myGrades();
          gradesData = gradesRes.data || [];
          if (!Array.isArray(gradesData)) {
            gradesData = [];
          }
        } catch (err) {
          console.error("Error fetching grades:", err);
          gradesData = [];
        }
        setGrades(gradesData);

        // Fetch transcript - handle empty response
        let transcriptData = [];
        try {
          const transcriptRes = await studentsApi.myTranscript();
          transcriptData = transcriptRes.data || [];
          if (!Array.isArray(transcriptData)) {
            transcriptData = [];
          }
        } catch (err) {
          console.error("Error fetching transcript:", err);
          transcriptData = [];
        }
        setTranscript(transcriptData);

        // Calculate stats safely
        const passed = gradesData.filter(g => g.is_pass === true).length;
        const failed = gradesData.filter(g => g.is_pass === false && g.requires_supplementary === false).length;
        const supplementary = gradesData.filter(g => g.requires_supplementary === true).length;

        setStats({
          total: gradesData.length || 0,
          passed: passed || 0,
          failed: failed || 0,
          supplementary: supplementary || 0,
          gpa: profileRes.data?.cumulative_gpa ? parseFloat(profileRes.data.cumulative_gpa) : null,
        });

      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load your grades. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Group grades into horizontal Year/Sem tabs
  const gradeGroups = useMemo(() => groupGradesByYearSemester(grades), [grades]);

  useEffect(() => {
    if (gradeGroups.length > 0) {
      const stillExists = gradeGroups.some(g => g.key === activeTabKey);
      if (!stillExists) {
        setActiveTabKey(gradeGroups[gradeGroups.length - 1].key); // default: most recent
      }
    } else {
      setActiveTabKey(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeGroups]);

  const activeGroup = gradeGroups.find(g => g.key === activeTabKey) || gradeGroups[0];

  const handleViewGrade = (grade) => {
    setSelectedGrade(grade);
    setModalOpen(true);
  };

  // Get semester display name for a transcript entry.
  // NOTE: entry.academic_year / entry.course are raw FK ids from the serializer's
  // "__all__" fields — the actual objects live in academic_year_detail / course_detail.
  const getSemesterDisplay = (entry) => {
    if (entry.academic_year_detail?.year) {
      return `${entry.academic_year_detail.year} S${entry.semester_number}`;
    }
    return `Y${entry.programme_year} S${entry.semester_number}`;
  };

  // Group transcript by semester
  const groupTranscriptBySemester = () => {
    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
      return {};
    }
    const groups = {};
    transcript.forEach(entry => {
      const key = getSemesterDisplay(entry);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(entry);
    });
    return groups;
  };

  // Calculate semester GPA
  const calculateSemesterGPA = (entries) => {
    if (!entries || entries.length === 0) return null;
    let totalPoints = 0;
    let totalCredits = 0;
    entries.forEach(entry => {
      const points = parseFloat(entry.quality_points) || 0;
      const credits = parseFloat(entry.credit_hours) || 0;
      totalPoints += points;
      totalCredits += credits;
    });
    return totalCredits > 0 ? (totalPoints / totalCredits) : null;
  };

  // Safe number formatter
  const safeToFixed = (value, decimals = 2) => {
    if (value === null || value === undefined || value === "N/A") return "N/A";
    const num = parseFloat(value);
    return isNaN(num) ? "N/A" : num.toFixed(decimals);
  };

  if (loading) {
    return <LoadingSpinner text="Loading your grades..." />;
  }

  const transcriptGroups = groupTranscriptBySemester();

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-award" />
            Results & Transcript
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Academics <span className="separator">/</span> Results
          </div>
        </div>
        <div className="mu-page-header-actions">
          <button className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-download" />
            Download Transcript
          </button>
        </div>
      </div>

      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}

      {/* Stats Summary */}
      <div className="mu-dashboard-grid">
        <div className="mu-stat-card">
          <div className="mu-stat-icon blue">
            <i className="bi bi-journal-bookmark" />
          </div>
          <div className="mu-stat-label">Total Units</div>
          <div className="mu-stat-value">{stats.total}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon green">
            <i className="bi bi-check-circle" />
          </div>
          <div className="mu-stat-label">Passed</div>
          <div className="mu-stat-value">{stats.passed}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon gold">
            <i className="bi bi-arrow-repeat" />
          </div>
          <div className="mu-stat-label">Supplementary</div>
          <div className="mu-stat-value">{stats.supplementary}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon red">
            <i className="bi bi-star" />
          </div>
          <div className="mu-stat-label">CGPA</div>
          <div className="mu-stat-value">{stats.gpa !== null ? stats.gpa.toFixed(2) : "N/A"}</div>
        </div>
      </div>

      {/* GPA Progress */}
      {stats.gpa !== null && (
        <div className="mu-card" style={{ marginBottom: 24 }}>
          <div className="mu-card-body">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>Cumulative GPA</span>
              <span style={{ fontSize: "var(--mu-font-size-lg)", fontWeight: "var(--mu-font-weight-bold)", color: "var(--mu-primary-600)" }}>
                {stats.gpa.toFixed(2)}
              </span>
            </div>
            <div style={{ height: 8, background: "var(--mu-gray-200)", borderRadius: 4, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min((stats.gpa / 4.0) * 100, 100)}%`,
                  background: stats.gpa >= 3.0 ? "var(--mu-success)" : stats.gpa >= 2.0 ? "var(--mu-warning)" : "var(--mu-danger)",
                  borderRadius: 4,
                  transition: "width 1s ease"
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-400)" }}>0.00</span>
              <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-400)" }}>4.00</span>
            </div>
          </div>
        </div>
      )}

      {/* Grades — horizontal Year/Sem tabs */}
      <div className="mu-card" style={{ marginBottom: 24 }}>
        <div className="mu-card-header">
          <h4>Semester Results</h4>
          <span className="mu-badge mu-badge-primary">
            {grades.length} Results
          </span>
        </div>

        {gradeGroups.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 8,
              overflowX: "auto",
              padding: "12px 16px",
              borderBottom: "1px solid var(--mu-gray-200)",
            }}
          >
            {gradeGroups.map((group) => (
              <button
                key={group.key}
                onClick={() => setActiveTabKey(group.key)}
                className={`mu-btn mu-btn-sm ${activeTabKey === group.key ? "mu-btn-primary" : "mu-btn-outline-primary"}`}
                style={{ whiteSpace: "nowrap", flexShrink: 0 }}
              >
                {group.label}
                <span style={{ marginLeft: 6, fontSize: "var(--mu-font-size-xs)", opacity: 0.8 }}>
                  ({group.grades.length})
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="mu-card-body" style={{ padding: 0 }}>
          {activeGroup && activeGroup.grades.length > 0 ? (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Course Code</th>
                    <th>Course Name</th>
                    <th>Semester</th>
                    <th>Grade</th>
                    <th>Points</th>
                    <th>Status</th>
                    <th>Publication</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeGroup.grades.map((grade) => (
                    <tr key={grade.id || Math.random()}>
                      <td>
                        <strong>{grade.enrollment?.course?.code || "N/A"}</strong>
                      </td>
                      <td>{grade.enrollment?.course?.name || "Unknown"}</td>
                      <td>
                        {grade.enrollment?.semester?.academic_year?.year || "N/A"} S{grade.enrollment?.semester?.semester_number || ""}
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-primary" style={{ fontSize: "1rem", padding: "4px 12px" }}>
                          {grade.letter_grade || "N/A"}
                        </span>
                      </td>
                      <td>{safeToFixed(grade.grade_points)}</td>
                      <td>
                        {grade.is_pass ? (
                          <span className="mu-badge mu-badge-success">
                            <i className="bi bi-check-circle" />
                            Pass
                          </span>
                        ) : grade.requires_supplementary ? (
                          <span className="mu-badge mu-badge-warning">
                            <i className="bi bi-arrow-repeat" />
                            Supplementary
                          </span>
                        ) : (
                          <span className="mu-badge mu-badge-danger">
                            <i className="bi bi-x-circle" />
                            Fail
                          </span>
                        )}
                      </td>
                      <td>
                        {grade.published_at ? (
                          <span className="mu-badge mu-badge-success">Published</span>
                        ) : (
                          <span className="mu-badge mu-badge-warning">Pending</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="mu-btn mu-btn-sm mu-btn-outline-primary"
                          onClick={() => handleViewGrade(grade)}
                        >
                          <i className="bi bi-eye" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-inbox" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Results Yet</h3>
              <p style={{ margin: "8px 0 0" }}>Your grades will appear here once they are entered.</p>
            </div>
          )}
        </div>
      </div>

      {/* Full Academic Transcript — shown inline on the page, not a modal */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>Full Academic Transcript</h4>
          {transcript && transcript.length > 0 && (
            <span className="mu-badge mu-badge-primary">
              {transcript.length} Entries
            </span>
          )}
        </div>
        <div className="mu-card-body">
          {transcript && transcript.length > 0 ? (
            <div>
              {Object.keys(transcriptGroups).map((semesterKey) => {
                const entries = transcriptGroups[semesterKey];
                const semesterGPA = calculateSemesterGPA(entries);
                return (
                  <div key={semesterKey} style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <h4 style={{ margin: 0, color: "var(--mu-primary-700)" }}>{semesterKey}</h4>
                      {semesterGPA !== null && (
                        <span className="mu-badge mu-badge-primary">
                          GPA: {semesterGPA.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className="mu-table-wrapper">
                      <table className="mu-table">
                        <thead>
                          <tr>
                            <th>Course Code</th>
                            <th>Course Name</th>
                            <th>Grade</th>
                            <th>Points</th>
                            <th>Credit Hrs</th>
                            <th>Quality Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entries.map((entry, index) => (
                            <tr key={index}>
                              <td>{entry.course_detail?.code || "N/A"}</td>
                              <td>{entry.course_detail?.name || "Unknown"}</td>
                              <td>
                                <span className="mu-badge mu-badge-primary">
                                  {entry.letter_grade || "N/A"}
                                </span>
                              </td>
                              <td>{safeToFixed(entry.grade_points)}</td>
                              <td>{entry.credit_hours || "N/A"}</td>
                              <td>{safeToFixed(entry.quality_points)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: 16, padding: 16, background: "var(--mu-primary-50)", borderRadius: "var(--mu-radius-md)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: "var(--mu-font-weight-semibold)" }}>Overall CGPA</span>
                  <span style={{ fontSize: "var(--mu-font-size-xl)", fontWeight: "var(--mu-font-weight-bold)", color: "var(--mu-primary-600)" }}>
                    {stats.gpa !== null ? stats.gpa.toFixed(2) : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 24, color: "var(--mu-gray-400)" }}>
              <i className="bi bi-inbox" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <p>No transcript entries available.</p>
            </div>
          )}
        </div>
      </div>

      {/* Grade Detail Modal (kept as a modal — this one's fine as a popup) */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Grade Details"
        size="md"
        showFooter={false}
      >
        {selectedGrade && (
          <div className="mu-grade-detail">
            <div className="mu-grade-detail-header">
              <div className="mu-grade-detail-course">
                <h4>{selectedGrade.enrollment?.course?.code || "N/A"}</h4>
                <p>{selectedGrade.enrollment?.course?.name || "Unknown"}</p>
                <p style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-400)" }}>
                  {selectedGrade.enrollment?.semester?.academic_year?.year || "N/A"} S{selectedGrade.enrollment?.semester?.semester_number || ""}
                </p>
              </div>
              <div className="mu-grade-detail-letter">
                <span className="mu-badge mu-badge-primary" style={{ fontSize: "2rem", padding: "8px 24px" }}>
                  {selectedGrade.letter_grade || "N/A"}
                </span>
              </div>
            </div>
            <div className="mu-grade-detail-stats">
              <div className="mu-grade-detail-stat">
                <span className="label">CAT Marks</span>
                <span className="value">{safeToFixed(selectedGrade.cat_marks)}</span>
              </div>
              <div className="mu-grade-detail-stat">
                <span className="label">Exam Marks</span>
                <span className="value">{safeToFixed(selectedGrade.final_exam_marks)}</span>
              </div>
              <div className="mu-grade-detail-stat">
                <span className="label">Total Marks</span>
                <span className="value">{safeToFixed(selectedGrade.total_marks)}</span>
              </div>
              <div className="mu-grade-detail-stat">
                <span className="label">Grade Points</span>
                <span className="value">{safeToFixed(selectedGrade.grade_points)}</span>
              </div>
              <div className="mu-grade-detail-stat">
                <span className="label">Credit Hours</span>
                <span className="value">{selectedGrade.enrollment?.course?.credit_hours || "N/A"}</span>
              </div>
              <div className="mu-grade-detail-stat">
                <span className="label">Quality Points</span>
                <span className="value">{safeToFixed(selectedGrade.quality_points)}</span>
              </div>
            </div>
            <div className="mu-grade-detail-status">
              <div className="mu-grade-detail-status-item">
                <span className="label">Status</span>
                {selectedGrade.is_pass ? (
                  <span className="mu-badge mu-badge-success">Passed</span>
                ) : selectedGrade.requires_supplementary ? (
                  <span className="mu-badge mu-badge-warning">Supplementary Required</span>
                ) : (
                  <span className="mu-badge mu-badge-danger">Failed</span>
                )}
              </div>
              {selectedGrade.is_supplementary_result && (
                <div className="mu-grade-detail-status-item">
                  <span className="label">Supplementary Result</span>
                  <span className="mu-badge mu-badge-info">Yes</span>
                </div>
              )}
              <div className="mu-grade-detail-status-item">
                <span className="label">Publication</span>
                {selectedGrade.published_at ? (
                  <span className="value" style={{ fontSize: "var(--mu-font-size-sm)" }}>
                    {new Date(selectedGrade.published_at).toLocaleDateString()}
                  </span>
                ) : (
                  <span className="mu-badge mu-badge-warning">Pending Publication</span>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}