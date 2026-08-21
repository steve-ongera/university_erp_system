"""
portal_api/management/commands/seed_data.py

Seeds the Muranga University Student Portal with ~3 years' worth of
realistic demo data:

  - 5 faculties, 10 departments, 2 grading schemes (with grade bands)
  - 10 bachelor programmes (3-6 courses per faculty catalog)
  - 3 academic years, 6 semesters, 3 intakes
  - Deans / HODs / lecturers / support staff
  - ~150 students spread across 3 admission cohorts (years 1-3), each
    with curriculum-aligned enrollments, historical transcript entries,
    fee invoices/payments/credit balances, hostel bookings and semester
    reporting records.

USAGE
-----
Place this file at:  portal_api/management/commands/seed_data.py
(Django requires empty __init__.py files in both
 portal_api/management/ and portal_api/management/commands/.)

    python manage.py seed_data              # idempotent, safe to re-run
    python manage.py seed_data --flush       # wipe previously seeded data first

Every seeded user gets the password below (they'll be forced to change
it on first login, since User.must_change_password defaults to True).
"""
import random
from datetime import date, time, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from portal_api.models import (
    User, Faculty, GradingScheme, GradeBand, Department, Programme, Course,
    CurriculumVersion, CurriculumUnit, AcademicYear, Semester, Intake,
    Lecturer, Staff, Student, LecturerUnitAllocation, UnitRegistration,
    Enrollment, Grade, TranscriptEntry, FeeStructure, Invoice,
    StudentFeeAccount, FeePayment, InvoiceAllocation, HelbBursaryAward,
    Hostel, Room, Bed, HostelBooking, StudentReporting, ClearanceRequest,
    Timetable, Examination, Notification,
)

DEMO_PASSWORD = "ChangeMe@2026"
STUDENTS_PER_COHORT = 5  # per programme, per admission cohort -> ~150 students total

FIRST_NAMES = [
    "Wanjiru", "Kamau", "Njoroge", "Achieng", "Otieno", "Wafula", "Cherono",
    "Mutiso", "Wambui", "Kiprono", "Nyambura", "Odhiambo", "Chebet", "Karanja",
    "Muthoni", "Barasa", "Akinyi", "Mwangi", "Wekesa", "Nafula", "Kiplagat",
    "Wairimu", "Omondi", "Naliaka", "Gitau", "Adhiambo", "Rotich", "Njeri",
    "Onyango", "Chepkoech",
]
LAST_NAMES = [
    "Kariuki", "Otieno", "Kiptoo", "Mwaura", "Njuguna", "Wanyama", "Kimani",
    "Owino", "Cheruiyot", "Maina", "Auma", "Langat", "Wafula", "Muriithi",
    "Korir", "Ochieng", "Gathoni", "Simiyu", "Waweru", "Chege",
]

FACULTY_DEFS = [
    ("Faculty of Computing & Information Technology", "SCIT"),
    ("Faculty of Business & Economics", "SBE"),
    ("Faculty of Engineering & Technology", "SET"),
    ("Faculty of Health Sciences", "SHS"),
    ("Faculty of Agriculture & Natural Resources", "SAN"),
]

# faculty_code -> [(dept_name, dept_code, grading_scheme_key, [
#     (programme_name, programme_code),
# ], [ (course_name, course_code, credit_hours), ... ])]
DEPARTMENT_DEFS = {
    "SCIT": [
        dict(name="Department of Information Technology", code="IT", scheme="standard",
             programme=("Bachelor of Science in Information Technology", "SC211"),
             courses=[
                 ("Introduction to Programming", "IT101", 3),
                 ("Data Structures and Algorithms", "IT201", 4),
                 ("Database Systems", "IT202", 3),
             ]),
        dict(name="Department of Computer Science", code="CS", scheme="standard",
             programme=("Bachelor of Science in Computer Science", "SC221"),
             courses=[
                 ("Discrete Mathematics", "CS101", 3),
                 ("Operating Systems", "CS201", 4),
                 ("Software Engineering", "CS301", 3),
             ]),
    ],
    "SBE": [
        dict(name="Department of Business Administration", code="BA", scheme="standard",
             programme=("Bachelor of Business Administration", "SB101"),
             courses=[
                 ("Principles of Management", "BA101", 3),
                 ("Financial Accounting", "BA102", 3),
                 ("Marketing Management", "BA201", 3),
             ]),
        dict(name="Department of Economics", code="ECON", scheme="standard",
             programme=("Bachelor of Economics", "SB102"),
             courses=[
                 ("Microeconomics", "EC101", 3),
                 ("Macroeconomics", "EC102", 3),
                 ("Statistics for Economists", "EC201", 3),
             ]),
    ],
    "SET": [
        dict(name="Department of Civil Engineering", code="CE", scheme="standard",
             programme=("Bachelor of Science in Civil Engineering", "SE301"),
             courses=[
                 ("Engineering Mechanics", "CE101", 4),
                 ("Structural Analysis", "CE201", 4),
                 ("Surveying", "CE202", 3),
             ]),
        dict(name="Department of Electrical & Electronic Engineering", code="EEE", scheme="standard",
             programme=("Bachelor of Science in Electrical & Electronic Engineering", "SE302"),
             courses=[
                 ("Circuit Theory", "EE101", 4),
                 ("Digital Electronics", "EE201", 3),
                 ("Power Systems", "EE301", 4),
             ]),
    ],
    "SHS": [
        dict(name="Department of Nursing", code="NUR", scheme="nursing",
             programme=("Bachelor of Science in Nursing", "SH401"),
             courses=[
                 ("Anatomy and Physiology", "NU101", 4),
                 ("Nursing Fundamentals", "NU102", 4),
                 ("Community Health Nursing", "NU201", 3),
             ]),
        dict(name="Department of Public Health", code="PH", scheme="nursing",
             programme=("Bachelor of Science in Public Health", "SH402"),
             courses=[
                 ("Epidemiology", "PH101", 3),
                 ("Environmental Health", "PH102", 3),
                 ("Biostatistics", "PH201", 3),
             ]),
    ],
    "SAN": [
        dict(name="Department of Agribusiness Management", code="AGB", scheme="standard",
             programme=("Bachelor of Science in Agribusiness Management", "SA501"),
             courses=[
                 ("Principles of Agribusiness", "AG101", 3),
                 ("Farm Management", "AG201", 3),
                 ("Agricultural Marketing", "AG202", 3),
             ]),
        dict(name="Department of Agricultural Extension", code="AGX", scheme="standard",
             programme=("Bachelor of Science in Agricultural Extension", "SA502"),
             courses=[
                 ("Crop Production", "AX101", 3),
                 ("Agricultural Extension Methods", "AX201", 3),
                 ("Livestock Production", "AX202", 3),
             ]),
    ],
}


def rand_name():
    return random.choice(FIRST_NAMES), random.choice(LAST_NAMES)


def rand_phone():
    return f"07{random.randint(10000000, 99999999)}"


class Command(BaseCommand):
    help = "Seed ~3 academic years of realistic demo data for the Muranga University portal."

    def add_arguments(self, parser):
        parser.add_argument("--flush", action="store_true",
                             help="Delete previously seeded data before reseeding.")

    def handle(self, *args, **options):
        random.seed(42)
        self._id_seq = 10_000_000  # for fake national IDs
        self._emp_seq = 1
        self._reg_seq = {}  # programme_code -> sequence counter

        if options["flush"]:
            self.flush_data()

        with transaction.atomic():
            self.stdout.write("Seeding grading schemes...")
            schemes = self.seed_grading_schemes()

            self.stdout.write("Seeding calendar (academic years / semesters / intakes)...")
            years, semesters, intakes = self.seed_calendar()

            self.stdout.write("Seeding faculties, departments, programmes, courses...")
            faculties, departments, programmes, courses_by_dept = self.seed_academic_structure(schemes)

            self.stdout.write("Seeding curriculum versions/units...")
            curricula = self.seed_curriculum(programmes, courses_by_dept, years)

            self.stdout.write("Seeding staff, lecturers, deans, HODs...")
            lecturers = self.seed_people(faculties, departments)

            self.stdout.write("Seeding fee structures...")
            fee_structures = self.seed_fee_structures(programmes, years)

            self.stdout.write("Seeding hostels...")
            hostels = self.seed_hostels(years)

            self.stdout.write("Seeding students (enrollments, grades, fees, hostels)...")
            self.seed_students(programmes, curricula, intakes, years, semesters,
                                lecturers, fee_structures, hostels)

        self.stdout.write(self.style.SUCCESS(
            f"Done. Demo login password for every seeded user: {DEMO_PASSWORD}"
        ))

    # ------------------------------------------------------------------
    # CLEANUP
    # ------------------------------------------------------------------
    def flush_data(self):
        self.stdout.write(self.style.WARNING("Flushing previously seeded data..."))
        models_in_delete_order = [
            InvoiceAllocation, FeePayment, Invoice, StudentFeeAccount, HelbBursaryAward,
            HostelBooking, Bed, Room, Hostel,
            ClearanceRequest, StudentReporting,
            TranscriptEntry, Grade, Enrollment, UnitRegistration,
            Examination, Timetable, LecturerUnitAllocation,
            Notification, Student, Lecturer, Staff,
            CurriculumUnit, CurriculumVersion, Course, Programme,
            GradeBand, GradingScheme, Department, Faculty,
            Intake, Semester, AcademicYear,
        ]
        for model in models_in_delete_order:
            model.objects.all().delete()
        User.objects.filter(is_superuser=False).delete()

    # ------------------------------------------------------------------
    # GRADING SCHEMES
    # ------------------------------------------------------------------
    def seed_grading_schemes(self):
        standard, _ = GradingScheme.objects.get_or_create(
            name="Standard University Scale",
            defaults=dict(description="Default 4.0-point scale used by most departments.",
                          pass_mark=Decimal("40.00"), supplementary_floor=Decimal("30.00")),
        )
        nursing, _ = GradingScheme.objects.get_or_create(
            name="Health Sciences / Nursing Council Scale",
            defaults=dict(description="Stricter scale used by Nursing & Public Health, "
                                       "matching Nursing Council of Kenya requirements.",
                          pass_mark=Decimal("50.00"), supplementary_floor=Decimal("40.00")),
        )

        band_defs = {
            standard: [
                ("A", "70.00", "100.00", "4.00", False, False),
                ("B", "60.00", "69.99", "3.00", False, False),
                ("C", "50.00", "59.99", "2.00", False, False),
                ("D", "40.00", "49.99", "1.00", False, False),
                ("E", "30.00", "39.99", "0.50", True, False),
                ("F", "0.00", "29.99", "0.00", False, True),
            ],
            nursing: [
                ("A", "75.00", "100.00", "4.00", False, False),
                ("B", "65.00", "74.99", "3.00", False, False),
                ("C", "50.00", "64.99", "2.00", False, False),
                ("D", "40.00", "49.99", "1.00", True, False),
                ("F", "0.00", "39.99", "0.00", False, True),
            ],
        }
        for scheme, bands in band_defs.items():
            for letter, lo, hi, pts, is_supp, is_fail in bands:
                GradeBand.objects.get_or_create(
                    scheme=scheme, letter=letter,
                    defaults=dict(min_score=Decimal(lo), max_score=Decimal(hi),
                                  points=Decimal(pts), is_supplementary_band=is_supp,
                                  is_fail_band=is_fail),
                )
        return {"standard": standard, "nursing": nursing}

    # ------------------------------------------------------------------
    # CALENDAR
    # ------------------------------------------------------------------
    def seed_calendar(self):
        base_year = 2023  # -> AYs 2023/2024, 2024/2025, 2025/2026 (3 academic years)
        years, semesters, intakes = [], {}, []

        for i, y in enumerate(range(base_year, base_year + 3)):
            is_current_year = (i == 2)
            ay, _ = AcademicYear.objects.get_or_create(
                year=f"{y}/{y + 1}",
                defaults=dict(start_date=date(y, 9, 1), end_date=date(y + 1, 8, 31),
                              is_current=is_current_year),
            )
            years.append(ay)

            sem1, _ = Semester.objects.get_or_create(
                academic_year=ay, semester_number=1,
                defaults=dict(start_date=date(y, 9, 1), end_date=date(y, 12, 20),
                              registration_start_date=date(y, 8, 20),
                              registration_end_date=date(y, 9, 10),
                              is_current=False),
            )
            sem2, _ = Semester.objects.get_or_create(
                academic_year=ay, semester_number=2,
                defaults=dict(start_date=date(y + 1, 1, 6), end_date=date(y + 1, 4, 25),
                              registration_start_date=date(y + 1, 1, 2),
                              registration_end_date=date(y + 1, 1, 17),
                              is_current=is_current_year),
            )
            semesters[i] = [sem1, sem2]

            intake, _ = Intake.objects.get_or_create(
                name=f"September {y}",
                defaults=dict(academic_year=ay, starting_semester=sem1,
                              application_deadline=date(y, 8, 15), is_active=True),
            )
            intakes.append(intake)

        return years, semesters, intakes

    # ------------------------------------------------------------------
    # FACULTIES / DEPARTMENTS / PROGRAMMES / COURSES
    # ------------------------------------------------------------------
    def seed_academic_structure(self, schemes):
        faculties, departments, programmes = {}, {}, {}
        courses_by_dept = {}

        for name, code in FACULTY_DEFS:
            faculty, _ = Faculty.objects.get_or_create(code=code, defaults=dict(name=name))
            faculties[code] = faculty

            for dept_def in DEPARTMENT_DEFS[code]:
                dept, _ = Department.objects.get_or_create(
                    code=dept_def["code"],
                    defaults=dict(name=dept_def["name"], faculty=faculty,
                                  grading_scheme=schemes[dept_def["scheme"]]),
                )
                departments[dept_def["code"]] = dept

                prog_name, prog_code = dept_def["programme"]
                programme, _ = Programme.objects.get_or_create(
                    code=prog_code,
                    defaults=dict(name=prog_name, programme_type=Programme.ProgrammeType.BACHELOR,
                                  department=dept, faculty=faculty, duration_years=4,
                                  semesters_per_year=2, credit_hours_required=120),
                )
                programmes[prog_code] = programme

                dept_courses = []
                for cname, ccode, credits in dept_def["courses"]:
                    course, _ = Course.objects.get_or_create(
                        code=ccode,
                        defaults=dict(name=cname, course_type=Course.CourseType.CORE,
                                      credit_hours=credits, department=dept),
                    )
                    dept_courses.append(course)
                courses_by_dept[dept_def["code"]] = dept_courses

        return faculties, departments, programmes, courses_by_dept

    # ------------------------------------------------------------------
    # CURRICULUM
    # ------------------------------------------------------------------
    def seed_curriculum(self, programmes, courses_by_dept, years):
        """
        NOTE (demo simplification): each department's catalog only has
        3 courses, so we cycle through them across the programme's 8
        year/semester slots. In a real curriculum you would have a
        distinct course per slot; here the same course can legitimately
        recur at different (year, semester) positions purely to keep the
        demo dataset small (per the '3-7 courses per faculty' brief).
        """
        curricula = {}  # (programme_code, ay_index) -> CurriculumVersion

        for dept_def_list in DEPARTMENT_DEFS.values():
            for dept_def in dept_def_list:
                prog_code = dept_def["programme"][1]
                programme = programmes[prog_code]
                dept_courses = courses_by_dept[dept_def["code"]]

                for ay_index, ay in enumerate(years):
                    version, _ = CurriculumVersion.objects.get_or_create(
                        programme=programme, effective_academic_year=ay,
                        defaults=dict(is_active=(ay_index == len(years) - 1),
                                      notes=f"Curriculum snapshot effective {ay.year}."),
                    )
                    curricula[(prog_code, ay_index)] = version

                    idx = 0
                    for y in range(1, programme.duration_years + 1):
                        for s in range(1, programme.semesters_per_year + 1):
                            course = dept_courses[idx % len(dept_courses)]
                            idx += 1
                            CurriculumUnit.objects.get_or_create(
                                curriculum_version=version, course=course, year=y, semester=s,
                                defaults=dict(is_mandatory=True),
                            )
        return curricula

    # ------------------------------------------------------------------
    # PEOPLE: deans / HODs / lecturers / staff
    # ------------------------------------------------------------------
    def seed_people(self, faculties, departments):
        lecturers_by_dept = {}

        # Deans (one per faculty)
        for code, faculty in faculties.items():
            if faculty.dean_id:
                continue
            first, last = rand_name()
            user = self._make_user(f"DEAN{code}", first, last, User.UserType.DEAN)
            faculty.dean = user
            faculty.save(update_fields=["dean"])

        # 2 lecturers per department, first one promoted to HOD (user_type=COD)
        for dept_code, dept in departments.items():
            lecturers_by_dept[dept_code] = []
            for i in range(2):
                first, last = rand_name()
                is_hod = (i == 0 and dept.head_of_department_id is None)
                user_type = User.UserType.COD if is_hod else User.UserType.LECTURER
                user = self._make_user(f"LEC{dept_code}{i}", first, last, user_type)
                lecturer, _ = Lecturer.objects.get_or_create(
                    user=user,
                    defaults=dict(employee_number=self._next_employee_number("LEC"),
                                  department=dept,
                                  academic_rank=random.choice(
                                      ["Lecturer", "Senior Lecturer", "Assistant Lecturer"]),
                                  joining_date=date(2023, random.randint(1, 9), random.randint(1, 28))),
                )
                lecturers_by_dept[dept_code].append(lecturer)
                if is_hod:
                    dept.head_of_department = user
                    dept.save(update_fields=["head_of_department"])

        # A handful of general staff (registrar's office, finance, exams)
        staff_roles = [
            ("REGISTRAR", User.UserType.REGISTRAR, "Registrar's Office"),
            ("FINANCE", User.UserType.FINANCE, "Finance Office"),
            ("EXAMS", User.UserType.EXAM_OFFICE, "Examinations Office"),
        ]
        for prefix, user_type, designation in staff_roles:
            first, last = rand_name()
            user = self._make_user(prefix, first, last, user_type)
            Staff.objects.get_or_create(
                user=user,
                defaults=dict(employee_number=self._next_employee_number("STF"),
                              department=None, designation=designation),
            )

        return lecturers_by_dept

    # ------------------------------------------------------------------
    # FEE STRUCTURES
    # ------------------------------------------------------------------
    def seed_fee_structures(self, programmes, years):
        fee_structures = {}
        for prog_code, programme in programmes.items():
            base_tuition = Decimal(random.choice(["45000.00", "48000.00", "52000.00", "55000.00"]))
            for ay_index, ay in enumerate(years):
                for y in range(1, programme.duration_years + 1):
                    for s in range(1, programme.semesters_per_year + 1):
                        fs, _ = FeeStructure.objects.get_or_create(
                            programme=programme, academic_year=ay, year=y, semester=s,
                            defaults=dict(
                                tuition_fee=base_tuition + Decimal(y * 1000),
                                other_fees=Decimal("8500.00"),
                                government_subsidy=(Decimal("15000.00")
                                                     if programme.department.faculty.code != "SBE"
                                                     else Decimal("0.00")),
                            ),
                        )
                        fee_structures[(prog_code, ay_index, y, s)] = fs
        return fee_structures

    # ------------------------------------------------------------------
    # HOSTELS
    # ------------------------------------------------------------------
    def seed_hostels(self, years):
        hostel_defs = [
            ("Ridgeways Hall", Hostel.HostelType.BOYS),
            ("Sunrise Hall", Hostel.HostelType.GIRLS),
            ("Unity Hall", Hostel.HostelType.MIXED),
        ]
        hostels = []
        current_ay = years[-1]
        for name, htype in hostel_defs:
            hostel, _ = Hostel.objects.get_or_create(name=name, defaults=dict(hostel_type=htype))
            hostels.append(hostel)
            for floor in range(1, 3):
                for room_no in range(1, 6):
                    room, _ = Room.objects.get_or_create(
                        hostel=hostel, room_number=f"{floor}{room_no:02d}",
                        defaults=dict(capacity=4),
                    )
                    for bed_letter in "ABCD":
                        Bed.objects.get_or_create(
                            room=room, academic_year=current_ay, bed_number=bed_letter,
                            defaults=dict(is_available=True),
                        )
        return hostels

    # ------------------------------------------------------------------
    # STUDENTS (the big one)
    # ------------------------------------------------------------------
    def seed_students(self, programmes, curricula, intakes, years, semesters,
                       lecturers_by_dept, fee_structures, hostels):
        # cohort_offset: how many AYs ago the cohort was admitted (0 = this year's freshers)
        # -> current_year in programme, current_semester (we treat "now" as semester 2
        #    of the newest academic year, i.e. mid-way through year N of study)
        cohorts = [
            dict(ay_index=0, current_year=3, current_semester=2),  # admitted 2 AYs ago
            dict(ay_index=1, current_year=2, current_semester=2),  # admitted 1 AY ago
            dict(ay_index=2, current_year=1, current_semester=2),  # admitted this AY
        ]

        for prog_code, programme in programmes.items():
            dept = programme.department
            dept_code = dept.code
            dept_lecturers = lecturers_by_dept[dept_code]

            for cohort in cohorts:
                ay_index = cohort["ay_index"]
                intake = intakes[ay_index]
                curriculum_version = curricula[(prog_code, ay_index)]
                current_year = cohort["current_year"]
                current_semester = cohort["current_semester"]

                for _ in range(STUDENTS_PER_COHORT):
                    student = self._create_student(
                        programme, curriculum_version, intake, current_year, current_semester,
                    )
                    self._enroll_current_semester(
                        student, programme, curriculum_version, years, semesters,
                        ay_index, current_year, current_semester, dept_lecturers,
                    )
                    self._backfill_transcript(
                        student, programme, curriculum_version, years,
                        ay_index, current_year, current_semester,
                    )
                    self._seed_fees_for_student(
                        student, programme, fee_structures, years, semesters,
                        ay_index, current_year, current_semester,
                    )
                    self._seed_reporting_and_clearance(student, semesters, ay_index, current_semester)
                    if current_year == 1 and random.random() < 0.6:
                        self._book_hostel(student, hostels, years[-1])

    # -- student-level helpers -----------------------------------------

    def _create_student(self, programme, curriculum_version, intake, current_year, current_semester):
        first, last = rand_name()
        intake_year = int(intake.academic_year.year.split("/")[0])
        reg_number = self._next_registration_number(programme.code, intake_year)
        user = self._make_user(reg_number.replace("/", "_"), first, last, User.UserType.STUDENT,
                                username_override=reg_number)
        student, created = Student.objects.get_or_create(
            registration_number=reg_number,
            defaults=dict(
                user=user, programme=programme, curriculum_version=curriculum_version,
                intake=intake, current_year=current_year, current_semester=current_semester,
                status=Student.Status.ACTIVE,
                sponsor_type=random.choice([Student.SponsorType.GOVERNMENT, Student.SponsorType.SELF,
                                             Student.SponsorType.BURSARY]),
                admission_date=intake.academic_year.start_date,
                expected_graduation_date=date(
                    intake.academic_year.start_date.year + programme.duration_years, 8, 31),
                guardian_name=f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}",
                guardian_phone=rand_phone(),
                emergency_contact=rand_phone(),
            ),
        )
        StudentFeeAccount.objects.get_or_create(student=student, defaults=dict(credit_balance=0))

        if student.sponsor_type == Student.SponsorType.GOVERNMENT:
            HelbBursaryAward.objects.get_or_create(
                student=student, academic_year=intake.academic_year, source=HelbBursaryAward.Source.HELB,
                defaults=dict(amount_awarded=Decimal("35000.00"),
                              reference_number=f"HELB-{reg_number.replace('/', '')}",
                              disbursed=True, disbursed_date=intake.academic_year.start_date),
            )
        return student

    def _enroll_current_semester(self, student, programme, curriculum_version, years, semesters,
                                  ay_index, current_year, current_semester, dept_lecturers):
        semester_obj = semesters[ay_index][current_semester - 1]
        units = CurriculumUnit.objects.filter(
            curriculum_version=curriculum_version, year=current_year, semester=current_semester,
        )
        for unit in units:
            lecturer = random.choice(dept_lecturers)
            allocation, _ = LecturerUnitAllocation.objects.get_or_create(
                lecturer=lecturer, course=unit.course, semester=semester_obj, programme=programme,
                year=current_year, programme_semester=current_semester,
                defaults=dict(is_active=True),
            )
            registration, _ = UnitRegistration.objects.get_or_create(
                student=student, course=unit.course, semester=semester_obj,
                defaults=dict(registration_type=UnitRegistration.RegType.NORMAL, is_active=True),
            )
            Enrollment.objects.get_or_create(
                student=student, course=unit.course, semester=semester_obj,
                defaults=dict(lecturer_allocation=allocation, registration=registration, is_active=True),
            )

    def _backfill_transcript(self, student, programme, curriculum_version, years,
                              ay_index, current_year, current_semester):
        """Populate historical (already-completed) semesters as TranscriptEntry rows."""
        scheme = programme.department.grading_scheme
        completed_slots = []
        for y in range(1, current_year + 1):
            for s in range(1, programme.semesters_per_year + 1):
                if y == current_year and s >= current_semester:
                    continue  # current/future semester -> not completed yet
                completed_slots.append((y, s))

        total_points = Decimal("0.00")
        total_credits = 0
        for y, s in completed_slots:
            units = CurriculumUnit.objects.filter(curriculum_version=curriculum_version, year=y, semester=s)
            for unit in units:
                marks = self._random_marks(scheme)
                band = self._band_for_marks(scheme, marks)
                quality_points = band.points * unit.course.credit_hours
                TranscriptEntry.objects.get_or_create(
                    student=student, course=unit.course, academic_year=years[ay_index],
                    semester_number=s, programme_year=y,
                    defaults=dict(letter_grade=band.letter, grade_points=band.points,
                                  credit_hours=unit.course.credit_hours,
                                  quality_points=quality_points, is_supplementary=False, version=1),
                )
                total_points += quality_points
                total_credits += unit.course.credit_hours

        if total_credits:
            student.total_credit_hours_earned = total_credits
            student.cumulative_gpa = (total_points / total_credits).quantize(Decimal("0.01"))
            student.save(update_fields=["total_credit_hours_earned", "cumulative_gpa"])

    def _seed_fees_for_student(self, student, programme, fee_structures, years, semesters,
                                ay_index, current_year, current_semester):
        """Raise an invoice for every semester attended so far (incl. current), then pay most of them."""
        credit_balance = Decimal("0.00")
        for y in range(1, current_year + 1):
            for s in range(1, programme.semesters_per_year + 1):
                if y == current_year and s > current_semester:
                    continue
                fs = fee_structures.get((programme.code, ay_index, y, s))
                if not fs:
                    continue
                semester_obj = semesters[ay_index][s - 1]
                invoice, _ = Invoice.objects.get_or_create(
                    student=student, invoice_type=Invoice.InvoiceType.SEMESTER_FEE,
                    fee_structure=fs, semester=semester_obj,
                    defaults=dict(amount_due=fs.net_fee(),
                                  description=f"{programme.code} Y{y}S{s} tuition"),
                )

                # Simulate a bank/mpesa/helb payment: usually full, sometimes partial, sometimes overpaid.
                roll = random.random()
                if roll < 0.65:
                    amount = invoice.amount_due
                elif roll < 0.90:
                    amount = (invoice.amount_due * Decimal("0.6")).quantize(Decimal("1.00"))
                else:
                    amount = (invoice.amount_due + Decimal("2000.00"))

                if amount <= 0:
                    continue
                bank_ref = f"REF{student.registration_number.replace('/', '')}{y}{s}"
                payment, created = FeePayment.objects.get_or_create(
                    bank_reference=bank_ref,
                    defaults=dict(
                        student=student, bank_name=random.choice(["Equity Bank", "KCB", "Co-op Bank"]),
                        method=random.choice([FeePayment.Method.BANK, FeePayment.Method.MPESA,
                                               FeePayment.Method.HELB]),
                        amount=amount, payer_name_on_slip=student.user.get_full_name(),
                        registration_number_on_slip=student.registration_number,
                        receipt_number=f"RCT{bank_ref}",
                        payment_date=timezone.make_aware(
                            timezone.datetime.combine(fs.academic_year.start_date, time(9, 0))),
                        is_reconciled=True,
                    ),
                )
                if created:
                    applied = min(amount, invoice.amount_due)
                    InvoiceAllocation.objects.get_or_create(
                        payment=payment, invoice=invoice, defaults=dict(amount_applied=applied),
                    )
                    if amount > invoice.amount_due:
                        credit_balance += (amount - invoice.amount_due)

        if credit_balance:
            account = student.fee_account
            account.credit_balance = credit_balance
            account.save(update_fields=["credit_balance"])

    def _seed_reporting_and_clearance(self, student, semesters, ay_index, current_semester):
        semester_obj = semesters[ay_index][current_semester - 1]
        StudentReporting.objects.get_or_create(
            student=student, semester=semester_obj,
            defaults=dict(reporting_type=random.choice(["online", "physical"]),
                          status=StudentReporting.Status.APPROVED if random.random() < 0.9
                          else StudentReporting.Status.PENDING),
        )
        # Only final-year, final-semester students open graduation clearance.
        programme = student.programme
        is_final = (student.current_year == programme.duration_years and
                    student.current_semester == programme.semesters_per_year)
        if is_final:
            for ctype in [ClearanceRequest.ClearanceType.LIBRARY, ClearanceRequest.ClearanceType.FINANCE,
                          ClearanceRequest.ClearanceType.DEPARTMENT, ClearanceRequest.ClearanceType.GRADUATION]:
                ClearanceRequest.objects.get_or_create(
                    student=student, clearance_type=ctype,
                    defaults=dict(status=ClearanceRequest.Status.PENDING),
                )

    def _book_hostel(self, student, hostels, current_ay):
        hostel = random.choice(hostels)
        available_bed = Bed.objects.filter(room__hostel=hostel, academic_year=current_ay,
                                            is_available=True).first()
        if not available_bed:
            return
        HostelBooking.objects.get_or_create(
            student=student, academic_year=current_ay,
            defaults=dict(bed=available_bed, status=HostelBooking.Status.APPROVED,
                          booking_fee=Decimal("3000.00")),
        )
        available_bed.is_available = False
        available_bed.save(update_fields=["is_available"])

    # ------------------------------------------------------------------
    # SMALL UTILITIES
    # ------------------------------------------------------------------
    def _make_user(self, prefix, first, last, user_type, username_override=None):
        username = username_override or f"{prefix}{random.randint(100, 999)}"
        user, created = User.objects.get_or_create(
            username=username,
            defaults=dict(
                first_name=first, last_name=last,
                email=f"{username.lower().replace('/', '.')}@muranga.ac.ke",
                user_type=user_type, phone=rand_phone(), gender=random.choice(
                    [User.Gender.MALE, User.Gender.FEMALE]),
                date_of_birth=date(random.randint(1985, 2007), random.randint(1, 12), random.randint(1, 28)),
                national_id=str(self._next_national_id()),
                must_change_password=True,
            ),
        )
        if created:
            user.set_password(DEMO_PASSWORD)
            user.save(update_fields=["password"])
        return user

    def _next_national_id(self):
        self._id_seq += 1
        return self._id_seq

    def _next_employee_number(self, prefix):
        number = f"{prefix}{self._emp_seq:04d}"
        self._emp_seq += 1
        return number

    def _next_registration_number(self, programme_code, intake_year):
        key = (programme_code, intake_year)
        seq = self._reg_seq.get(key, 0) + 1
        self._reg_seq[key] = seq
        return f"{programme_code}/{seq:04d}/{intake_year}"

    def _random_marks(self, scheme):
        r = random.random()
        if r < 0.80:
            marks = round(random.uniform(float(scheme.pass_mark), 95), 2)
        elif r < 0.93:
            marks = round(random.uniform(float(scheme.supplementary_floor),
                                          float(scheme.pass_mark) - 0.01), 2)
        else:
            marks = round(random.uniform(5, float(scheme.supplementary_floor) - 0.01), 2)
        return Decimal(str(marks))

    def _band_for_marks(self, scheme, marks):
        band = scheme.bands.filter(min_score__lte=marks, max_score__gte=marks).first()
        return band or scheme.bands.order_by("min_score").first()