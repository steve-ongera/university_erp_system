import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { timetableApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export default function Timetable() {
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState([]);
  const [semester, setSemester] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await timetableApi.mine();
        setSemester(res.data.semester);
        setSlots(Array.isArray(res.data.slots) ? res.data.slots : []);
      } catch (err) {
        console.error("Error fetching timetable:", err);
        setError("Failed to load your timetable.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const groupByDay = () => {
    const groups = {};
    slots.forEach((slot) => {
      const day = (slot.day_of_week || "unknown").toLowerCase();
      if (!groups[day]) groups[day] = [];
      groups[day].push(slot);
    });
    Object.keys(groups).forEach((day) => {
      groups[day].sort((a, b) => (a.start_time > b.start_time ? 1 : -1));
    });
    return groups;
  };

  const dayGroups = groupByDay();
  const orderedDays = [
    ...DAY_ORDER.filter((d) => dayGroups[d]),
    ...Object.keys(dayGroups).filter((d) => !DAY_ORDER.includes(d)),
  ];

  if (loading) {
    return <LoadingSpinner text="Loading your timetable..." />;
  }

  return (
    <div>
      <div>
        <h1>Class Timetable</h1>
        <div>Home / Academics / Timetable</div>
      </div>

      {error && <div>{error}</div>}

      {semester && (
        <div>
          Current Semester: {semester.academic_year_detail?.year || "N/A"} - Semester{" "}
          {semester.semester_number}
        </div>
      )}

      {orderedDays.length > 0 ? (
        orderedDays.map((day) => (
          <div key={day}>
            <h4>{day.charAt(0).toUpperCase() + day.slice(1)}</h4>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Course Code</th>
                  <th>Course Name</th>
                  <th>Lecturer</th>
                  <th>Venue</th>
                </tr>
              </thead>
              <tbody>
                {dayGroups[day].map((slot) => (
                  <tr key={slot.id}>
                    <td>
                      {slot.start_time} - {slot.end_time}
                    </td>
                    <td>{slot.course_detail?.code || "N/A"}</td>
                    <td>{slot.course_detail?.name || "Unknown"}</td>
                    <td>
                      {slot.lecturer_detail?.user_detail?.first_name || ""}{" "}
                      {slot.lecturer_detail?.user_detail?.last_name || ""}
                    </td>
                    <td>{slot.venue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      ) : (
        <p>No timetable slots found for your programme/year/semester yet.</p>
      )}

      <div>
        <Link to="/units">My Units</Link>
      </div>
    </div>
  );
}