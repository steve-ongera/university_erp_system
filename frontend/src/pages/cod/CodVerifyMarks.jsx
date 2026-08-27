import { useEffect, useState } from "react";
import { codApi } from "../../services/api";

export default function CodVerifyMarks() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [grades, setGrades] = useState([]);
  const [verifyingId, setVerifyingId] = useState(null);

  const loadPending = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await codApi.gradesPendingVerification();
      setGrades(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching pending grades:", err);
      setError(err.response?.data?.detail || "Failed to load pending marks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const handleVerify = async (gradeId) => {
    setVerifyingId(gradeId);
    setError("");
    setSuccess("");
    try {
      await codApi.verifyGrade(gradeId);
      setSuccess("Grade verified.");
      setGrades((prev) => prev.filter((g) => g.id !== gradeId));
    } catch (err) {
      console.error("Error verifying grade:", err);
      setError(err.response?.data?.detail || "Failed to verify this grade.");
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <div>
      <h1>Verify Entered Marks</h1>

      {error && <p>{error}</p>}
      {success && <p>{success}</p>}

      <p>{grades.length} grade(s) awaiting verification</p>

      {loading ? (
        <p>Loading pending marks...</p>
      ) : grades.length === 0 ? (
        <p>Nothing to verify right now — you're all caught up.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Reg. Number</th>
              <th>Course</th>
              <th>Semester</th>
              <th>CAT Marks</th>
              <th>Exam Marks</th>
              <th>Total</th>
              <th>Letter Grade</th>
              <th>Points</th>
              <th>Pass?</th>
              <th>Supplementary?</th>
              <th>Entered By</th>
              <th>Published At</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {grades.map((grade) => (
              <tr key={grade.id}>
                <td>{grade.enrollment_detail?.student_detail?.registration_number || "N/A"}</td>
                <td>
                  {grade.enrollment_detail?.course_detail?.code} - {grade.enrollment_detail?.course_detail?.name}
                </td>
                <td>
                  {grade.enrollment_detail?.semester_detail?.academic_year_detail?.year} S
                  {grade.enrollment_detail?.semester_detail?.semester_number}
                </td>
                <td>{grade.cat_marks}</td>
                <td>{grade.final_exam_marks}</td>
                <td>{grade.total_marks}</td>
                <td>{grade.letter_grade}</td>
                <td>{grade.grade_points}</td>
                <td>{grade.is_pass ? "Yes" : "No"}</td>
                <td>{grade.requires_supplementary ? "Yes" : "No"}</td>
                <td>{grade.entered_by || "N/A"}</td>
                <td>{grade.published_at ? new Date(grade.published_at).toLocaleString() : "N/A"}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => handleVerify(grade.id)}
                    disabled={verifyingId === grade.id}
                  >
                    {verifyingId === grade.id ? "Verifying..." : "Verify"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}