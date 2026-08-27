import UnderDevelopment from "../UnderDevelopment";

export default function RegistrarDeferments() {
  return (
    <div className="mu-page">
      <h2>Deferment Requests</h2>
      <UnderDevelopment
        plannedFeatures={[
          "Review pending deferment applications",
          "Approve or reject with remarks",
          "Resume deferred students at their original year/semester",
          "View deferment history per student",
        ]}
      />
    </div>
  );
}