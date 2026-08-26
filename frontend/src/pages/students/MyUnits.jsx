import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { unitsApi, studentsApi } from "../../services/api";

export default function MyUnits() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState([]);
  const [studentProfile, setStudentProfile] = useState(null);
  const [availableUnits, setAvailableUnits] = useState([]);
  const [supplementaryUnits, setSupplementaryUnits] = useState([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState([]);
  const [currentSemester, setCurrentSemester] = useState(null);
  const [feeInfo, setFeeInfo] = useState({ total_outstanding: 0, wallet_credit: 0, can_register: true });
  const [error, setError] = useState("");
  const [registering, setRegistering] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [profileRes, availRes, regRes] = await Promise.all([
        studentsApi.myProfile(),
        unitsApi.availableUnits(),
        unitsApi.myRegistrations(),
      ]);

      setStudentProfile(profileRes.data);
      setCurrentSemester(availRes.data.semester);
      setAvailableUnits(availRes.data.units || []);
      setSupplementaryUnits(availRes.data.supplementary_units || []);
      setFeeInfo(availRes.data.fee || { total_outstanding: 0, wallet_credit: 0, can_register: true });
      setRegistrations(regRes.data || []);

      const alreadyRegistered = [...(availRes.data.units || []), ...(availRes.data.supplementary_units || [])]
        .filter((u) => u.is_registered)
        .map((u) => u.course.id);
      setSelectedCourseIds(alreadyRegistered);
    } catch (err) {
      console.error("Error fetching units:", err);
      setError("Failed to load your units. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleUnit = (courseId, isRegistered) => {
    if (isRegistered) return;
    setSelectedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  const handleRegister = async () => {
    const allUnits = [...availableUnits, ...supplementaryUnits];
    const newlySelected = selectedCourseIds.filter((id) => {
      const unit = allUnits.find((u) => u.course.id === id);
      return unit && !unit.is_registered;
    });

    if (newlySelected.length === 0) {
      setError("Select at least one unit that isn't already registered.");
      return;
    }

    setRegistering(true);
    setError("");
    try {
      await unitsApi.registerSelected(newlySelected);
      await loadData();
    } catch (err) {
      console.error("Error registering units:", err);
      setError(err.response?.data?.detail || "Failed to register units. Please try again.");
    } finally {
      setRegistering(false);
    }
  };

  const stats = {
    total: registrations.length,
    normal: registrations.filter((r) => r.registration_type === "normal").length,
    supplementary: registrations.filter((r) => r.registration_type === "supplementary").length,
    repeat: registrations.filter((r) => r.registration_type === "repeat").length,
  };

  const getTypeBadge = (type) => {
    const typeMap = {
      normal: { class: "mu-badge-primary", label: "Normal" },
      supplementary: { class: "mu-badge-warning", label: "Supplementary" },
      repeat: { class: "mu-badge-danger", label: "Repeat" },
      audit: { class: "mu-badge-gray", label: "Audit" },
    };
    return typeMap[type] || typeMap.normal;
  };

  const getStatusBadge = (registration) => {
    if (registration.grade_detail) {
      const grade = registration.grade_detail;
      if (grade.is_pass) return { class: "mu-badge-success", icon: "bi-check-circle", label: "Passed" };
      if (grade.requires_supplementary)
        return { class: "mu-badge-warning", icon: "bi-arrow-repeat", label: "Supplementary Required" };
      return { class: "mu-badge-danger", icon: "bi-x-circle", label: "Failed" };
    }
    if (registration.is_active) return { class: "mu-badge-info", icon: "bi-clock", label: "In Progress" };
    return { class: "mu-badge-gray", icon: "bi-dash-circle", label: "Pending" };
  };

  if (loading) {
    return (
      <div className="mu-loader">
        <i className="bi bi-arrow-repeat mu-animate-spin" />
        <span>Loading your units...</span>
      </div>
    );
  }

  const allSelectable = [...availableUnits, ...supplementaryUnits];

  return (
    <div>
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-journal-bookmark" />
            My Units
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Academics <span className="separator">/</span> My Units
          </div>
        </div>
      </div>

      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}

      {!feeInfo.can_register ? (
        <div className="mu-alert mu-alert-danger" style={{ marginBottom: 24 }}>
          <i className="bi bi-exclamation-octagon" />
          <div>
            <strong>Unit registration is locked.</strong> You have an outstanding fee balance of{" "}
            <strong>KES {Number(feeInfo.total_outstanding).toLocaleString()}</strong> from the current or a
            previous semester. Clear it to unlock registration.{" "}
            <Link to="/fees" className="mu-link">View fee statement</Link>
          </div>
        </div>
      ) : (
        feeInfo.wallet_credit > 0 && (
          <div className="mu-alert mu-alert-info" style={{ marginBottom: 24 }}>
            <i className="bi bi-piggy-bank" />
            You have a wallet credit of KES {Number(feeInfo.wallet_credit).toLocaleString()} that will apply
            to your next invoice.
          </div>
        )
      )}

      {currentSemester && (
        <div className="mu-alert mu-alert-info" style={{ marginBottom: 24 }}>
          <i className="bi bi-calendar3" />
          <div>
            <strong>Current Semester:</strong> {currentSemester.academic_year_detail?.year || "N/A"} -
            Semester {currentSemester.semester_number}
            {currentSemester.is_current && (
              <span className="mu-badge mu-badge-success" style={{ marginLeft: 8 }}>
                <i className="bi bi-check-circle" />
                Current
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mu-dashboard-grid" style={{ marginBottom: 24 }}>
        <div className="mu-stat-card">
          <div className="mu-stat-icon blue"><i className="bi bi-journal-bookmark" /></div>
          <div className="mu-stat-label">Total Registered</div>
          <div className="mu-stat-value">{stats.total}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon green"><i className="bi bi-check-circle" /></div>
          <div className="mu-stat-label">Normal Units</div>
          <div className="mu-stat-value">{stats.normal}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon gold"><i className="bi bi-arrow-repeat" /></div>
          <div className="mu-stat-label">Supplementary</div>
          <div className="mu-stat-value">{stats.supplementary}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon red"><i className="bi bi-exclamation-triangle" /></div>
          <div className="mu-stat-label">Repeat</div>
          <div className="mu-stat-value">{stats.repeat}</div>
        </div>
      </div>

      <div className="mu-card" style={{ marginBottom: 24 }}>
        <div className="mu-card-header">
          <h4>
            Units For Year {studentProfile?.current_year} · Semester {studentProfile?.current_semester}
          </h4>
          <button
            className="mu-btn mu-btn-primary mu-btn-sm"
            onClick={handleRegister}
            disabled={registering || !feeInfo.can_register}
            title={!feeInfo.can_register ? "Clear your fee balance to register" : ""}
          >
            {registering ? (
              <><i className="bi bi-arrow-repeat mu-animate-spin" /> Registering...</>
            ) : (
              <><i className="bi bi-check2-square" /> Register Selected</>
            )}
          </button>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {allSelectable.length > 0 ? (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Course Code</th>
                    <th>Course Name</th>
                    <th>Credit Hours</th>
                    <th>Type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allSelectable.map((u) => (
                    <tr key={u.course.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedCourseIds.includes(u.course.id)}
                          disabled={u.is_registered || !feeInfo.can_register}
                          onChange={() => toggleUnit(u.course.id, u.is_registered)}
                        />
                      </td>
                      <td><strong>{u.course.code}</strong></td>
                      <td>{u.course.name}</td>
                      <td>{u.course.credit_hours}</td>
                      <td>
                        <span className={`mu-badge ${u.registration_type === "supplementary" ? "mu-badge-warning" : u.is_mandatory ? "mu-badge-primary" : "mu-badge-gray"}`}>
                          {u.registration_type === "supplementary" ? "Supplementary" : u.is_mandatory ? "Mandatory" : "Elective"}
                        </span>
                      </td>
                      <td>
                        {u.is_registered ? (
                          <span className="mu-badge mu-badge-success">
                            <i className="bi bi-check-circle" style={{ marginRight: 4 }} />
                            Registered
                          </span>
                        ) : (
                          <span className="mu-badge mu-badge-gray">Not Registered</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 32, textAlign: "center", color: "var(--mu-gray-400)" }}>
              No units are mapped to your current year/semester yet. Contact the registrar.
            </div>
          )}
        </div>
      </div>

      <div className="mu-card">
        <div className="mu-card-header">
          <h4>All My Registered Units</h4>
          <span className="mu-badge mu-badge-primary">{registrations.length} Units</span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {registrations.length > 0 ? (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Course Code</th>
                    <th>Course Name</th>
                    <th>Type</th>
                    <th>Credit Hours</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((reg) => {
                    const typeBadge = getTypeBadge(reg.registration_type);
                    const statusBadge = getStatusBadge(reg);
                    return (
                      <tr key={reg.id}>
                        <td><strong>{reg.course_detail?.code || "N/A"}</strong></td>
                        <td>{reg.course_detail?.name || "Unknown Course"}</td>
                        <td><span className={`mu-badge ${typeBadge.class}`}>{typeBadge.label}</span></td>
                        <td>{reg.course_detail?.credit_hours || "N/A"}</td>
                        <td>
                          <span className={`mu-badge ${statusBadge.class}`}>
                            <i className={`bi ${statusBadge.icon}`} style={{ marginRight: 4 }} />
                            {statusBadge.label}
                          </span>
                        </td>
                        <td>
                          <Link to={`/unit/${reg.course_detail?.id}`} className="mu-btn mu-btn-sm mu-btn-outline-primary">
                            <i className="bi bi-eye" />
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-journal-bookmark" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Units Registered</h3>
              <p style={{ margin: "8px 0 16px" }}>
                Use the checklist above to select and register your units for this semester.
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}