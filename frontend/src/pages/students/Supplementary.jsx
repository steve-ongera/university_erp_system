import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supplementaryApi, unitsApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

export default function Supplementary() {
  const [loading, setLoading] = useState(true);
  const [outstandingCourses, setOutstandingCourses] = useState([]);
  const [currentSemester, setCurrentSemester] = useState(null);
  const [registering, setRegistering] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [outstandingRes, semRes] = await Promise.all([
        supplementaryApi.outstanding(),
        unitsApi.currentSemester(),
      ]);
      setOutstandingCourses(Array.isArray(outstandingRes.data) ? outstandingRes.data : []);
      setCurrentSemester(semRes.data);
    } catch (err) {
      console.error("Error fetching supplementary units:", err);
      setError("Failed to load outstanding supplementary units.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRegister = async () => {
    if (!selectedCourse) return;
    if (!currentSemester) {
      setError("No active semester found.");
      return;
    }
    setRegistering(selectedCourse.id);
    setError("");
    setSuccess("");
    try {
      await supplementaryApi.register(selectedCourse.id, currentSemester.id);
      setSuccess(`Registered for supplementary: ${selectedCourse.code}`);
      setConfirmModalOpen(false);
      await loadData();
      setSelectedCourse(null);
    } catch (err) {
      console.error("Error registering supplementary unit:", err);
      setError(err.response?.data?.detail || "Failed to register supplementary unit.");
    } finally {
      setRegistering(null);
    }
  };

  const openConfirmModal = (course) => {
    setSelectedCourse(course);
    setConfirmModalOpen(true);
  };

  if (loading) {
    return <LoadingSpinner text="Loading supplementary units..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-arrow-repeat" />
            Supplementary Units
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Academics <span className="separator">/</span> Supplementary
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/units" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" />
            Back to My Units
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}
      {success && (
        <div className="mu-alert mu-alert-success">
          <i className="bi bi-check-circle" />
          {success}
        </div>
      )}

      {/* Semester Info */}
      {currentSemester && (
        <div className="mu-alert mu-alert-info" style={{ marginBottom: 24 }}>
          <i className="bi bi-calendar3" />
          <div>
            <strong>Current Semester:</strong> {currentSemester.academic_year_detail?.year || "N/A"} - 
            Semester {currentSemester.semester_number}
            {currentSemester.is_current && (
              <span className="mu-badge mu-badge-success" style={{ marginLeft: 8 }}>
                <i className="bi bi-check-circle" style={{ marginRight: 4 }} />
                Active
              </span>
            )}
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="mu-card" style={{ marginBottom: 24 }}>
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-info-circle" style={{ marginRight: 8 }} />
            About Supplementary Units
          </h4>
        </div>
        <div className="mu-card-body">
          <p style={{ color: "var(--mu-gray-600)", margin: 0 }}>
            Supplementary units are courses that you need to retake or complete additional assessments for.
            Registering for a supplementary unit will generate an invoice for the supplementary fee.
            You must pay the fee before you can sit for the supplementary examination.
          </p>
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="mu-badge mu-badge-primary">
              <i className="bi bi-cash-coin" style={{ marginRight: 4 }} />
              Fee: KES 3,000 per unit
            </span>
            <span className="mu-badge mu-badge-info">
              <i className="bi bi-clock" style={{ marginRight: 4 }} />
              Register before semester deadline
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mu-dashboard-grid">
        <div className="mu-stat-card">
          <div className="mu-stat-icon gold">
            <i className="bi bi-arrow-repeat" />
          </div>
          <div className="mu-stat-label">Outstanding Units</div>
          <div className="mu-stat-value">{outstandingCourses.length}</div>
          {outstandingCourses.length > 0 && (
            <div className="mu-stat-change up" style={{ color: "var(--mu-warning)" }}>
              <i className="bi bi-exclamation-triangle" />
              Needs attention
            </div>
          )}
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon blue">
            <i className="bi bi-cash-coin" />
          </div>
          <div className="mu-stat-label">Total Fee</div>
          <div className="mu-stat-value">
            KES {(outstandingCourses.length * 3000).toLocaleString()}
          </div>
          {outstandingCourses.length > 0 && (
            <div className="mu-stat-change up" style={{ color: "var(--mu-danger)" }}>
              <i className="bi bi-credit-card" />
              Pay to register
            </div>
          )}
        </div>
      </div>

      {/* Outstanding Units Table */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-list-check" style={{ marginRight: 8 }} />
            Outstanding Supplementary Units
          </h4>
          <span className="mu-badge mu-badge-primary">
            {outstandingCourses.length} Units
          </span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {outstandingCourses.length > 0 ? (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Course Code</th>
                    <th>Course Name</th>
                    <th style={{ textAlign: "center" }}>Credit Hours</th>
                    <th style={{ textAlign: "center" }}>Fee</th>
                    <th style={{ textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {outstandingCourses.map((course) => (
                    <tr key={course.id}>
                      <td>
                        <strong>{course.code}</strong>
                      </td>
                      <td>{course.name}</td>
                      <td style={{ textAlign: "center" }}>
                        <span className="mu-badge mu-badge-primary">
                          {course.credit_hours}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="mu-badge mu-badge-info">
                          KES 3,000
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          className="mu-btn mu-btn-sm mu-btn-primary"
                          onClick={() => openConfirmModal(course)}
                          disabled={registering === course.id}
                        >
                          {registering === course.id ? (
                            <>
                              <i className="bi bi-arrow-repeat mu-animate-spin" />
                              Registering...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-plus-circle" />
                              Register
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-check-circle" style={{ fontSize: 48, display: "block", marginBottom: 16, color: "var(--mu-success)" }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Outstanding Units</h3>
              <p style={{ margin: "8px 0 0" }}>You have no outstanding supplementary units.</p>
            </div>
          )}
        </div>
        {outstandingCourses.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Total fee: KES {(outstandingCourses.length * 3000).toLocaleString()}
            </span>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-clock-history" style={{ marginRight: 4 }} />
              Register before semester deadline
            </span>
          </div>
        )}
      </div>

    
      {/* Confirm Modal */}
      <Modal
        isOpen={confirmModalOpen}
        onClose={() => {
          setConfirmModalOpen(false);
          setSelectedCourse(null);
        }}
        title="Confirm Supplementary Registration"
        size="md"
        confirmText="Register & Pay"
        onConfirm={handleRegister}
        isLoading={registering !== null}
      >
        <div style={{ textAlign: "center" }}>
          <i className="bi bi-arrow-repeat" style={{ fontSize: 48, color: "var(--mu-warning)", display: "block", marginBottom: 16 }} />
          <h4 style={{ margin: "0 0 8px" }}>Register for Supplementary Unit</h4>
          <p style={{ color: "var(--mu-gray-500)", margin: 0 }}>
            You are about to register for a supplementary unit.
            <br />
            <strong>Please confirm the details below:</strong>
          </p>
          <div style={{ marginTop: 12, padding: 12, background: "var(--mu-gray-50)", borderRadius: "var(--mu-radius-sm)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--mu-font-size-sm)" }}>
              <span style={{ color: "var(--mu-gray-500)" }}>Course:</span>
              <span><strong>{selectedCourse?.code}</strong></span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--mu-font-size-sm)", marginTop: 4 }}>
              <span style={{ color: "var(--mu-gray-500)" }}>Name:</span>
              <span>{selectedCourse?.name}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--mu-font-size-sm)", marginTop: 4 }}>
              <span style={{ color: "var(--mu-gray-500)" }}>Fee:</span>
              <span><span className="mu-badge mu-badge-info">KES 3,000</span></span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--mu-font-size-sm)", marginTop: 4 }}>
              <span style={{ color: "var(--mu-gray-500)" }}>Semester:</span>
              <span>{currentSemester?.academic_year_detail?.year || "N/A"} S{currentSemester?.semester_number}</span>
            </div>
          </div>
          <div className="mu-alert mu-alert-warning" style={{ marginTop: 12, textAlign: "left" }}>
            <i className="bi bi-exclamation-triangle" />
            <div>
              <strong>Note:</strong> An invoice for KES 3,000 will be generated upon registration.
              You must pay the fee before you can sit for the supplementary examination.
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}