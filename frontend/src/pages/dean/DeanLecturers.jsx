import UnderDevelopment from "../UnderDevelopment";

export default function DeanLecturers() {
  return (
    <div className="mu-page">
      <h2>Faculty Lecturers</h2>
      <UnderDevelopment
        plannedFeatures={[
          "View all lecturers across your faculty's departments",
          "See current unit allocations per lecturer",
          "Track grading/enrollment completion by lecturer",
          "Filter by department or academic rank",
        ]}
      />
    </div>
  );
}