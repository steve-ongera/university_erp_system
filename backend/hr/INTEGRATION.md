# Wiring the `hr` app into the existing project

## 1. Copy the app

Copy the `hr/` folder from this bundle so it sits next to your `portal_api`
app (same level, i.e. `myproject/hr/`, `myproject/portal_api/`).

## 2. settings.py

```python
INSTALLED_APPS = [
    # ...existing apps...
    "django_filters",       # only if not already installed — used for querystring filtering
    "portal_api",
    "hr",                    # <-- add this
]
```

If `django_filters` isn't already a dependency: `pip install django-filter`.

## 3. Project urls.py

```python
# myproject/urls.py
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/portal/", include("portal_api.urls")),   # your existing include
    path("api/hr/", include("hr.urls")),                 # <-- add this
]
```

Every HR endpoint is now under `/api/hr/…`, e.g.:

- `GET  /api/hr/staff/` — paginated staff list (filter by `?department=`, `?category=`, `?employment_status=`, search via `?search=`)
- `GET  /api/hr/staff/{id}/` — full profile incl. contracts
- `GET  /api/hr/staff/{id}/payslips/`
- `GET  /api/hr/staff/{id}/leave_balances/`
- `POST /api/hr/leave-applications/` — apply for leave
- `POST /api/hr/leave-applications/{id}/approve/` `/reject/` `/cancel/`
- `GET/POST /api/hr/attendance/`
- `POST /api/hr/attendance/mark_absentees/`
- `POST /api/hr/qr-sessions/check_in/` — staff self-check-in via QR token
- `POST /api/hr/biometric-logs/fold/` — fold raw punches into daily attendance
- `GET/POST /api/hr/payroll-periods/`
- `POST /api/hr/payroll-periods/{id}/run/` — computes payslips for every active staff member
- `POST /api/hr/payroll-periods/{id}/mark_paid/`
- `GET  /api/hr/payslips/`
- `GET  /api/hr/dashboard/` — the 5 summary stats
- `GET  /api/hr/dashboard/staff_by_category/`
- `GET  /api/hr/dashboard/payroll_trend/?months=6`
- `GET  /api/hr/dashboard/attendance_trend/?days=14`

## 4. Migrations

```bash
python manage.py makemigrations hr
python manage.py migrate
```

## 5. Seed reference data (once)

`JobGroup`, `LeaveType`, `PAYEBand` and `StatutoryRate` (NSSF/SHIF/Pension
rates for the current year) are reference tables the payroll math depends
on — create them via `/admin/` or a data migration before running your
first payroll period. Without a matching `PAYEBand`/`StatutoryRate` row
for a given `effective_year`, `PayrollService` simply computes 0 for that
component rather than failing, so it's safe to seed incrementally.

## 6. Existing users → StaffProfile

Any existing `portal_api.User` with `user_type` in
(`staff`, `lecturer`, `finance`, `registrar`, `dean`, `cod`, `hostel_warden`,
`exam_office`, `librarian`, `admin`) is a candidate for a `StaffProfile`.
A one-off management command or admin bulk action to backfill these from
your current `Staff`/`Lecturer` tables is the fastest path — `hr` doesn't
require it, so you can create profiles incrementally as HR onboards them
in the new module.
