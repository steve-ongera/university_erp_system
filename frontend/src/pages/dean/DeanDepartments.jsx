import UnderDevelopment from "../UnderDevelopment";

export default function DeanDepartments() {
  return (
    <div className="mu-page">
      <h2>Faculty Departments</h2>
      <UnderDevelopment
        plannedFeatures={[
          "View all departments within your faculty",
          "Department-level student and programme counts",
          "Recommend a Head of Department to admin",
          "Drill into a department's COD summary",
        ]}
      />
    </div>
  );
}