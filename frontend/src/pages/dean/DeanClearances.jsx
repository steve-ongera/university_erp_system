import UnderDevelopment from "../UnderDevelopment";

export default function DeanClearances() {
  return (
    <div className="mu-page">
      <h2>Faculty Clearances</h2>
      <UnderDevelopment
        plannedFeatures={[
          "Review graduation clearances for students in your faculty",
          "Faculty-level sign-off before registrar's final approval",
          "Flag requests requiring departmental action",
        ]}
      />
    </div>
  );
}