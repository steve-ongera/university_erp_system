import { useEffect, useState } from "react";
import { codApi } from "../../services/api";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <div>
      <h1>Department Enrollments</h1>

      {error && <p>{error}</p>}

      <form onSubmit={handleFilterSubmit}>
        <select value={semesterFilter} onChange={(e) => setSemesterFilter(e.target.value)}>
          <option value="">All Semesters</option>
          {semesters.map((sem) => (
            <option key={sem.id} value={sem.id}>
              {sem.academic_year_detail?.year || sem.academic_year} S{sem.semester_number}
              {sem.is_current ? " (Current)" : ""}
            </option>
          ))}
        </select>

        <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
          <option value="">All Courses</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.code} - {course.name}
            </option>
          ))}
        </select>

        <button type="submit">Filter</button>
        <button type="button" onClick={clearFilters}>Clear</button>
      </form>

      <p>{enrollments.length} enrollment(s) found</p>

      {loading ? (
        <p>Loading enrollments...</p>
      ) : enrollments.length === 0 ? (
        <p>No enrollments found for this selection.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Reg. Number</th>
              <th>Student</th>
              <th>Course</th>
              <th>Semester</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {enrollments.map((en) => (
              <tr key={en.id}>
                <td>{en.student_detail?.registration_number || "N/A"}</td>
                <td>
                  {en.student_detail?.user_detail?.first_name} {en.student_detail?.user_detail?.last_name}
                </td>
                <td>
                  {en.course_detail?.code} - {en.course_detail?.name}
                </td>
                <td>
                  {en.semester_detail?.academic_year_detail?.year} S{en.semester_detail?.semester_number}
                </td>
                <td>{en.is_active ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}