// src/config/rbac.js
//
// Single source of truth for "admin-style" page access. Both App.jsx
// (route guards) and Sidebar.jsx (nav generation) read from this file,
// so there is exactly one place to update when a role's access changes.
//
// Design principle enforced here: ONLY 'admin' gets every page. Every
// other admin-adjacent role (registrar, dean, cod, exam_office, staff)
// gets a deliberately narrow slice matching their real job — not a
// blanket "admin-like" bucket like the old ADMIN_ROLES array.
//
// This mirrors ROLE_PAGE_PERMISSIONS in the backend's services.py. If
// you change access here, change it there too (or better: wire up
// usePermissions() from services/permissions.js to fetch it and treat
// this file as the offline fallback).

import { ROLES } from "../context/AuthContext";

export const ADMIN_LIKE_ROLES = [
  ROLES.ADMIN, ROLES.REGISTRAR, ROLES.DEAN, ROLES.COD, ROLES.EXAM_OFFICE, ROLES.STAFF,
];

// Every admin-style page in the system, with the exact roles allowed to
// open it. `key` matches the "pages" strings the backend's
// ROLE_PAGE_PERMISSIONS returns, so the two can be diffed/verified.
export const PAGES = {
  ADMIN_DASHBOARD: {
    key: "admin_dashboard", path: "/admin/dashboard", label: "Dashboard", icon: "bi-speedometer2",
    roles: [ROLES.ADMIN, ROLES.REGISTRAR, ROLES.DEAN, ROLES.COD, ROLES.EXAM_OFFICE],
  },
  FACULTIES: {
    key: "faculties", path: "/faculties", label: "Faculties & Depts", icon: "bi-diagram-3",
    roles: [ROLES.ADMIN, ROLES.REGISTRAR],
  },
  PROGRAMMES: {
    key: "programmes", path: "/programmes", label: "Programmes", icon: "bi-mortarboard",
    roles: [ROLES.ADMIN, ROLES.REGISTRAR, ROLES.DEAN],
  },
  COURSES: {
    key: "courses", path: "/courses", label: "Courses & Curriculum", icon: "bi-journal-code",
    roles: [ROLES.ADMIN, ROLES.REGISTRAR, ROLES.DEAN, ROLES.COD],
  },
  CALENDAR: {
    key: "calendar", path: "/calendar", label: "Academic Years / Intakes", icon: "bi-calendar3",
    roles: [ROLES.ADMIN, ROLES.REGISTRAR, ROLES.EXAM_OFFICE],
  },
  STUDENTS: {
    key: "students", path: "/students", label: "Students", icon: "bi-people",
    roles: [ROLES.ADMIN, ROLES.REGISTRAR],
  },
  LECTURERS: {
    key: "lecturers", path: "/lecturers", label: "Lecturers & Staff", icon: "bi-person-badge",
    roles: [ROLES.ADMIN, ROLES.COD],
  },
  DEFERMENTS: {
    key: "deferments", path: "/deferments", label: "Deferments", icon: "bi-pause-circle",
    roles: [ROLES.ADMIN, ROLES.REGISTRAR],
  },
  RESULTS_MANAGER: {
    key: "resultsmanagement", path: "/resultsmanagement", label: "Results Manager", icon: "bi-clipboard-data",
    roles: [ROLES.ADMIN, ROLES.EXAM_OFFICE],
  },
  UNIT_ALLOCATIONS: {
    key: "unitallocations", path: "/unitallocations", label: "Unit Allocation", icon: "bi-person-video3",
    roles: [ROLES.ADMIN, ROLES.COD],
  },
  TIMETABLE_BUILDER: {
    key: "timetablebuilder", path: "/timetable-builder", label: "Timetable Builder", icon: "bi-calendar2-week",
    roles: [ROLES.ADMIN, ROLES.REGISTRAR, ROLES.COD],
  },
  PROMOTIONS: {
    key: "promotions", path: "/promotions", label: "Promotions", icon: "bi-arrow-up-circle",
    roles: [ROLES.ADMIN, ROLES.REGISTRAR],
  },
    USER_MANAGEMENT: {
    key: "usermanagement", path: "/user-management", label: "User Management", icon: "bi-person-gear",
    roles: [ROLES.ADMIN],
  },
  EXAMINATIONS: {
    key: "examinations", path: "/examinations", label: "Examinations", icon: "bi-clipboard-check",
    roles: [ROLES.ADMIN, ROLES.REGISTRAR, ROLES.EXAM_OFFICE, ROLES.COD],
  },
  CLEARANCES: {
    key: "clearances", path: "/clearances", label: "Clearances", icon: "bi-file-earmark-check",
    roles: [ROLES.ADMIN, ROLES.REGISTRAR, ROLES.DEAN, ROLES.EXAM_OFFICE],
  },
  REPORTINGS: {
    key: "reportings", path: "/reportings", label: "Semester Reportings", icon: "bi-check2-square",
    roles: [ROLES.ADMIN, ROLES.REGISTRAR],
  },
  REPORTS: {
    key: "reports", path: "/reports", label: "Reports", icon: "bi-bar-chart",
    roles: [ROLES.ADMIN, ROLES.REGISTRAR, ROLES.DEAN, ROLES.EXAM_OFFICE],
  },
};

// Sidebar section grouping. A section disappears entirely for a role if
// none of its pages are allowed for that role.
export const NAV_SECTIONS = [
  { label: "Overview", pages: [PAGES.ADMIN_DASHBOARD] },
  { label: "Academic Structure", pages: [PAGES.FACULTIES, PAGES.PROGRAMMES, PAGES.COURSES, PAGES.CALENDAR] },
  { label: "People", pages: [PAGES.STUDENTS, PAGES.LECTURERS, PAGES.DEFERMENTS] },
  {
    label: "Operations",
    pages: [
      PAGES.RESULTS_MANAGER, PAGES.UNIT_ALLOCATIONS, PAGES.TIMETABLE_BUILDER, PAGES.PROMOTIONS,
      PAGES.EXAMINATIONS, PAGES.CLEARANCES, PAGES.REPORTINGS, PAGES.REPORTS,
    ],
  },
];

/** Sections + pages a given user_type is allowed to see, empty sections dropped. */
export function navForRole(userType) {
  return NAV_SECTIONS
    .map((section) => ({ label: section.label, pages: section.pages.filter((p) => p.roles.includes(userType)) }))
    .filter((section) => section.pages.length > 0);
}

/** Flat list of every page a role can open — used for route guards in App.jsx. */
export function pagesForRole(userType) {
  return Object.values(PAGES).filter((p) => p.roles.includes(userType));
}

/** Roles allowed to open a given PAGES.X entry — convenience for <ProtectedRoute allow={...}>. */
export function rolesFor(page) {
  return page.roles;
}