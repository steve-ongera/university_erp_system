import { useEffect, useState } from "react";
import { codApi } from "../../services/api";

export default function CodStudents() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    loadStudents();
  };

  const clearFilters = () => {
    setSearch("");
    setYearFilter("");
    setStatusFilter("");
    // reload with no params
    setTimeout(loadStudents, 0);
  };

  return (
    <div>
      <h1>Department Students</h1>

      {error && <p>{error}</p>}

      <form onSubmit={handleFilterSubmit}>
        <input
          type="text"
          placeholder="Search by name or registration number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
          <option value="">All Years</option>
          <option value="1">Year 1</option>
          <option value="2">Year 2</option>
          <option value="3">Year 3</option>
          <option value="4">Year 4</option>
          <option value="5">Year 5</option>
          <option value="6">Year 6</option>
        </select>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="deferred">Deferred</option>
          <option value="graduated">Graduated</option>
          <option value="suspended">Suspended</option>
          <option value="discontinued">Discontinued</option>
          <option value="expelled">Expelled</option>
        </select>

        <button type="submit">Search</button>
        <button type="button" onClick={clearFilters}>Clear</button>
      </form>

      <p>{students.length} student(s) found</p>

      {loading ? (
        <p>Loading students...</p>
      ) : students.length === 0 ? (
        <p>No students found for this department.</p>
      ) : (
        <table>
          <thead>
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
            {students.map((student) => (
              <tr key={student.id}>
                <td>{student.registration_number}</td>
                <td>
                  {student.user_detail?.first_name} {student.user_detail?.last_name}
                </td>
                <td>{student.programme_detail?.code || "N/A"}</td>
                <td>{student.current_year}</td>
                <td>{student.current_semester}</td>
                <td>{student.status}</td>
                <td>{student.sponsor_type}</td>
                <td>{student.cumulative_gpa ?? "N/A"}</td>
                <td>{student.admission_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}