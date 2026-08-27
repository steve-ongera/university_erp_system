import UnderDevelopment from "../UnderDevelopment";

export default function ExamOfficeGradeVerification() {
  return (
    <div className="mu-page">
      <h2>Grade Verification</h2>
      <UnderDevelopment
        plannedFeatures={[
          "Institution-wide queue of entered-but-unverified grades",
          "Cross-check against department COD verifications",
          "Flag anomalies (marks outside expected range, missing exam dates)",
          "Bulk-approve verified grade batches for transcript publishing",
        ]}
      />
    </div>
  );
}