import { useEffect, useState } from "react";
import { codApi } from "../../services/api";

export default function CodReports() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await codApi.reports();
        setData(res.data);
      } catch (err) {
        console.error("Error fetching department reports:", err);
        setError(err.response?.data?.detail || "Failed to load reports.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <p>Loading reports...</p>;
  if (error) return <p>{error}</p>;
  if (!data) return null;

  return (
    <div>
      <h1>Academic Reports</h1>
      <p>
        {data.department.name} ({data.department.code})
      </p>

      <h2>Summary</h2>
      <table>
        <tbody>
          <tr>
            <td>Total Students</td>
            <td>{data.stats.total_students}</td>
          </tr>
          <tr>
            <td>Active Students</td>
            <td>{data.stats.active_students}</td>
          </tr>
          <tr>
            <td>Total Lecturers</td>
            <td>{data.stats.total_lecturers}</td>
          </tr>
          <tr>
            <td>Total Courses</td>
            <td>{data.stats.total_courses}</td>
          </tr>
          <tr>
            <td>Graded Units (Published)</td>
            <td>{data.stats.graded_units}</td>
          </tr>
          <tr>
            <td>Pass Rate</td>
            <td>{data.stats.pass_rate !== null ? `${data.stats.pass_rate}%` : "N/A"}</td>
          </tr>
          <tr>
            <td>Pending Grade Verification</td>
            <td>{data.stats.pending_verification}</td>
          </tr>
        </tbody>
      </table>

      <h2>Grade Distribution</h2>
      {data.grade_distribution.length === 0 ? (
        <p>No published grades yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Letter Grade</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {data.grade_distribution.map((row, i) => (
              <tr key={i}>
                <td>{row.letter_grade || "N/A"}</td>
                <td>{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Students by Programme</h2>
      {data.students_by_programme.length === 0 ? (
        <p>No students in this department yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Programme</th>
              <th>Code</th>
              <th>Students</th>
            </tr>
          </thead>
          <tbody>
            {data.students_by_programme.map((row, i) => (
              <tr key={i}>
                <td>{row.programme__name}</td>
                <td>{row.programme__code}</td>
                <td>{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}