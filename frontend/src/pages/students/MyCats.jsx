import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { catsApi, studentsApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

export default function MyCats() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cats, setCats] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCat, setSelectedCat] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [answerText, setAnswerText] = useState("");
  const [answerFile, setAnswerFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("cats");

  const fetchCatsAndSubmissions = async () => {
    const catsRes = await catsApi.myCats();
    setCats(catsRes.data || []);
    const submissionsRes = await catsApi.mySubmissions();
    setSubmissions(submissionsRes.data || []);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        await fetchCatsAndSubmissions();
      } catch (err) {
        console.error("Error fetching CATs:", err);
        setError("Failed to load CATs. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };

    const fetchNotes = async () => {
      setNotesLoading(true);
      try {
        const notesRes = await studentsApi.myNotes();
        setNotes(notesRes.data || []);
      } catch (err) {
        console.error("Error fetching notes:", err);
      } finally {
        setNotesLoading(false);
      }
    };

    fetchData();
    fetchNotes();
  }, []);

  // Downloads file in its original format/extension
  const handleDownload = async (url, customPrefix = "") => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      
      // 1. Extract original filename and extension from URL
      const urlPath = new URL(url, window.location.href).pathname;
      let originalFilename = urlPath.split("/").pop() || "";

      // 2. If missing extension, map content-type header to proper file extension
      if (!originalFilename.includes(".")) {
        const contentType = response.headers.get("content-type") || blob.type;
        const mimeMap = {
          "application/pdf": ".pdf",
          "application/msword": ".doc",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
          "text/plain": ".txt",
          "image/jpeg": ".jpg",
          "image/png": ".png",
        };
        const ext = mimeMap[contentType] || "";
        originalFilename = (customPrefix || "file") + ext;
      } else if (customPrefix) {
        // Keep original extension but prepend title if needed
        const ext = originalFilename.substring(originalFilename.lastIndexOf("."));
        originalFilename = `${customPrefix}${ext}`;
      }

      // 3. Trigger direct browser download
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = originalFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Direct download failed, opening in new tab:", err);
      window.open(url, "_blank");
    }
  };

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

      await fetchCatsAndSubmissions();

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
            CATs & Course Notes
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
        <div className="mu-stat-card">
          <div className="mu-stat-icon blue">
            <i className="bi bi-file-earmark-text" />
          </div>
          <div className="mu-stat-label">Notes</div>
          <div className="mu-stat-value">{notes.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--mu-border)", marginBottom: 16, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setActiveTab("cats")}
          style={{
            border: "none",
            borderBottom: activeTab === "cats" ? "2px solid var(--mu-primary-500)" : "2px solid transparent",
            borderRadius: 0,
            background: "transparent",
            padding: "8px 16px",
            cursor: "pointer",
            color: activeTab === "cats" ? "var(--mu-primary-500)" : "var(--mu-gray-500)",
            fontWeight: activeTab === "cats" ? 600 : 400,
            fontSize: "var(--mu-font-size-sm)",
            transition: "all var(--mu-transition-fast)",
          }}
        >
          <i className="bi bi-clipboard-check" style={{ marginRight: 6 }} />
          CATs ({cats.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("notes")}
          style={{
            border: "none",
            borderBottom: activeTab === "notes" ? "2px solid var(--mu-primary-500)" : "2px solid transparent",
            borderRadius: 0,
            background: "transparent",
            padding: "8px 16px",
            cursor: "pointer",
            color: activeTab === "notes" ? "var(--mu-primary-500)" : "var(--mu-gray-500)",
            fontWeight: activeTab === "notes" ? 600 : 400,
            fontSize: "var(--mu-font-size-sm)",
            transition: "all var(--mu-transition-fast)",
          }}
        >
          <i className="bi bi-file-earmark-text" style={{ marginRight: 6 }} />
          Course Notes ({notes.length})
        </button>
      </div>

      {/* CATs Table */}
      {activeTab === "cats" && (
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
                            {submission?.marks_awarded !== null && submission?.marks_awarded !== undefined && (
                              <span className="mu-badge mu-badge-primary" style={{ marginLeft: 4 }}>
                                {submission.marks_awarded}/{cat.max_marks}
                              </span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              <button
                                className="mu-btn mu-btn-sm mu-btn-outline-primary"
                                onClick={() => handleViewCat(cat)}
                                title="View details"
                              >
                                <i className="bi bi-eye" />
                              </button>

                              {cat.cat_file && (
                                <button
                                  type="button"
                                  onClick={() => handleDownload(cat.cat_file, `${cat.course_code}_CAT_${cat.cat_number}`)}
                                  className="mu-btn mu-btn-sm mu-btn-outline-primary"
                                  title="Download question paper"
                                >
                                  <i className="bi bi-file-earmark-arrow-down" />
                                </button>
                              )}

                              {submission?.answer_file && (
                                <button
                                  type="button"
                                  onClick={() => handleDownload(submission.answer_file, `${cat.course_code}_My_Submission`)}
                                  className="mu-btn mu-btn-sm mu-btn-outline-primary"
                                  title="Download my submitted answer"
                                >
                                  <i className="bi bi-download" />
                                </button>
                              )}

                              {cat.is_open && !submission && (
                                <button
                                  className="mu-btn mu-btn-sm mu-btn-primary"
                                  onClick={() => handleOpenSubmit(cat)}
                                  title="Submit your answer"
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
      )}

      {/* Notes Table */}
      {activeTab === "notes" && (
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>Course Notes</h4>
            <span className="mu-badge mu-badge-primary">
              {notes.length} files
            </span>
          </div>
          <div className="mu-card-body" style={{ padding: 0 }}>
            {notesLoading ? (
              <div style={{ padding: 24 }}>
                <LoadingSpinner text="Loading notes..." />
              </div>
            ) : notes.length > 0 ? (
              <div className="mu-table-wrapper">
                <table className="mu-table mu-table-hover">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Title</th>
                      <th>Description</th>
                      <th>Uploaded</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notes.map((note) => (
                      <tr key={note.id}>
                        <td>
                          <strong>{note.course_code}</strong>
                        </td>
                        <td>{note.title}</td>
                        <td style={{ color: "var(--mu-gray-500)" }}>
                          {note.description || "—"}
                        </td>
                        <td>{new Date(note.uploaded_at).toLocaleDateString()}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => handleDownload(note.file, note.title)}
                            className="mu-btn mu-btn-sm mu-btn-outline-primary"
                          >
                            <i className="bi bi-download" style={{ marginRight: 4 }} />
                            Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
                <i className="bi bi-file-earmark-text" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
                <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Notes Yet</h3>
                <p style={{ margin: "8px 0 0" }}>Your lecturers haven't uploaded any notes yet.</p>
              </div>
            )}
          </div>
        </div>
      )}

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
            {selectedCat.cat_file && (
              <div className="mu-form-group">
                <label>Question Paper</label>
                <button
                  type="button"
                  onClick={() => handleDownload(selectedCat.cat_file, `${selectedCat.course_code}_CAT_${selectedCat.cat_number}`)}
                  className="mu-btn mu-btn-outline-primary"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  <i className="bi bi-file-earmark-arrow-down" style={{ marginRight: 6 }} />
                  Download question paper
                </button>
              </div>
            )}
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
            {(() => {
              const submission = submissions.find(s => s.cat === selectedCat.id);
              if (!submission) return null;
              return (
                <div className="mu-form-group">
                  <label>My Submission</label>
                  <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                    Submitted {new Date(submission.submitted_at).toLocaleString()}
                    {submission.is_late && (
                      <span className="mu-badge mu-badge-warning" style={{ marginLeft: 8 }}>Late</span>
                    )}
                    {submission.marks_awarded !== null && submission.marks_awarded !== undefined && (
                      <span className="mu-badge mu-badge-primary" style={{ marginLeft: 8 }}>
                        {submission.marks_awarded}/{selectedCat.max_marks}
                      </span>
                    )}
                  </div>
                  {submission.answer_file && (
                    <button
                      type="button"
                      onClick={() => handleDownload(submission.answer_file, `${selectedCat.course_code}_My_Submission`)}
                      className="mu-btn mu-btn-outline-primary"
                      style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
                    >
                      <i className="bi bi-download" style={{ marginRight: 6 }} />
                      Download my submitted answer
                    </button>
                  )}
                </div>
              );
            })()}
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
            {selectedCat.cat_file && (
              <div className="mu-form-group">
                <button
                  type="button"
                  onClick={() => handleDownload(selectedCat.cat_file, `${selectedCat.course_code}_CAT_${selectedCat.cat_number}`)}
                  className="mu-btn mu-btn-outline-primary"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  <i className="bi bi-file-earmark-arrow-down" style={{ marginRight: 6 }} />
                  Download question paper first
                </button>
              </div>
            )}
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

    </div>
  );
}