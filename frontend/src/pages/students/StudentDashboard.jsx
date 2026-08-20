import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { studentsApi } from "../../services/api";
import UnderDevelopment from "../../components/UnderDevelopment";

export default function StudentDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    // Fetch student dashboard data
    const fetchDashboard = async () => {
      try {
        // const { data } = await studentsApi.myProfile();
        // setStats(data);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching dashboard:", error);
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="mu-loader">
        <i className="bi bi-arrow-repeat mu-animate-spin" />
        <span>Loading dashboard...</span>
      </div>
    );
  }

  return <UnderDevelopment 
    title="Student Dashboard" 
    description="Your personalized dashboard is being built. Soon you'll see your academic summary, upcoming deadlines, and important notifications here."
    icon="bi-speedometer2"
    estimatedRelease="Coming Soon"
  />;
}