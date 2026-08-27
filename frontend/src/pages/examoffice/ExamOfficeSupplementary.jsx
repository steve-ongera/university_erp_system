import UnderDevelopment from "../UnderDevelopment";

export default function ExamOfficeSupplementary() {
  return (
    <div className="mu-page">
      <h2>Supplementary Examinations</h2>
      <UnderDevelopment
        plannedFeatures={[
          "View all outstanding supplementary unit registrations",
          "Track supplementary invoice payment status before exam clearance",
          "Schedule supplementary sittings alongside normal offerings",
          "Publish supplementary results once graded",
        ]}
      />
    </div>
  );
}