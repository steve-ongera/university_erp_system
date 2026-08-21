import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { catsApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

export default function MyCats() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cats, setCats] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [error, setError] = useState("");
  const [selectedCat, setSelectedCat] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [answerText, setAnswerText] = useState("");
  const [answerFile, setAnswerFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        // Fetch CATs
        const catsRes = await catsApi.myCats();
        setCats(catsRes.data || []);

        // Fetch submissions
        const submissionsRes = await catsApi.mySubmissions();
        setSubmissions(submissionsRes.data || []);
      } catch (err) {
        console.error("Error fetching CATs:", err);
        setError("Failed to load CATs. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleViewCat = (cat) => {
    setSelectedCat(cat);
    setModalOpen(true);
  };

  const handleOpenSubmit = (cat) => {
    setSelectedCat(cat);
    setAnswerText("");
    setAnswerFile(null);
    setSubmitModalOpen(true);
  };

  const handleSubmitCat = async () => {
    if (!answerText && !answerFile) {
      setError("Please provide an answer (text or file upload).");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await catsApi.submit({
        cat_id: selectedCat.id,
        answer_text: answerText,
        answer_file: answerFile,
      });

      // Refresh data
      const catsRes = await catsApi.myCats();
      setCats(catsRes.data || []);
      const submissionsRes = await catsApi.mySubmissions();
      setSubmissions(submissionsRes.data || []);

      setSubmitModalOpen(false);
      setAnswerText("");
      setAnswerFile(null);
    } catch (err) {
      console.error("Error submitting CAT:", err);
      setError(err.response?.data?.detail || "Failed to submit CAT. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (cat) => {
    const submission = submissions.find(s => s.cat === cat.id);
    if (submission) {
      return { class: "mu-badge-success", label: "Submitted" };
    }
    if (cat.is_open) {
      return { class: "mu-badge-primary", label: "Open" };
    }
    return { class: "mu-badge-gray", label: "Closed" };
  };

  if (loading) {
    return <LoadingSpinner text="Loading your CATs..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-pencil-square" />
            CATs & Assignments
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Academics <span className="separator">/</span> CATs
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/grades" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-award" />
            View Grades
          </Link>
        </div>
      </div>

      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}

      {/* Stats Summary */}
      <div className="mu-dashboard-grid" style={{ marginBottom: 24 }}>
        <div className="mu-stat-card">
          <div className="mu-stat-icon blue">
            <i className="bi bi-journal-bookmark" />
          </div>
          <div className="mu-stat-label">Total CATs</div>
          <div className="mu-stat-value">{cats.length}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon green">
            <i className="bi bi-check-circle" />
          </div>
          <div className="mu-stat-label">Submitted</div>
          <div className="mu-stat-value">{submissions.length}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon gold">
            <i className="bi bi-clock" />
          </div>
          <div className="mu-stat-label">Pending</div>
          <div className="mu-stat-value">
            {cats.filter(c => c.is_open && !submissions.find(s => s.cat === c.id)).length}
          </div>
        </div>
      </div>

      {/* CATs Table */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>My CATs</h4>
          <span className="mu-badge mu-badge-primary">
            {cats.length} CATs
          </span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {cats.length > 0 ? (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Title</th>
                    <th>CAT No.</th>
                    <th>Max Marks</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cats.map((cat) => {
                    const status = getStatusBadge(cat);
                    const submission = submissions.find(s => s.cat === cat.id);
                    
                    return (
                      <tr key={cat.id}>
                        <td>
                          <strong>{cat.course_code}</strong>
                        </td>
                        <td>{cat.title}</td>
                        <td>CAT {cat.cat_number}</td>
                        <td>{cat.max_marks}</td>
                        <td>
                          <span className={`mu-badge ${status.class}`}>
                            {submission && <i className="bi bi-check-circle" style={{ marginRight: 4 }} />}
                            {status.label}
                          </span>
                          {submission?.is_late && (
                            <span className="mu-badge mu-badge-warning" style={{ marginLeft: 4 }}>
                              Late
                            </span>
                          )}
                          {submission?.marks_awarded !== null && (
                            <span className="mu-badge mu-badge-primary" style={{ marginLeft: 4 }}>
                              {submission.marks_awarded}/{cat.max_marks}
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button 
                              className="mu-btn mu-btn-sm mu-btn-outline-primary"
                              onClick={() => handleViewCat(cat)}
                            >
                              <i className="bi bi-eye" />
                            </button>
                            {cat.is_open && !submission && (
                              <button 
                                className="mu-btn mu-btn-sm mu-btn-primary"
                                onClick={() => handleOpenSubmit(cat)}
                              >
                                <i className="bi bi-upload" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-inbox" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No CATs Available</h3>
              <p style={{ margin: "8px 0 0" }}>Your CATs will appear here once they are published.</p>
            </div>
          )}
        </div>
      </div>

      {/* View CAT Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`CAT ${selectedCat?.cat_number} - ${selectedCat?.course_code || ""}`}
        size="md"
        showFooter={false}
      >
        {selectedCat && (
          <div>
            <div className="mu-form-group">
              <label>Title</label>
              <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                {selectedCat.title}
              </div>
            </div>
            <div className="mu-form-group">
              <label>Instructions</label>
              <div className="mu-input" style={{ background: "var(--mu-gray-50)", minHeight: 60, whiteSpace: "pre-wrap" }}>
                {selectedCat.instructions || "No instructions provided."}
              </div>
            </div>
            <div className="mu-dashboard-grid-3" style={{ marginBottom: 0 }}>
              <div className="mu-form-group">
                <label>Max Marks</label>
                <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                  {selectedCat.max_marks}
                </div>
              </div>
              <div className="mu-form-group">
                <label>Opens At</label>
                <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                  {new Date(selectedCat.opens_at).toLocaleString()}
                </div>
              </div>
              <div className="mu-form-group">
                <label>Closes At</label>
                <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                  {new Date(selectedCat.closes_at).toLocaleString()}
                </div>
              </div>
            </div>
            <div className="mu-form-group">
              <label>Status</label>
              <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                {selectedCat.is_open ? (
                  <span className="mu-badge mu-badge-success">Open</span>
                ) : (
                  <span className="mu-badge mu-badge-gray">Closed</span>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Submit CAT Modal */}
      <Modal
        isOpen={submitModalOpen}
        onClose={() => setSubmitModalOpen(false)}
        title={`Submit CAT ${selectedCat?.cat_number} - ${selectedCat?.course_code || ""}`}
        size="md"
        confirmText="Submit"
        onConfirm={handleSubmitCat}
        isLoading={submitting}
      >
        {selectedCat && (
          <div>
            <div className="mu-form-group">
              <label>Title</label>
              <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                {selectedCat.title}
              </div>
            </div>
            <div className="mu-form-group">
              <label>Your Answer (Text)</label>
              <textarea
                className="mu-textarea"
                placeholder="Type your answer here..."
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                rows={4}
              />
            </div>
            <div className="mu-form-group">
              <label>Or Upload File</label>
              <input
                type="file"
                className="mu-input"
                onChange={(e) => setAnswerFile(e.target.files[0])}
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
              />
              <div className="mu-help-text">Accepted formats: PDF, DOC, DOCX, TXT, JPG, PNG</div>
            </div>
            {error && (
              <div className="mu-alert mu-alert-danger">
                <i className="bi bi-exclamation-triangle" />
                {error}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Quick Actions */}
      <div className="mu-dashboard-grid-3" style={{ marginTop: 24 }}>
        <div className="mu-card">
          <div className="mu-card-body" style={{ textAlign: "center" }}>
            <i className="bi bi-journal-bookmark" style={{ fontSize: 24, color: "var(--mu-primary-500)" }} />
            <h4 style={{ margin: "8px 0 4px" }}>My Units</h4>
            <p style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)", margin: 0 }}>
              View your registered units
            </p>
            <Link to="/units" className="mu-btn mu-btn-sm mu-btn-outline-primary" style={{ marginTop: 8 }}>
              View Units
            </Link>
          </div>
        </div>
        <div className="mu-card">
          <div className="mu-card-body" style={{ textAlign: "center" }}>
            <i className="bi bi-award" style={{ fontSize: 24, color: "var(--mu-primary-500)" }} />
            <h4 style={{ margin: "8px 0 4px" }}>Results</h4>
            <p style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)", margin: 0 }}>
              Check your grades
            </p>
            <Link to="/grades" className="mu-btn mu-btn-sm mu-btn-outline-primary" style={{ marginTop: 8 }}>
              View Results
            </Link>
          </div>
        </div>
        <div className="mu-card">
          <div className="mu-card-body" style={{ textAlign: "center" }}>
            <i className="bi bi-calendar3" style={{ fontSize: 24, color: "var(--mu-primary-500)" }} />
            <h4 style={{ margin: "8px 0 4px" }}>Timetable</h4>
            <p style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)", margin: 0 }}>
              View your schedule
            </p>
            <Link to="/timetable" className="mu-btn mu-btn-sm mu-btn-outline-primary" style={{ marginTop: 8 }}>
              View Timetable
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}