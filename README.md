# University ERP / Student Portal

A full university ERP: students, lecturers, staff, marks, fees, units,
programmes, academic years/semesters/intakes, hostels, clearance,
deferment, and role-based 2FA auth. Backend: Django + DRF. Frontend: React
(Vite) + Bootstrap Icons.

## Project structure

```
muranga_portal/
├── README.md
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── config/                          # Django project (settings/urls/wsgi)
│   │   ├── __init__.py
│   │   ├── settings.py                  # DEBUG also toggles 2FA bypass — see AuthService
│   │   ├── urls.py                      # mounts /api/v1/ -> portal_api.urls
│   │   ├── wsgi.py
│   │   └── asgi.py
│   └── portal_api/                      # the single "general api" app
│       ├── __init__.py
│       ├── apps.py
│       ├── admin.py
│       ├── models.py                    # all domain models (see below)
│       ├── serializers.py
│       ├── services.py                  # business logic: fees, grading, promotion,
│       │                                 # deferment, hostel, clearance, auth/2FA
│       ├── utils.py                     # reg-number/employee-number generators, OTP,
│       │                                 # receipt numbers, name matching, semester math
│       ├── views.py                     # DRF viewsets + custom action endpoints
│       ├── urls.py                      # DRF router + custom paths
│       ├── migrations/
│       └── management/
│           └── commands/
│               └── run_promotion.py     # `python manage.py run_promotion`
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── .env.example
    └── src/
        ├── main.jsx
        ├── App.jsx                      # routing + role-based route guards (all roles)
        ├── style/
        │   └── main.css                 # design tokens + all component styles
        ├── services/
        │   └── api.js                   # axios client, JWT refresh, domain API wrappers
        ├── context/
        │   └── AuthContext.jsx          # user/session state, hasRole(), ROLES map
        ├── components/
        │   ├── Navbar.jsx
        │   └── Sidebar.jsx              # ONE component, renders a different nav tree
        │                                 # per logged-in role (NAV_BY_ROLE map)
        ├── layout/
        │   └── Dashboard.jsx            # shell: Sidebar + Navbar + <Outlet/>
        └── pages/
            ├── Login.jsx                 # reg-no/employee-no + password -> OTP step
            ├── RoleDashboard.jsx         # ONE dashboard, content generated per role
            └── PlaceholderPage.jsx       # stub used by not-yet-built routed pages
```

## How the tricky requirements are handled

| Requirement | Where |
|---|---|
| Registration number `SC211/0530/2022` (programme/sequence/admission-year), unique, auto-generated | `utils.generate_registration_number` (atomic, per-programme-per-year sequence), called from `services.AdmissionService.admit_student` |
| Different programme lengths (4yr/2sem vs 4yr/3sem) | `Programme.duration_years` + `Programme.semesters_per_year`; all promotion/semester math goes through `utils.next_year_semester` / `is_final_semester` |
| Intakes (Aug 2026, Jan 2027, May 2027) | `Intake` model, tied to an `AcademicYear` + starting `Semester` |
| Auto-promotion to next year/semester | `services.PromotionService` (+ `run_promotion` management command / `RunPromotionView` API). Skips deferred students; graduates students past their final semester; can cap on unresolved supplementaries |
| Units revised every year, but shared across cohorts (Y1 IT student and Y3 Software Eng student on the same unit) | `CurriculumVersion` + `CurriculumUnit` map a `Course` to (programme, year, semester) per curriculum year, while `Course` itself is a single shared row |
| Bank payments identified only by name + reg number | `services.FeeService.process_bank_notification` (webhook target: `POST /api/v1/integrations/bank-payment/`) — looks the student up by registration number, flags name mismatches for review via `utils.names_roughly_match`, never blocks on a fuzzy name |
| Overpayment (Ksh 31,000 paid on a Ksh 20,000 invoice) | `services.FeeService.allocate_payment` applies oldest-invoice-first, and any leftover becomes `StudentFeeAccount.credit_balance`, auto-applied to the next invoice raised (`_auto_apply_credit`) — money is never lost or rejected |
| HELB / bursaries | `HelbBursaryAward` model + `FeeStructure.government_subsidy`, reduces `net_fee()` before an invoice is even raised |
| Marks Year1 Sem1 → Year4 Sem2/3 | `TranscriptEntry` — append-only per-course-per-semester ledger, written by `GradingService._write_transcript_entry` every time a grade is published |
| Online CAT submission | `CatSubmission` (lecturer-opened window) + `CatAnswerSubmission` (student upload), with `is_open`/`is_late` computed from the window |
| Unit registration | `UnitRegistrationService.register_semester_units` auto-registers the student's current curriculum units AND pulls forward any outstanding supplementary/repeat units |
| Different grading per department (Nursing vs IT) | `GradingScheme` + `GradeBand` are data, not code; each `Department` points at its own scheme; `GradingService.compute_and_save` looks up bands dynamically |
| Supplementary flow: fail → pay → receipt → sit next offering, even under a different year's lecturer allocation | `SupplementaryService` (`outstanding_units`, `create_supplementary_invoice`, `register_supplementary`, `is_cleared_to_sit`); `LecturerUnitAllocation.roster()` folds these students into whichever offering is currently running |
| Deferment + resumption | `StudentDeferment` + `DefermentService.apply/approve/resume` — `resume()` restores the student to the exact year/semester they left, marks and fees untouched |
| Hostel booking only for reporting Year-1 Sem-1 students | `services.HostelService.is_eligible_to_book` checks `current_year==1, current_semester==1` AND an approved `StudentReporting` |
| Clearance only for final year/final semester | `services.ClearanceService.is_eligible` uses `utils.is_final_semester` |
| Role-based access + 2FA that bypasses when `DEBUG=True` | `User.requires_2fa` reads `settings.DEBUG`; `services.AuthService` issues/verifies OTP only when not bypassed; `views.LoginView`/`VerifyOtpView` implement the two-step flow; DRF permission classes (`IsRole`, `IsStaffRole`) gate every viewset |
| Login via registration number / employee number + password | Both are stored in `User.username` (Django's login field); `AuthService.authenticate` doesn't care which kind it is |
| System keeps a full audit trail | `ActivityLog` (generic, append-only) + `AdminLoginAttempt` + `TwoFactorCode` |

## Getting started

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env         # set DJANGO_DEBUG=True locally to bypass 2FA
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver

# Frontend
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Notes / next steps

- `manage.py`, `wsgi.py`, `asgi.py` and migrations are generated by
  `django-admin startproject`/`makemigrations` — not hand-written here.
- Wire `AuthService.issue_otp` to a real SMS/email provider before going to production.
- Put a shared-secret or mTLS check in front of `/integrations/bank-payment/` at the
  gateway (nginx) level — it's intentionally `AllowAny` so the bank's server can reach it.
- `PromotionService.MAX_CARRIED_SUPPLEMENTARIES` and `SupplementaryService.SUPPLEMENTARY_FEE`
  are policy knobs — move them to a `PolicySetting` model if they need to vary per
  programme/department instead of being global constants.
