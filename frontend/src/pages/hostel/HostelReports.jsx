import { useEffect, useState, useCallback } from "react";
import { hostelWardenApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const STATUS_COLORS = {
  pending: "#c97d2a",
  pending_payment: "#c23b3b",
  approved: "#1a8a5a",
  checked_in: "#2f6fed",
  checked_out: "#7c3aed",
  cancelled: "#6b7280",
};
const DEFAULT_COLORS = ["#3b6ce0", "#1a8a5a", "#c97d2a", "#7c3aed", "#c23b3b", "#2f6fed"];

const fmtKes = (n) => `KES ${Number(n || 0).toLocaleString()}`;

function StatCard({ icon, color, label, value }) {
  return (
    <div className="mu-stat-card">
      <div className={`mu-stat-icon ${color}`}>
        <i className={`bi ${icon}`} />
      </div>
      <div className="mu-stat-label">{label}</div>
      <div className="mu-stat-value">{value}</div>
    </div>
  );
}

export default function HostelReports() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [academicYearId, setAcademicYearId] = useState("");

  const load = useCallback(async (ayId) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await hostelWardenApi.reports(ayId || undefined);
      setData(data);
      if (!ayId && data.academic_year) setAcademicYearId(String(data.academic_year.id));
    } catch (err) {
      console.error("Error loading hostel reports:", err);
      setError("Failed to load hostel reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleYearChange = (e) => {
    const value = e.target.value;
    setAcademicYearId(value);
    load(value);
  };

  if (loading && !data) return <LoadingSpinner text="Loading hostel reports..." />;

  const stats = data?.stats || {};
  const occupancy = data?.occupancy_by_hostel || [];
  const bookingsByStatus = data?.bookings_by_status || [];
  const collectionsTrend = data?.collections_trend || [];
  const bookingTrend = data?.booking_trend || [];

  return (
    <div>
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-bar-chart" />
            Hostel Reports
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Hostel <span className="separator">/</span> Reports
          </div>
        </div>
        <div className="mu-form-group" style={{ minWidth: 220, marginBottom: 0 }}>
          <select className="mu-select" value={academicYearId} onChange={handleYearChange}>
            {(data?.academic_years || []).map((y) => (
              <option key={y.id} value={y.id}>{y.year}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}

      {/* 5 stat cards */}
      <div className="mu-dashboard-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        <StatCard icon="bi-grid-3x3-gap" color="blue" label="Total Beds" value={stats.total_beds ?? 0} />
        <StatCard icon="bi-lock-fill" color="gold" label="Occupied Beds" value={stats.occupied_beds ?? 0} />
        <StatCard icon="bi-door-open" color="green" label="Available Beds" value={stats.available_beds ?? 0} />
        <StatCard icon="bi-people" color="blue" label="Total Bookings" value={stats.total_bookings ?? 0} />
        <StatCard icon="bi-cash-coin" color="green" label="Fees Collected" value={fmtKes(stats.fees_collected)} />
      </div>

      {stats.fees_outstanding > 0 && (
        <div className="mu-alert mu-alert-warning" style={{ marginTop: -8, marginBottom: 20 }}>
          <i className="bi bi-exclamation-circle" />
          {fmtKes(stats.fees_outstanding)} in hostel fees is still outstanding for this academic year.
        </div>
      )}

      {/* Charts */}
      <div className="mu-dashboard-grid-2" style={{ gap: 20 }}>
        {/* Line chart: fee collections trend */}
        <div className="mu-card">
          <div className="mu-card-header"><h4><i className="bi bi-graph-up" /> Fee Collections Trend</h4></div>
          <div className="mu-card-body" style={{ height: 300 }}>
            {collectionsTrend.length === 0 ? (
              <EmptyChart text="No hostel fee payments recorded yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={collectionsTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--mu-gray-100)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => fmtKes(v)} />
                  <Line type="monotone" dataKey="total" name="Collected" stroke="#1a8a5a" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Bar chart: occupancy by hostel */}
        <div className="mu-card">
          <div className="mu-card-header"><h4><i className="bi bi-bar-chart-line" /> Occupancy by Hostel</h4></div>
          <div className="mu-card-body" style={{ height: 300 }}>
            {occupancy.length === 0 ? (
              <EmptyChart text="No beds provisioned for this academic year yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={occupancy}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--mu-gray-100)" />
                  <XAxis dataKey="hostel" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="occupied" name="Occupied" fill="#c23b3b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="available" name="Available" fill="#1a8a5a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Donut chart: bookings by status */}
        <div className="mu-card">
          <div className="mu-card-header"><h4><i className="bi bi-pie-chart" /> Bookings by Status</h4></div>
          <div className="mu-card-body" style={{ height: 300 }}>
            {bookingsByStatus.length === 0 ? (
              <EmptyChart text="No bookings recorded for this academic year yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={bookingsByStatus}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={2}
                  >
                    {bookingsByStatus.map((entry, i) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || DEFAULT_COLORS[i % DEFAULT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Line chart: booking volume trend */}
        <div className="mu-card">
          <div className="mu-card-header"><h4><i className="bi bi-graph-up-arrow" /> Booking Volume Trend</h4></div>
          <div className="mu-card-body" style={{ height: 300 }}>
            {bookingTrend.length === 0 ? (
              <EmptyChart text="No booking activity yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bookingTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--mu-gray-100)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name="Bookings" stroke="#2f6fed" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyChart({ text }) {
  return (
    <div style={{
      height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
      color: "var(--mu-gray-400)", fontSize: "var(--mu-font-size-sm)", textAlign: "center",
    }}>
      <div>
        <i className="bi bi-bar-chart" style={{ fontSize: 28, display: "block", marginBottom: 6 }} />
        {text}
      </div>
    </div>
  );
}