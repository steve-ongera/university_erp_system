import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { hostelApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function HostelBooking() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [hostels, setHostels] = useState([]);
  const [selectedHostel, setSelectedHostel] = useState("");
  const [beds, setBeds] = useState([]);
  const [selectedBedId, setSelectedBedId] = useState("");
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadInitial = async () => {
    setLoading(true);
    setError("");
    try {
      const [statusRes, hostelsRes] = await Promise.all([
        hostelApi.status(),
        hostelApi.hostels(),
      ]);
      setStatus(statusRes.data);
      setHostels(Array.isArray(hostelsRes.data) ? hostelsRes.data : hostelsRes.data.results || []);
    } catch (err) {
      console.error("Error fetching hostel status:", err);
      setError("Failed to load hostel information.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitial();
  }, []);

  const loadBeds = async (hostelId) => {
    setSelectedHostel(hostelId);
    setSelectedBedId("");
    if (!hostelId) {
      setBeds([]);
      return;
    }
    try {
      const res = await hostelApi.beds({ room__hostel: hostelId });
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setBeds(data);
    } catch (err) {
      console.error("Error fetching beds:", err);
      setError("Failed to load available beds for this hostel.");
    }
  };

  const handleBook = async () => {
    if (!selectedBedId) {
      setError("Select a bed first.");
      return;
    }
    if (!status?.academic_year?.id) {
      setError("No active academic year found.");
      return;
    }
    setBooking(true);
    setError("");
    setSuccess("");
    try {
      await hostelApi.book({
        bed: selectedBedId,
        semester: status.semester?.id,
      });
      setSuccess("Hostel booking submitted successfully.");
      await loadInitial();
      setBeds([]);
      setSelectedHostel("");
      setSelectedBedId("");
    } catch (err) {
      console.error("Error booking bed:", err);
      setError(err.response?.data?.detail || "Failed to book bed.");
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading hostel information..." />;
  }

  return (
    <div>
      <div>
        <h1>Hostel Booking</h1>
        <div>Home / Accommodation / Hostel Booking</div>
      </div>

      {error && <div>{error}</div>}
      {success && <div>{success}</div>}

      <div>
        <div>Reported for current semester: {status?.has_reported ? "Yes" : "No"}</div>
      </div>

      {status?.booking ? (
        <div>
          <h4>Your Current Booking</h4>
          <div>Hostel: {status.booking.bed_detail?.room_detail?.hostel || "N/A"}</div>
          <div>Room: {status.booking.bed_detail?.room_detail?.room_number || "N/A"}</div>
          <div>Bed: {status.booking.bed_detail?.bed_number || "N/A"}</div>
          <div>Status: {status.booking.status}</div>
        </div>
      ) : (
        <div>
          <h4>Book a Bed</h4>
          {!status?.has_reported && (
            <div>You must report for the current semester before booking a hostel bed.</div>
          )}
          <div>
            <label>Hostel</label>
            <select value={selectedHostel} onChange={(e) => loadBeds(e.target.value)}>
              <option value="">Select a hostel</option>
              {hostels.map((hostel) => (
                <option key={hostel.id} value={hostel.id}>
                  {hostel.name} ({hostel.hostel_type})
                </option>
              ))}
            </select>
          </div>

          {selectedHostel && (
            <div>
              <label>Available Bed</label>
              <select value={selectedBedId} onChange={(e) => setSelectedBedId(e.target.value)}>
                <option value="">Select a bed</option>
                {beds.map((bed) => (
                  <option key={bed.id} value={bed.id}>
                    {bed.room_detail?.room_number} - {bed.bed_number}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button onClick={handleBook} disabled={booking || !status?.has_reported}>
            {booking ? "Booking..." : "Book Bed"}
          </button>
        </div>
      )}

      <div>
        <Link to="/reporting">Semester Reporting</Link>
        <Link to="/fees">View Fees</Link>
      </div>
    </div>
  );
}