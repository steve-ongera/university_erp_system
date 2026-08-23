// src/pages/hostel/HostelWardenDashboard.jsx
import { useState, useEffect, useCallback } from "react";
import { adminApi, hostelWardenApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import { EmptyState, unwrapList } from "../../components/ui/AdminUI";

import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const PALETTE = ["#3b6ce0", "#1a8a5a", "#c97d2a", "#7c3aed", "#c23b3b"];
const STATUS_BADGE = { pending: "warning", approved: "success", checked_in: "info", checked_out: "gray", cancelled: "danger" };

function fullName(user) {
  if (!user) return "N/A";
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || "N/A";
}

export default function HostelWardenDashboard() {
  const [academicYears, setAcademicYears] = useState([]);
  const [academicYearId, setAcademicYearId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi.academicYears().then(({ data }) => {
      const list = unwrapList(data);
      setAcademicYears(list);
      const current = list.find((y) => y.is_current);
      if (current) setAcademicYearId(current.id);
    }).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    hostelWardenApi.dashboard(academicYearId)
      .then(({ data }) => setData(data))
      .catch(() => setError("Failed to load hostel dashboard."))
      .finally(() => setLoading(false));
  }, [academicYearId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ padding: 48 }}><LoadingSpinner text="Loading hostel dashboard..." /></div>;
  if (error) return <div className="mu-alert mu-alert-danger">{error}</div>;
  if (!data) return <EmptyState icon="bi-building" label="No hostel data available" />;

  const occupancyDoughnut = {
    labels: data.occupancy_by_hostel.map((h) => h.room__hostel__name),
    datasets: [{
      data: data.occupancy_by_hostel.map((h) => h.occupied),
      backgroundColor: PALETTE, borderColor: "#fff", borderWidth: 2,
    }],
  };

  const statusEntries = Object.entries(data.bookings_by_status || {});
  const statusBar = {
    labels: statusEntries.map(([k]) => k),
    datasets: [{ label: "Bookings", data: statusEntries.map(([, v]) => v), backgroundColor: PALETTE, borderRadius: 6 }],
  };

  return (
    <div>
      <div className="mu-page-header">
        <div>
          <h1><i className="bi bi-building" /> Hostel Dashboard</h1>
          <div className="mu-breadcrumb">Home <span className="separator">/</span> Hostel <span className="separator">/</span> Dashboard</div>
        </div>
        <div className="mu-page-header-actions">
          <select className="mu-input" style={{ width: 200 }} value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)}>
            {academicYears.map((y) => <option key={y.id} value={y.id}>{y.year}</option>)}
          </select>
        </div>
      </div>

      <div className="mu-dashboard-grid" style={{ marginBottom: 20 }}>
        <div className="mu-stat-card">
          <div className="mu-stat-icon blue"><i className="bi bi-door-open" /></div>
          <div className="mu-stat-label">Total Beds</div>
          <div className="mu-stat-value">{data.total_beds}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon red"><i className="bi bi-person-fill-check" /></div>
          <div className="mu-stat-label">Occupied</div>
          <div className="mu-stat-value">{data.occupied_beds}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon green"><i className="bi bi-door-closed" /></div>
          <div className="mu-stat-label">Available</div>
          <div className="mu-stat-value">{data.available_beds}</div>
        </div>
      </div>

      <div className="mu-dashboard-grid-3" style={{ marginBottom: 20 }}>
        <div className="mu-card">
          <div className="mu-card-header"><h4>Occupancy by Hostel</h4></div>
          <div className="mu-card-body" style={{ height: 280 }}>
            {data.occupancy_by_hostel.length === 0
              ? <EmptyState icon="bi-pie-chart" label="No hostel data" />
              : <Doughnut data={occupancyDoughnut} options={{ responsive: true, maintainAspectRatio: false, cutout: "60%", plugins: { legend: { position: "bottom", labels: { usePointStyle: true, font: { size: 11 } } } } }} />}
          </div>
        </div>
        <div className="mu-card" style={{ gridColumn: "span 2" }}>
          <div className="mu-card-header"><h4>Bookings by Status</h4></div>
          <div className="mu-card-body" style={{ height: 280 }}>
            {statusEntries.length === 0
              ? <EmptyState icon="bi-bar-chart" label="No bookings yet" />
              : <Bar data={statusBar} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />}
          </div>
        </div>
      </div>

      <div className="mu-card">
        <div className="mu-card-header">
          <h4>Recent Bookings</h4>
          <span className="mu-badge mu-badge-primary">{data.recent_bookings.length}</span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {data.recent_bookings.length === 0 ? (
            <EmptyState icon="bi-inbox" label="No bookings yet" />
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead><tr><th>Student</th><th>Hostel / Room / Bed</th><th>Status</th><th>Booked</th></tr></thead>
                <tbody>
                  {data.recent_bookings.map((b) => (
                    <tr key={b.id}>
                      <td><strong>{b.student_detail?.registration_number}</strong><div style={{ fontSize: 12, color: "#777" }}>{fullName(b.student_detail?.user_detail)}</div></td>
                      <td>{b.bed_detail?.room_detail?.hostel_detail?.name || "—"} / {b.bed_detail?.room_detail?.room_number} / {b.bed_detail?.bed_number}</td>
                      <td><span className={`mu-badge mu-badge-${STATUS_BADGE[b.status] || "gray"}`}>{b.status}</span></td>
                      <td>{new Date(b.booked_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}