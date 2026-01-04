# NSTU Property Tax Manager - PRD

## Original Problem Statement
Build a web application for NSTU India Private Limited to manage property tax notice/bill distribution + survey for 50,000 properties, handled by 1 Super Admin + ~15 field employees.

## User Personas
1. **Super Admin**: Manages employees, uploads property datasets, assigns areas, views progress, exports data
2. **Field Employee**: Views assigned properties, submits surveys with GPS + photos, marks completion

## Core Requirements (Static)
- JWT-based authentication
- Local file storage for photos
- Light theme (professional corporate look)
- Support 50,000+ property records
- GPS coordinate capture at submission
- Photo evidence (house photo, gate photo - mandatory)
- Excel export with all submission data
- Batch management (archive/delete)

## What's Been Implemented (January 4, 2026)

### Backend (FastAPI + MongoDB)
- ✅ JWT Authentication (login/logout)
- ✅ User Management (CRUD for employees)
- ✅ Dataset Batch Upload (CSV)
- ✅ Property Management with pagination
- ✅ Area/Zone Assignment (manual + bulk)
- ✅ Survey Submission with GPS + photos
- ✅ Dashboard Statistics API
- ✅ Employee Progress Tracking
- ✅ Excel Export with all data
- ✅ Batch Archive/Delete

### Frontend (React + Tailwind + Shadcn UI)
- ✅ Login Page with background image
- ✅ Admin Dashboard with stats & charts
- ✅ Employee Management page
- ✅ Dataset Upload page with CSV template
- ✅ Properties page with filters & assignment
- ✅ Submissions review page
- ✅ Export page with batch management
- ✅ Employee Dashboard (mobile-friendly)
- ✅ Employee Properties list with search
- ✅ Survey Form with GPS capture & photo upload

## Prioritized Backlog

### P0 (Critical - Must Have)
- [x] Authentication system
- [x] Property upload (CSV)
- [x] Employee management
- [x] Property assignment
- [x] Survey submission with GPS + photos
- [x] Admin dashboard

### P1 (Important)
- [x] Excel export
- [x] Batch management
- [x] Status tracking
- [x] Employee progress view
- [ ] Photo metadata extraction (EXIF GPS data)
- [ ] Offline support for mobile

### P2 (Nice to Have)
- [ ] Real-time notifications
- [ ] Map view for properties
- [ ] Bulk reassignment
- [ ] Advanced reporting
- [ ] SMS notifications

## Next Tasks
1. Test complete employee survey workflow with actual GPS + photo upload
2. Add photo metadata (EXIF) extraction for GPS verification
3. Implement Google Maps integration for location visualization
4. Add offline support for field employees
5. OAuth integration (deferred per user request)

## Technical Architecture
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI
- **Auth**: JWT with bcrypt password hashing
- **File Storage**: Local uploads directory
- **Export**: openpyxl for Excel generation
