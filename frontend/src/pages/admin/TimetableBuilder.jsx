import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const PERIODS = [
  { label: "8:00 - 10:00", start: "08:00", end: "10:00" },
  { label: "10:00 - 12:00", start: "10:00", end: "12:00" },
  { label: "12:00 - 2:00", start: "12:00", end: "14:00" },
  { label: "2:00 - 4:00", start: "14:00", end: "16:00" },
  { label: "4:00 - 6:00", start: "16:00", end: "18:00" },
];

const emptyCourseForm = { name: "", code: "", course_type: "core", credit_hours: 3, department: "", description: "" };

export default function TimetableBuilder() {
  // reference data
  const [academicYears, setAcademicYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [lecturers, setLecturers] = useState([]);

  // selectors
  const [academicYearId, setAcademicYearId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [programmeId, setProgrammeId] = useState("");
  const [progYear, setProgYear] = useState("");

  // derived working set
  const [curriculumVersion, setCurriculumVersion] = useState(null);
  const [curriculumUnits, setCurriculumUnits] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [error, setError] = useState("");

  // schedule modal
  const [scheduleModal, setScheduleModal] = useState(null);
  const [savingSlot, setSavingSlot] = useState(false);
  const [slotError, setSlotError] = useState("");

  // unit creation modal
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [unitMode, setUnitMode] = useState("existing");
  const [existingCourseId, setExistingCourseId] = useState("");
  const [newCourseForm, setNewCourseForm] = useState({ ...emptyCourseForm });
  const [savingUnit, setSavingUnit] = useState(false);
  const [unitError, setUnitError] = useState("");
  const [allCourses, setAllCourses] = useState([]);

  // ---------------------------------------------------------------
  // Initial reference data
  // ---------------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const [ayRes, semRes, progRes, deptRes, lecRes, courseRes] = await Promise.all([
          adminApi.academicYears(),
          adminApi.semesters(),
          adminApi.programmes(),
          adminApi.departments(),
          adminApi.lecturers(),
          adminApi.courses(),
        ]);
        setAcademicYears(ayRes.data.results ?? ayRes.data ?? []);
        setSemesters(semRes.data.results ?? semRes.data ?? []);
        setProgrammes(progRes.data.results ?? progRes.data ?? []);
        setDepartments(deptRes.data.results ?? deptRes.data ?? []);
        setLecturers(lecRes.data.results ?? lecRes.data ?? []);
        setAllCourses(courseRes.data.results ?? courseRes.data ?? []);
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to load reference data.");
      }
    })();
  }, []);

  const semestersForYear = useMemo(
    () => semesters.filter((s) => s.academic_year === Number(academicYearId)),
    [semesters, academicYearId]
  );

  const selectedProgramme = useMemo(
    () => programmes.find((p) => p.id === Number(programmeId)),
    [programmes, programmeId]
  );

  const selectedSemester = useMemo(
    () => semesters.find((s) => s.id === Number(semesterId)),
    [semesters, semesterId]
  );

  const yearOptions = useMemo(() => {
    if (!selectedProgramme) return [];
    return Array.from({ length: selectedProgramme.duration_years }, (_, i) => i + 1);
  }, [selectedProgramme]);

  const canBuild = academicYearId && semesterId && programmeId && progYear;

  // ---------------------------------------------------------------
  // Load curriculum version + units + slots
  // ---------------------------------------------------------------
  const loadBoard = useCallback(async () => {
    if (!canBuild) return;
    setLoadingBoard(true);
    setError("");
    setCurriculumVersion(null);
    setCurriculumUnits([]);
    setSlots([]);
    try {
      const progSemester = selectedSemester?.semester_number;

      const cvRes = await adminApi.curriculumVersions({
        programme: programmeId,
        effective_academic_year: academicYearId,
      });
      const versions = cvRes.data.results ?? cvRes.data ?? [];
      const version = versions[0] || null;
      setCurriculumVersion(version);

      if (version) {
        const unitsRes = await adminApi.curriculumUnits({
          curriculum_version: version.id,
          year: progYear,
          semester: progSemester,
        });
        setCurriculumUnits(unitsRes.data.results ?? unitsRes.data ?? []);
      }

      const slotsRes = await adminApi.timetableSlots({
        programme: programmeId,
        semester: semesterId,
        year: progYear,
        programme_semester: progSemester,
      });
      setSlots(slotsRes.data.results ?? slotsRes.data ?? []);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load timetable data.");
    } finally {
      setLoadingBoard(false);
    }
  }, [canBuild, programmeId, academicYearId, semesterId, progYear, selectedSemester]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const createCurriculumVersion = async () => {
    try {
      const { data } = await adminApi.createCurriculumVersion({
        programme: programmeId,
        effective_academic_year: academicYearId,
        is_active: true,
        notes: "",
      });
      setCurriculumVersion(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create curriculum version.");
    }
  };

  const scheduledCourseIds = useMemo(() => new Set(slots.map((s) => s.course)), [slots]);

  const slotFor = (day, period) =>
    slots.find((s) => s.day_of_week === day && s.start_time?.slice(0, 5) === period.start);

  // ---------------------------------------------------------------
  // Drag & drop
  // ---------------------------------------------------------------
  const handleDragStart = (e, unit) => {
    e.dataTransfer.setData("application/json", JSON.stringify({
      courseId: unit.course_detail.id,
      courseLabel: `${unit.course_detail.code} — ${unit.course_detail.name}`,
    }));
  };

  const handleDrop = (e, day, period) => {
    e.preventDefault();
    const existing = slotFor(day, period);
    if (existing) return;
    let payload;
    try {
      payload = JSON.parse(e.dataTransfer.getData("application/json"));
    } catch {
      return;
    }
    setSlotError("");
    setScheduleModal({
      mode: "create",
      course: payload.courseId,
      courseLabel: payload.courseLabel,
      day,
      start: period.start,
      end: period.end,
      venue: "",
      lecturer: "",
    });
  };

  const openEditSlot = (slot) => {
    setSlotError("");
    setScheduleModal({
      mode: "edit",
      slotId: slot.id,
      course: slot.course,
      courseLabel: `${slot.course_detail?.code || ""} — ${slot.course_detail?.name || ""}`,
      day: slot.day_of_week,
      start: slot.start_time?.slice(0, 5),
      end: slot.end_time?.slice(0, 5),
      venue: slot.venue,
      lecturer: slot.lecturer,
    });
  };

  const saveSlot = async () => {
    if (!scheduleModal.lecturer || !scheduleModal.venue) {
      setSlotError("Lecturer and venue are required.");
      return;
    }
    setSavingSlot(true);
    setSlotError("");
    try {
      const payload = {
        course: scheduleModal.course,
        lecturer: scheduleModal.lecturer,
        semester: semesterId,
        programme: programmeId,
        year: progYear,
        programme_semester: selectedSemester.semester_number,
        day_of_week: scheduleModal.day,
        start_time: scheduleModal.start,
        end_time: scheduleModal.end,
        venue: scheduleModal.venue,
        is_active: true,
      };
      if (scheduleModal.mode === "create") {
        await adminApi.createTimetableSlot(payload);
      } else {
        await adminApi.updateTimetableSlot(scheduleModal.slotId, payload);
      }
      setScheduleModal(null);
      await loadBoard();
    } catch (err) {
      const data = err.response?.data;
      setSlotError(
        data ? Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ")
             : "Failed to save slot."
      );
    } finally {
      setSavingSlot(false);
    }
  };

  const deleteSlot = async () => {
    if (!scheduleModal?.slotId) return;
    if (!window.confirm("Remove this class from the timetable?")) return;
    setSavingSlot(true);
    try {
      await adminApi.deleteTimetableSlot(scheduleModal.slotId);
      setScheduleModal(null);
      await loadBoard();
    } catch (err) {
      setSlotError(err.response?.data?.detail || "Failed to delete slot.");
    } finally {
      setSavingSlot(false);
    }
  };

  // ---------------------------------------------------------------
  // Unit creation
  // ---------------------------------------------------------------
  const openUnitModal = () => {
    if (!curriculumVersion) return;
    setUnitError("");
    setUnitMode("existing");
    setExistingCourseId("");
    setNewCourseForm({ ...emptyCourseForm, department: selectedProgramme?.department || "" });
    setUnitModalOpen(true);
  };

  const saveUnit = async () => {
    setSavingUnit(true);
    setUnitError("");
    try {
      let courseId = existingCourseId;

      if (unitMode === "new") {
        if (!newCourseForm.name || !newCourseForm.code || !newCourseForm.department) {
          setUnitError("Name, code and department are required.");
          setSavingUnit(false);
          return;
        }
        const { data: newCourse } = await adminApi.createCourse(newCourseForm);
        courseId = newCourse.id;
        setAllCourses((prev) => [...prev, newCourse]);
      }

      if (!courseId) {
        setUnitError("Select or create a course first.");
        setSavingUnit(false);
        return;
      }

      await adminApi.createCurriculumUnit({
        curriculum_version: curriculumVersion.id,
        course: courseId,
        year: progYear,
        semester: selectedSemester.semester_number,
        is_mandatory: true,
      });

      setUnitModalOpen(false);
      await loadBoard();
    } catch (err) {
      const data = err.response?.data;
      setUnitError(
        data ? Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ")
             : "Failed to add unit."
      );
    } finally {
      setSavingUnit(false);
    }
  };

  const availableCoursesForDropdown = useMemo(
    () => allCourses.filter((c) => !curriculumUnits.some((u) => u.course === c.id)),
    [allCourses, curriculumUnits]
  );

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-calendar2-week" />
            Timetable Builder
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Admin <span className="separator">/</span> Timetable Builder
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/admin/dashboard" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}

      {/* ===== SELECTORS ===== */}
      <div className="mu-card" style={{ marginBottom: 24 }}>
        <div className="mu-card-body">
          <div className="mu-dashboard-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            <div className="mu-form-group" style={{ marginBottom: 0 }}>
              <label>Academic Year</label>
              <select
                className="mu-select"
                value={academicYearId}
                onChange={(e) => { setAcademicYearId(e.target.value); setSemesterId(""); }}
              >
                <option value="">Select...</option>
                {academicYears.map((ay) => <option key={ay.id} value={ay.id}>{ay.year}</option>)}
              </select>
            </div>

            <div className="mu-form-group" style={{ marginBottom: 0 }}>
              <label>Semester</label>
              <select
                className="mu-select"
                value={semesterId}
                onChange={(e) => setSemesterId(e.target.value)}
                disabled={!academicYearId}
              >
                <option value="">Select...</option>
                {semestersForYear.map((s) => (
                  <option key={s.id} value={s.id}>Semester {s.semester_number}</option>
                ))}
              </select>
            </div>

            <div className="mu-form-group" style={{ marginBottom: 0 }}>
              <label>Programme</label>
              <select
                className="mu-select"
                value={programmeId}
                onChange={(e) => { setProgrammeId(e.target.value); setProgYear(""); }}
              >
                <option value="">Select...</option>
                {programmes.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
              </select>
            </div>

            <div className="mu-form-group" style={{ marginBottom: 0 }}>
              <label>Year</label>
              <select
                className="mu-select"
                value={progYear}
                onChange={(e) => setProgYear(e.target.value)}
                disabled={!programmeId}
              >
                <option value="">Select...</option>
                {yearOptions.map((y) => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {!canBuild && (
        <div className="mu-card">
          <div className="mu-card-body" style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
            <i className="bi bi-calendar2-week" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
            <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>Select all options to build a timetable</h3>
            <p style={{ margin: "8px 0 0" }}>Choose an academic year, semester, programme and year to get started.</p>
          </div>
        </div>
      )}

      {canBuild && loadingBoard && (
        <div className="mu-card">
          <div className="mu-card-body" style={{ padding: 48, textAlign: "center" }}>
            <LoadingSpinner text="Loading timetable..." />
          </div>
        </div>
      )}

      {canBuild && !loadingBoard && !curriculumVersion && (
        <div className="mu-card">
          <div className="mu-card-body" style={{ padding: 48, textAlign: "center" }}>
            <i className="bi bi-folder-open" style={{ fontSize: 48, display: "block", marginBottom: 16, color: "var(--mu-gray-400)" }} />
            <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Curriculum Version</h3>
            <p style={{ margin: "8px 0 16px", color: "var(--mu-gray-400)" }}>
              No curriculum version exists yet for {selectedProgramme?.code} in {academicYears.find(a => a.id === Number(academicYearId))?.year}.
            </p>
            <button onClick={createCurriculumVersion} className="mu-btn mu-btn-primary">
              <i className="bi bi-plus-circle" />
              Create Curriculum Version
            </button>
          </div>
        </div>
      )}

      {canBuild && !loadingBoard && curriculumVersion && (
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {/* ===== SIDEBAR: units ===== */}
          <div style={{ width: 280, flexShrink: 0 }}>
            <div className="mu-card">
              <div className="mu-card-header">
                <h4>
                  <i className="bi bi-journal-bookmark" style={{ marginRight: 8 }} />
                  Units — Y{progYear}.{selectedSemester?.semester_number}
                </h4>
                <button onClick={openUnitModal} className="mu-btn mu-btn-sm mu-btn-primary">
                  <i className="bi bi-plus-circle" />
                  Add
                </button>
              </div>
              <div className="mu-card-body" style={{ padding: 12 }}>
                {curriculumUnits.length === 0 ? (
                  <div style={{ padding: 24, textAlign: "center", color: "var(--mu-gray-400)" }}>
                    <i className="bi bi-inbox" style={{ fontSize: 24, display: "block", marginBottom: 8 }} />
                    <span style={{ fontSize: "var(--mu-font-size-sm)" }}>No units mapped yet.</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {curriculumUnits.map((u) => {
                      const scheduled = scheduledCourseIds.has(u.course_detail.id);
                      return (
                        <div
                          key={u.id}
                          draggable={!scheduled}
                          onDragStart={(e) => handleDragStart(e, u)}
                          style={{
                            padding: "10px 12px",
                            borderRadius: "var(--mu-radius-sm)",
                            border: scheduled ? "1px solid var(--mu-border)" : "1px solid var(--mu-border)",
                            background: scheduled ? "var(--mu-gray-50)" : "var(--mu-white)",
                            color: scheduled ? "var(--mu-gray-400)" : "var(--mu-gray-800)",
                            cursor: scheduled ? "not-allowed" : "grab",
                            transition: "all var(--mu-transition-fast)",
                          }}
                          onMouseEnter={(e) => {
                            if (!scheduled) e.currentTarget.style.borderColor = "var(--mu-primary-400)";
                          }}
                          onMouseLeave={(e) => {
                            if (!scheduled) e.currentTarget.style.borderColor = "var(--mu-border)";
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: "var(--mu-font-size-sm)" }}>
                            {u.course_detail.code}
                            {scheduled && (
                              <span className="mu-badge mu-badge-success" style={{ marginLeft: 8, fontSize: "0.6rem" }}>
                                <i className="bi bi-check-circle" style={{ marginRight: 2 }} />
                                Scheduled
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "var(--mu-font-size-xs)", color: scheduled ? "var(--mu-gray-400)" : "var(--mu-gray-500)" }}>
                            {u.course_detail.name}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ===== GRID ===== */}
          <div style={{ flex: 1, overflowX: "auto" }}>
            <div className="mu-card">
              <div className="mu-card-body" style={{ padding: 0, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--mu-font-size-sm)" }}>
                  <thead>
                    <tr>
                      <th style={{ border: "1px solid var(--mu-border)", padding: "10px 12px", background: "var(--mu-gray-50)", textAlign: "center", minWidth: 100 }}>
                        Time
                      </th>
                      {DAYS.map((d) => (
                        <th key={d} style={{ border: "1px solid var(--mu-border)", padding: "10px 12px", background: "var(--mu-gray-50)", textAlign: "center", minWidth: 140 }}>
                          {d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PERIODS.map((period) => (
                      <tr key={period.label}>
                        <td style={{ border: "1px solid var(--mu-border)", padding: "8px 12px", background: "var(--mu-gray-50)", textAlign: "center", fontSize: "var(--mu-font-size-xs)", whiteSpace: "nowrap" }}>
                          {period.label}
                        </td>
                        {DAYS.map((day) => {
                          const slot = slotFor(day, period);
                          return (
                            <td
                              key={day + period.label}
                              onDragOver={(e) => !slot && e.preventDefault()}
                              onDrop={(e) => handleDrop(e, day, period)}
                              style={{
                                border: "1px solid var(--mu-border)",
                                padding: 4,
                                minHeight: 80,
                                height: 80,
                                verticalAlign: "top",
                                background: slot ? "var(--mu-white)" : !slot ? "var(--mu-gray-50)" : "var(--mu-white)",
                                cursor: slot ? "pointer" : "default",
                                transition: "background var(--mu-transition-fast)",
                              }}
                              onMouseEnter={(e) => {
                                if (!slot) e.currentTarget.style.background = "var(--mu-primary-50)";
                              }}
                              onMouseLeave={(e) => {
                                if (!slot) e.currentTarget.style.background = "var(--mu-gray-50)";
                              }}
                            >
                              {slot ? (
                                <button
                                  onClick={() => openEditSlot(slot)}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    textAlign: "left",
                                    background: "var(--mu-primary-50)",
                                    border: "1px solid var(--mu-primary-200)",
                                    borderRadius: "var(--mu-radius-sm)",
                                    padding: "6px 8px",
                                    cursor: "pointer",
                                    transition: "all var(--mu-transition-fast)",
                                    fontSize: "var(--mu-font-size-xs)",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "var(--mu-primary-100)";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "var(--mu-primary-50)";
                                  }}
                                >
                                  <div style={{ fontWeight: 600, fontSize: "0.7rem" }}>{slot.course_detail?.code}</div>
                                  <div style={{ color: "var(--mu-gray-600)", fontSize: "0.65rem" }}>
                                    {slot.lecturer_detail?.user_detail?.first_name} {slot.lecturer_detail?.user_detail?.last_name}
                                  </div>
                                  <div style={{ color: "var(--mu-gray-500)", fontSize: "0.6rem" }}>{slot.venue}</div>
                                </button>
                              ) : (
                                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--mu-gray-300)", fontSize: "0.6rem" }}>
                                  drop here
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== SCHEDULE MODAL ===== */}
      {scheduleModal && (
        <Modal
          isOpen={true}
          onClose={() => setScheduleModal(null)}
          title={scheduleModal.mode === "create" ? "Schedule Class" : "Edit Class"}
          size="md"
          confirmText="Save"
          onConfirm={saveSlot}
          isLoading={savingSlot}
        >
          {slotError && (
            <div className="mu-alert mu-alert-danger">
              <i className="bi bi-exclamation-triangle" />
              {slotError}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <div className="mu-form-group" style={{ marginBottom: 0 }}>
              <label>Unit</label>
              <div className="mu-input" style={{ background: "var(--mu-gray-50)", fontWeight: 500 }}>
                {scheduleModal.courseLabel}
              </div>
            </div>
            <div className="mu-form-group" style={{ marginBottom: 0 }}>
              <label>Slot</label>
              <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                {scheduleModal.day}, {scheduleModal.start} – {scheduleModal.end}
              </div>
            </div>
          </div>

          <div className="mu-form-group">
            <label>Lecturer</label>
            <select
              className="mu-select"
              value={scheduleModal.lecturer}
              onChange={(e) => setScheduleModal((p) => ({ ...p, lecturer: e.target.value }))}
            >
              <option value="">Select...</option>
              {lecturers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.user_detail?.first_name} {l.user_detail?.last_name}
                </option>
              ))}
            </select>
          </div>

          <div className="mu-form-group">
            <label>Venue</label>
            <input
              type="text"
              className="mu-input"
              value={scheduleModal.venue}
              onChange={(e) => setScheduleModal((p) => ({ ...p, venue: e.target.value }))}
              placeholder="e.g. LH 3"
            />
          </div>

          {scheduleModal.mode === "edit" && (
            <div className="mu-alert mu-alert-danger" style={{ marginTop: 12 }}>
              <i className="bi bi-exclamation-triangle" />
              <button
                onClick={deleteSlot}
                disabled={savingSlot}
                className="mu-btn mu-btn-sm mu-btn-danger"
                style={{ marginLeft: 8 }}
              >
                <i className="bi bi-trash" />
                Remove Slot
              </button>
            </div>
          )}
        </Modal>
      )}

      {/* ===== ADD UNIT MODAL ===== */}
      {unitModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setUnitModalOpen(false)}
          title={`Add Unit — Y${progYear}.${selectedSemester?.semester_number}`}
          size="md"
          confirmText="Add to Curriculum"
          onConfirm={saveUnit}
          isLoading={savingUnit}
        >
          {unitError && (
            <div className="mu-alert mu-alert-danger">
              <i className="bi bi-exclamation-triangle" />
              {unitError}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => setUnitMode("existing")}
              className={`mu-btn ${unitMode === "existing" ? "mu-btn-primary" : "mu-btn-outline-primary"}`}
              type="button"
            >
              Existing course
            </button>
            <button
              onClick={() => setUnitMode("new")}
              className={`mu-btn ${unitMode === "new" ? "mu-btn-primary" : "mu-btn-outline-primary"}`}
              type="button"
            >
              Create new course
            </button>
          </div>

          {unitMode === "existing" ? (
            <div className="mu-form-group">
              <label>Course</label>
              <select
                className="mu-select"
                value={existingCourseId}
                onChange={(e) => setExistingCourseId(e.target.value)}
              >
                <option value="">Select...</option>
                {availableCoursesForDropdown.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className="mu-form-group">
                <label>Name</label>
                <input
                  type="text"
                  className="mu-input"
                  value={newCourseForm.name}
                  onChange={(e) => setNewCourseForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="mu-form-group">
                <label>Code</label>
                <input
                  type="text"
                  className="mu-input"
                  value={newCourseForm.code}
                  onChange={(e) => setNewCourseForm((p) => ({ ...p, code: e.target.value }))}
                />
              </div>
              <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
                <div className="mu-form-group">
                  <label>Type</label>
                  <select
                    className="mu-select"
                    value={newCourseForm.course_type}
                    onChange={(e) => setNewCourseForm((p) => ({ ...p, course_type: e.target.value }))}
                  >
                    <option value="core">Core</option>
                    <option value="elective">Elective</option>
                    <option value="common">Common / Shared</option>
                    <option value="capstone">Capstone</option>
                  </select>
                </div>
                <div className="mu-form-group">
                  <label>Credit Hours</label>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    className="mu-input"
                    value={newCourseForm.credit_hours}
                    onChange={(e) => setNewCourseForm((p) => ({ ...p, credit_hours: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mu-form-group">
                <label>Department</label>
                <select
                  className="mu-select"
                  value={newCourseForm.department}
                  onChange={(e) => setNewCourseForm((p) => ({ ...p, department: e.target.value }))}
                >
                  <option value="">Select...</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}