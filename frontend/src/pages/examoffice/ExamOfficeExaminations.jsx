import UnderDevelopment from "../UnderDevelopment";

export default function ExamOfficeExaminations() {
  return (
    <div className="mu-page">
      <h2>Examinations Schedule</h2>
      <UnderDevelopment
        plannedFeatures={[
          "Create and schedule CAT, final and supplementary exams",
          "Assign venues and time slots, avoiding clashes",
          "Publish/unpublish exam timetables to students",
          "Export exam schedules per programme or department",
        ]}
      />
    </div>
  );
}