import UnderDevelopment from "../UnderDevelopment";

export default function RegistrarClearances() {
  return (
    <div className="mu-page">
      <h2>Graduation Clearances</h2>
      <UnderDevelopment
        plannedFeatures={[
          "Review final-year clearance requests",
          "Cross-check department, library, finance and hostel sign-offs",
          "Approve or flag clearance as requiring action",
          "Generate clearance certificates",
        ]}
      />
    </div>
  );
}