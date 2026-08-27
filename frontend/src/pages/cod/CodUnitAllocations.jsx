import { useEffect, useState } from "react";
import { codApi } from "../../services/api";

const emptyForm = {
  lecturer: "",
  course: "",
  semester: "",
  programme: "",
  year: "",
  programme_semester: "",
  is_supplementary_offering: false,
};

export default function CodUnitAllocations() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [allocations, setAllocations] = useState([]);

  const [lecturers, setLecturers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [programmes, setProgrammes] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const loadAllocations = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await codApi.unitAllocations();
      const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setAllocations(data);
    } catch (err) {
      console.error("Error fetching unit allocations:", err);
      setError(err.response?.data?.detail || "Failed to load unit allocations.");
    } finally {
      setLoading(false);
    }
  };

  const loadFormOptions = async () => {
    try {
      const [lecRes, courseRes, semRes, progRes] = await Promise.all([
        codApi.lecturers(),
        codApi.courses(),
        codApi.semesters(),
        codApi.programmes(),
      ]);
      setLecturers(lecRes.data?.results || lecRes.data || []);
      setCourses(courseRes.data?.results || courseRes.data || []);
      setSemesters(semRes.data?.results || semRes.data || []);
      setProgrammes(progRes.data?.results || progRes.data || []);
    } catch (err) {
      console.error("Error loading form options:", err);
    }
  };

  useEffect(() => {
    loadAllocations();
    loadFormOptions();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEdit = (allocation) => {
    setForm({
      lecturer: allocation.lecturer,
      course: allocation.course,
      semester: allocation.semester,
      programme: allocation.programme,
      year: allocation.year,
      programme_semester: allocation.programme_semester,
      is_supplementary_offering: allocation.is_supplementary_offering,
    });
    setEditingId(allocation.id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      lecturer: form.lecturer,
      course: form.course,
      semester: form.semester,
      programme: form.programme,
      year: Number(form.year),
      programme_semester: Number(form.programme_semester),
      is_supplementary_offering: form.is_supplementary_offering,
    };

    try {
      if (editingId) {
        await codApi.updateUnitAllocation(editingId, payload);
        setSuccess("Allocation updated.");
      } else {
        await codApi.createUnitAllocation(payload);
        setSuccess("Lecturer assigned to unit.");
      }
      resetForm();
      await loadAllocations();
    } catch (err) {
      console.error("Error saving allocation:", err);
      setError(
        err.response?.data?.detail ||
        JSON.stringify(err.response?.data) ||
        "Failed to save allocation."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this unit allocation?")) return;
    setError("");
    try {
      await codApi.deleteUnitAllocation(id);
      await loadAllocations();
    } catch (err) {
      console.error("Error deleting allocation:", err);
      setError(err.response?.data?.detail || "Failed to delete allocation.");
    }
  };

  const handleToggleActive = async (allocation) => {
    setError("");
    try {
      await codApi.updateUnitAllocation(allocation.id, { is_active: !allocation.is_active });
      await loadAllocations();
    } catch (err) {
      console.error("Error toggling allocation:", err);
      setError(err.response?.data?.detail || "Failed to update allocation.");
    }
  };

  return (
    <div>
      <h1>Unit Allocations</h1>

      {error && <p>{error}</p>}
      {success && <p>{success}</p>}

      <button
        type="button"
        onClick={() => {
          if (showForm) {
            resetForm();
          } else {
            setShowForm(true);
          }
        }}
      >
        {showForm ? "Cancel" : "Assign Lecturer to Unit"}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit}>
          <div>
            <label>Lecturer</label>
            <select
              value={form.lecturer}
              onChange={(e) => handleChange("lecturer", e.target.value)}
              required
            >
              <option value="">Select lecturer</option>
              {lecturers.map((lec) => (
                <option key={lec.id} value={lec.id}>
                  {lec.user_detail?.first_name} {lec.user_detail?.last_name} ({lec.employee_number})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Course</label>
            <select
              value={form.course}
              onChange={(e) => handleChange("course", e.target.value)}
              required
            >
              <option value="">Select course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} - {course.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Semester</label>
            <select
              value={form.semester}
              onChange={(e) => handleChange("semester", e.target.value)}
              required
            >
              <option value="">Select semester</option>
              {semesters.map((sem) => (
                <option key={sem.id} value={sem.id}>
                  {sem.academic_year_detail?.year || sem.academic_year} S{sem.semester_number}
                  {sem.is_current ? " (Current)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Programme</label>
            <select
              value={form.programme}
              onChange={(e) => handleChange("programme", e.target.value)}
              required
            >
              <option value="">Select programme</option>
              {programmes.map((prog) => (
                <option key={prog.id} value={prog.id}>
                  {prog.code} - {prog.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Programme Year</label>
            <input
              type="number"
              min="1"
              max="8"
              value={form.year}
              onChange={(e) => handleChange("year", e.target.value)}
              required
            />
          </div>

          <div>
            <label>Programme Semester</label>
            <input
              type="number"
              min="1"
              max="3"
              value={form.programme_semester}
              onChange={(e) => handleChange("programme_semester", e.target.value)}
              required
            />
          </div>

          <div>
            <label>
              <input
                type="checkbox"
                checked={form.is_supplementary_offering}
                onChange={(e) => handleChange("is_supplementary_offering", e.target.checked)}
              />
              This offering is specifically for supplementary students
            </label>
          </div>

          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : editingId ? "Update Allocation" : "Create Allocation"}
          </button>
        </form>
      )}

      <h2>Existing Allocations</h2>

      {loading ? (
        <p>Loading allocations...</p>
      ) : allocations.length === 0 ? (
        <p>No unit allocations yet for this department.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Lecturer</th>
              <th>Course</th>
              <th>Semester</th>
              <th>Programme</th>
              <th>Year.Sem</th>
              <th>Supplementary Offering</th>
              <th>Students</th>
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {allocations.map((a) => (
              <tr key={a.id}>
                <td>
                  {a.lecturer_detail?.user_detail?.first_name} {a.lecturer_detail?.user_detail?.last_name}
                </td>
                <td>
                  {a.course_detail?.code} - {a.course_detail?.name}
                </td>
                <td>
                  {a.semester_detail?.academic_year_detail?.year} S{a.semester_detail?.semester_number}
                </td>
                <td>{a.programme_detail?.code}</td>
                <td>Y{a.year}S{a.programme_semester}</td>
                <td>{a.is_supplementary_offering ? "Yes" : "No"}</td>
                <td>{a.student_count}</td>
                <td>{a.is_active ? "Active" : "Inactive"}</td>
                <td>
                  <button type="button" onClick={() => handleEdit(a)}>Edit</button>
                  <button type="button" onClick={() => handleToggleActive(a)}>
                    {a.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button type="button" onClick={() => handleDelete(a.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}