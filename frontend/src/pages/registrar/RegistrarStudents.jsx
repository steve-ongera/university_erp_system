import UnderDevelopment from "../UnderDevelopment";

export default function RegistrarStudents() {
  return (
    <div className="mu-page">
      <h2>Student Records</h2>
      <UnderDevelopment
        plannedFeatures={[
          "Search and filter student records across all programmes",
          "Registration number issuance and corrections",
          "Bulk year/semester promotion overrides",
          "Transfer students between programmes",
        ]}
      />
    </div>
  );
}