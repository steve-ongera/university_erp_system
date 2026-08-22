import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supplementaryApi, unitsApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function Supplementary() {
  const [loading, setLoading] = useState(true);
  const [outstandingCourses, setOutstandingCourses] = useState([]);
  const [currentSemester, setCurrentSemester] = useState(null);
  const [registering, setRegistering] = useState(null); // course id being registered
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  const handleRegister = async (course) => {
    if (!currentSemester) {
      setError("No active semester found.");
      return;
    }
    setRegistering(course.id);
    setError("");
    setSuccess("");
    try {
      await supplementaryApi.register(course.id, currentSemester.id);
      setSuccess(`Registered for supplementary: ${course.code}`);
      await loadData();
    } catch (err) {
      console.error("Error registering supplementary unit:", err);
      setError(err.response?.data?.detail || "Failed to register supplementary unit.");
    } finally {
      setRegistering(null);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading supplementary units..." />;
  }

  return (
    <div>
      <div>
        <h1>Supplementary Units</h1>
        <div>Home / Academics / Supplementary</div>
      </div>

      {error && <div>{error}</div>}
      {success && <div>{success}</div>}

      {currentSemester && (
        <div>
          Current Semester: {currentSemester.academic_year_detail?.year || "N/A"} - Semester{" "}
          {currentSemester.semester_number}
        </div>
      )}

      <div>
        <h4>Outstanding Units</h4>
        {outstandingCourses.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Course Code</th>
                <th>Course Name</th>
                <th>Credit Hours</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {outstandingCourses.map((course) => (
                <tr key={course.id}>
                  <td>{course.code}</td>
                  <td>{course.name}</td>
                  <td>{course.credit_hours}</td>
                  <td>
                    <button
                      onClick={() => handleRegister(course)}
                      disabled={registering === course.id}
                    >
                      {registering === course.id ? "Registering..." : "Register Supplementary"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>You have no outstanding supplementary units.</p>
        )}
      </div>

      <div>
        <Link to="/units">Back to My Units</Link>
        <Link to="/fees">View Fees</Link>
      </div>
    </div>
  );
}