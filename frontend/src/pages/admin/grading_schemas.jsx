// src/pages/admin/grading_schemas.jsx
import { useState, useEffect, useCallback, useMemo } from "react";
import { adminApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import {
  Modal, ConfirmModal, Field, EmptyState,
  summarizeErrors, unwrapList,
} from "../../components/ui/AdminUI";

function SchemeFormModal({ mode, scheme, onClose, onSaved }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState({
    name: scheme?.name || "",
    description: scheme?.description || "",
    pass_mark: scheme?.pass_mark ?? "40.00",
    supplementary_floor: scheme?.supplementary_floor ?? "30.00",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name) {
      setError("Scheme name is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        pass_mark: Number(form.pass_mark),
        supplementary_floor: Number(form.supplementary_floor),
      };
      const data = isEdit
        ? (await adminApi.updateGradingScheme(scheme.id, payload)).data
        : (await adminApi.createGradingScheme(payload)).data;
      onSaved(data, isEdit ? "Grading scheme updated." : "Grading scheme created.");
    } catch (err) {
      setError(err.response?.data?.detail || summarizeErrors(err) || "Could not save grading scheme.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? "Edit Grading Scheme" : "Add Grading Scheme"} onClose={onClose} width={480}>
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <Field label="Name">
          <input className="mu-input" required value={form.name} onChange={handleChange("name")} />
        </Field>

        <div style={{ marginTop: 12 }}>
          <Field label="Description (optional)">
            <textarea className="mu-input" rows={2} value={form.description} onChange={handleChange("description")} />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <Field label="Pass Mark">
            <input type="number" step="0.01" min={0} max={100} className="mu-input" value={form.pass_mark} onChange={handleChange("pass_mark")} />
          </Field>
          <Field label="Supplementary Floor">
            <input type="number" step="0.01" min={0} max={100} className="mu-input" value={form.supplementary_floor} onChange={handleChange("supplementary_floor")} />
          </Field>
        </div>
        <p style={{ fontSize: 12, color: "#999", marginTop: 6 }}>
          Marks below the floor are an outright fail; between floor and pass mark allows a supplementary sitting.
        </p>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
          <button type="button" className="mu-btn mu-btn-outline-primary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Scheme"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function BandFormModal({ mode, band, schemeId, onClose, onSaved }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState({
    letter: band?.letter || "",
    min_score: band?.min_score ?? "",
    max_score: band?.max_score ?? "",
    points: band?.points ?? "",
    is_supplementary_band: band?.is_supplementary_band || false,
    is_fail_band: band?.is_fail_band || false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.letter || form.min_score === "" || form.max_score === "" || form.points === "") {
      setError("Letter, min score, max score and points are all required.");
      return;
    }
    if (Number(form.min_score) > Number(form.max_score)) {
      setError("Min score cannot exceed max score.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        scheme: schemeId,
        letter: form.letter,
        min_score: Number(form.min_score),
        max_score: Number(form.max_score),
        points: Number(form.points),
        is_supplementary_band: form.is_supplementary_band,
        is_fail_band: form.is_fail_band,
      };
      const data = isEdit
        ? (await adminApi.updateGradeBand(band.id, payload)).data
        : (await adminApi.createGradeBand(payload)).data;
      onSaved(data, isEdit ? "Band updated." : "Band added.");
    } catch (err) {
      setError(err.response?.data?.detail || summarizeErrors(err) || "Could not save band.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? "Edit Grade Band" : "Add Grade Band"} onClose={onClose} width={420}>
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Letter"><input className="mu-input" maxLength={3} value={form.letter} onChange={handleChange("letter")} /></Field>
          <Field label="Points"><input type="number" step="0.01" min={0} max={5} className="mu-input" value={form.points} onChange={handleChange("points")} /></Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <Field label="Min Score"><input type="number" step="0.01" min={0} max={100} className="mu-input" value={form.min_score} onChange={handleChange("min_score")} /></Field>
          <Field label="Max Score"><input type="number" step="0.01" min={0} max={100} className="mu-input" value={form.max_score} onChange={handleChange("max_score")} /></Field>
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: 13 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={form.is_supplementary_band} onChange={handleChange("is_supplementary_band")} />
            Supplementary band
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={form.is_fail_band} onChange={handleChange("is_fail_band")} />
            Fail band
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
          <button type="button" className="mu-btn mu-btn-outline-primary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Band"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function BandsModal({ scheme, onClose, showToast }) {
  const [bands, setBands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bandModal, setBandModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await adminApi.gradeBands({ scheme: scheme.id });
      const list = unwrapList(data).sort((a, b) => Number(b.min_score) - Number(a.min_score));
      setBands(list);
    } catch {
      setError("Failed to load grade bands.");
    } finally {
      setLoading(false);
    }
  }, [scheme.id]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    try {
      await adminApi.deleteGradeBand(deleteTarget.id);
      showToast("Band deleted.");
      setDeleteTarget(null);
      load();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not delete band.");
      setDeleteTarget(null);
    }
  };

  return (
    <Modal title={`Grade Bands — ${scheme.name}`} onClose={onClose} width={620}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: "#777" }}>
          Pass mark {scheme.pass_mark} &middot; Supplementary floor {scheme.supplementary_floor}
        </span>
        <button className="mu-btn mu-btn-sm mu-btn-primary" onClick={() => setBandModal({ mode: "add" })}>
          <i className="bi bi-plus-circle" /> Add Band
        </button>
      </div>

      {error && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 12 }}>{error}</div>}

      {loading ? (
        <div style={{ padding: 24 }}><LoadingSpinner text="Loading bands..." /></div>
      ) : bands.length === 0 ? (
        <EmptyState icon="bi-list-ol" label="No grade bands yet" hint="Add bands to define this scheme's letter grades." />
      ) : (
        <div className="mu-table-wrapper">
          <table className="mu-table mu-table-hover">
            <thead>
              <tr><th>Letter</th><th>Range</th><th>Points</th><th>Type</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {bands.map((b) => (
                <tr key={b.id}>
                  <td><strong>{b.letter}</strong></td>
                  <td>{b.min_score} – {b.max_score}</td>
                  <td>{b.points}</td>
                  <td>
                    {b.is_fail_band ? (
                      <span style={{ color: "#b3261e", fontSize: 12, fontWeight: 600 }}>Fail</span>
                    ) : b.is_supplementary_band ? (
                      <span style={{ color: "#a15c00", fontSize: 12, fontWeight: 600 }}>Supplementary</span>
                    ) : (
                      <span style={{ color: "#0f7a4a", fontSize: 12, fontWeight: 600 }}>Pass</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setBandModal({ mode: "edit", band: b })}>
                        <i className="bi bi-pencil" />
                      </button>
                      <button className="mu-btn mu-btn-sm mu-btn-danger" onClick={() => setDeleteTarget(b)}>
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {bandModal && (
        <BandFormModal
          mode={bandModal.mode} band={bandModal.band} schemeId={scheme.id}
          onClose={() => setBandModal(null)}
          onSaved={(_d, msg) => { setBandModal(null); showToast(msg); load(); }}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Band"
          message={`Delete the "${deleteTarget.letter}" band?`}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </Modal>
  );
}

export default function GradingSchemas() {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [departments, setDepartments] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [programmes, setProgrammes] = useState([]);

  // lookup/filter cascade
  const [academicYearId, setAcademicYearId] = useState("");
  const [programmeId, setProgrammeId] = useState("");
  const [progYear, setProgYear] = useState("");
  const [progSemester, setProgSemester] = useState("");
  const [curriculumVersion, setCurriculumVersion] = useState(null);
  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolvedSchemeId, setResolvedSchemeId] = useState(null);
  const [resolvedNote, setResolvedNote] = useState("");

  const [formModal, setFormModal] = useState(null);
  const [bandsTarget, setBandsTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  const fetchSchemes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await adminApi.gradingSchemes();
      setSchemes(unwrapList(data));
    } catch {
      setError("Failed to load grading schemes.");
      setSchemes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSchemes(); }, [fetchSchemes]);

  useEffect(() => {
    Promise.all([adminApi.departments(), adminApi.academicYears(), adminApi.programmes()]).then(
      ([dRes, yRes, pRes]) => {
        setDepartments(unwrapList(dRes.data));
        setAcademicYears(unwrapList(yRes.data));
        setProgrammes(unwrapList(pRes.data));
      }
    ).catch(() => {});
  }, []);

  const selectedProgramme = useMemo(
    () => programmes.find((p) => p.id === Number(programmeId)),
    [programmes, programmeId]
  );
  const yearOptions = useMemo(
    () => selectedProgramme ? Array.from({ length: selectedProgramme.duration_years }, (_, i) => i + 1) : [],
    [selectedProgramme]
  );
  const semesterOptions = useMemo(
    () => selectedProgramme ? Array.from({ length: selectedProgramme.semesters_per_year }, (_, i) => i + 1) : [],
    [selectedProgramme]
  );

  const canResolve = academicYearId && programmeId && progYear && progSemester;

  // Load curriculum version + units whenever the cascade selection completes
  useEffect(() => {
    if (!canResolve) {
      setCurriculumVersion(null); setUnits([]); setUnitId("");
      setResolvedSchemeId(null); setResolvedNote("");
      return;
    }
    (async () => {
      setResolving(true);
      setResolvedSchemeId(null);
      setResolvedNote("");
      try {
        const cvRes = await adminApi.curriculumVersions({ programme: programmeId, effective_academic_year: academicYearId });
        const versions = unwrapList(cvRes.data);
        const version = versions[0] || null;
        setCurriculumVersion(version);
        if (!version) { setUnits([]); setUnitId(""); return; }

        const unitsRes = await adminApi.curriculumUnits({ curriculum_version: version.id, year: progYear, semester: progSemester });
        setUnits(unwrapList(unitsRes.data));
        setUnitId("");
      } catch {
        setCurriculumVersion(null); setUnits([]);
      } finally {
        setResolving(false);
      }
    })();
  }, [canResolve, programmeId, academicYearId, progYear, progSemester]);

  // Resolve scheme once a unit is picked
  useEffect(() => {
    if (!unitId) { setResolvedSchemeId(null); setResolvedNote(""); return; }
    const unit = units.find((u) => u.id === Number(unitId));
    if (!unit) return;
    const dept = departments.find((d) => d.id === unit.course_detail?.department);
    if (!dept) {
      setResolvedSchemeId(null);
      setResolvedNote("Could not resolve this unit's department.");
      return;
    }
    if (!dept.grading_scheme) {
      setResolvedSchemeId(null);
      setResolvedNote(`${dept.name} has no grading scheme assigned yet.`);
      return;
    }
    setResolvedSchemeId(dept.grading_scheme);
    setResolvedNote(`${unit.course_detail.code} is graded via ${dept.name}'s scheme.`);
  }, [unitId, units, departments]);

  const departmentCountFor = (schemeId) => departments.filter((d) => d.grading_scheme === schemeId).length;

  const visibleSchemes = resolvedSchemeId
    ? schemes.filter((s) => s.id === resolvedSchemeId)
    : schemes;

  const resetFilters = () => {
    setAcademicYearId(""); setProgrammeId(""); setProgYear(""); setProgSemester("");
    setUnitId(""); setResolvedSchemeId(null); setResolvedNote("");
  };

  const handleDelete = async () => {
    try {
      await adminApi.deleteGradingScheme(deleteTarget.id);
      showToast("Grading scheme deleted.");
      setDeleteTarget(null);
      fetchSchemes();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not delete — one or more departments still use this scheme.");
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <div className="mu-page-header">
        <div>
          <h1><i className="bi bi-clipboard-data" /> Grading Schemes</h1>
          <div className="mu-breadcrumb">Home <span className="separator">/</span> Academics <span className="separator">/</span> Grading Schemes</div>
        </div>
        <div className="mu-page-header-actions">
          <button className="mu-btn mu-btn-primary" onClick={() => setFormModal({ mode: "add" })}>
            <i className="bi bi-plus-circle" /> Add Scheme
          </button>
        </div>
      </div>

      {toast && <div className="mu-alert mu-alert-success"><i className="bi bi-check-circle" /> {toast}</div>}
      {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

      <div className="mu-card" style={{ marginBottom: 16 }}>
        <div className="mu-card-header">
          <h4>Find a Unit's Scheme</h4>
        </div>
        <div className="mu-card-body">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
            <div style={{ width: 160 }}>
              <Field label="Academic Year">
                <select className="mu-input" value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)}>
                  <option value="">Select...</option>
                  {academicYears.map((y) => <option key={y.id} value={y.id}>{y.year}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ width: 220 }}>
              <Field label="Programme">
                <select className="mu-input" value={programmeId} onChange={(e) => { setProgrammeId(e.target.value); setProgYear(""); setProgSemester(""); }}>
                  <option value="">Select...</option>
                  {programmes.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ width: 120 }}>
              <Field label="Year">
                <select className="mu-input" value={progYear} disabled={!programmeId} onChange={(e) => setProgYear(e.target.value)}>
                  <option value="">Select...</option>
                  {yearOptions.map((y) => <option key={y} value={y}>Year {y}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ width: 120 }}>
              <Field label="Semester">
                <select className="mu-input" value={progSemester} disabled={!programmeId} onChange={(e) => setProgSemester(e.target.value)}>
                  <option value="">Select...</option>
                  {semesterOptions.map((s) => <option key={s} value={s}>Sem {s}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ width: 240 }}>
              <Field label="Unit">
                <select className="mu-input" value={unitId} disabled={!canResolve || resolving} onChange={(e) => setUnitId(e.target.value)}>
                  <option value="">{resolving ? "Loading..." : "Select..."}</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>{u.course_detail?.code} — {u.course_detail?.name}</option>
                  ))}
                </select>
              </Field>
            </div>
            <button className="mu-btn mu-btn-outline-primary" onClick={resetFilters}>Reset</button>
          </div>

          {canResolve && !resolving && units.length === 0 && curriculumVersion && (
            <p style={{ fontSize: 13, color: "#999", marginTop: 10 }}>
              No units mapped for {selectedProgramme?.code} Y{progYear} S{progSemester} yet.
            </p>
          )}
          {canResolve && !resolving && !curriculumVersion && (
            <p style={{ fontSize: 13, color: "#999", marginTop: 10 }}>
              No curriculum version exists for this programme in that academic year.
            </p>
          )}
          {resolvedNote && (
            <div className="mu-alert mu-alert-primary" style={{ marginTop: 12, marginBottom: 0 }}>
              <i className="bi bi-info-circle" /> {resolvedNote}
            </div>
          )}
        </div>
      </div>

      <div className="mu-card">
        <div className="mu-card-header">
          <h4>{resolvedSchemeId ? "Matching Scheme" : "All Grading Schemes"}</h4>
          <span className="mu-badge mu-badge-primary">{visibleSchemes.length} total</span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 48 }}><LoadingSpinner text="Loading..." /></div>
          ) : visibleSchemes.length === 0 ? (
            <EmptyState icon="bi-clipboard-data" label="No grading schemes found" hint="Create one to start grading units." />
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr><th>Name</th><th>Description</th><th>Pass Mark</th><th>Supp. Floor</th><th>Bands</th><th>Departments</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {visibleSchemes.map((sch) => (
                    <tr key={sch.id}>
                      <td><strong>{sch.name}</strong></td>
                      <td style={{ maxWidth: 220, color: "#777" }}>{sch.description || "—"}</td>
                      <td>{sch.pass_mark}</td>
                      <td>{sch.supplementary_floor}</td>
                      <td>{sch.bands?.length ?? 0}</td>
                      <td>{departmentCountFor(sch.id)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setBandsTarget(sch)} title="Manage bands">
                            <i className="bi bi-list-ol" />
                          </button>
                          <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setFormModal({ mode: "edit", scheme: sch })} title="Edit">
                            <i className="bi bi-pencil" />
                          </button>
                          <button className="mu-btn mu-btn-sm mu-btn-danger" onClick={() => setDeleteTarget(sch)} title="Delete">
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {formModal && (
        <SchemeFormModal
          mode={formModal.mode} scheme={formModal.scheme}
          onClose={() => setFormModal(null)}
          onSaved={(_d, msg) => { setFormModal(null); showToast(msg); fetchSchemes(); }}
        />
      )}

      {bandsTarget && (
        <BandsModal
          scheme={bandsTarget}
          onClose={() => { setBandsTarget(null); fetchSchemes(); }}
          showToast={showToast}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Grading Scheme"
          message={`Delete "${deleteTarget.name}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}