# NSTU India Pvt Ltd - Property Tax Manager PRD

## Original Problem Statement
Build a web application for **NSTU India Private Limited** to manage property tax notice/bill distribution + surveys for 50,000+ properties, handled by 1 Super Admin + ~15 field surveyors.

## User Personas
1. **Super Admin**: Manages employees (Surveyors, Supervisors, MC Officers), uploads property datasets, assigns areas, views progress, reviews & approves/rejects submissions, exports data
2. **Supervisor**: Full admin access - same as Super Admin for oversight
3. **MC Officer**: Limited view-only access - can see stats, properties, map, submissions but cannot upload data or manage employees
4. **Surveyor**: Views assigned properties, submits surveys with GPS-watermarked photos, digital signature, marks completion

## Core Requirements
- JWT-based authentication
- Local file storage for photos
- Light theme (professional corporate look)
- Support 50,000+ property records
- GPS coordinate capture at submission
- Photo evidence with GPS/Date/Time watermark
- Digital signature capture
- Excel & PDF export with all submission data
- Batch management (archive/delete)

## What's Been Implemented (January 5, 2026)

### Latest Session Changes ✅
- **50-Meter Radius Check**: Survey form only submits when surveyor is within 50m of property GPS
- **Survey Form Updates**:
  - Locked property fields (Property ID, Owner, Mobile, Colony, Total Area, Amount, Lat/Lng) displayed as read-only
  - Updated relation dropdown: Self, Family Member, Tenant, Neighbour, Other
  - Removed "Old Property ID" field
  - Added "Self Satisfied" Yes/No radio buttons
  - Ward Number is now editable (blank by default)
- **Dashboard UI Changes**:
  - Removed "Batches" stat card
  - Renamed "Today Completed Wards" to "Completed Colony"
- **Role-Based Access Control**:
  - SUPERVISOR: Full admin-level access
  - MC_OFFICER: Limited view-only (Dashboard, Properties, Map, Submissions only)
- **Attendance System**: One-time daily selfie check-in for surveyors with GPS location

### Branding & UI
- ✅ NSTU India Pvt Ltd logo integration
- ✅ Modern admin dashboard with graphs first, then employee table
- ✅ Mobile-friendly surveyor interface
- ✅ Clean, professional design

### Backend (FastAPI + MongoDB)
- ✅ JWT Authentication (login/logout)
- ✅ User Management with roles: ADMIN, SURVEYOR, SUPERVISOR, MC_OFFICER
- ✅ Role-based access control (ADMIN/SUPERVISOR full access, MC_OFFICER limited)
- ✅ Dataset Batch Upload (CSV)
- ✅ Property Management with pagination
- ✅ Survey Submission with all fields including self_satisfied
- ✅ Approve/Reject workflow with mandatory remarks
- ✅ Dashboard Statistics with today_completed, today_wards (Completed Colony)
- ✅ Employee Progress Tracking
- ✅ Attendance System (selfie + GPS)
- ✅ Excel & PDF Export
- ✅ Batch Archive/Delete

### Frontend (React + Tailwind + Shadcn UI)
- ✅ Login Page with NSTU logo
- ✅ Admin Dashboard: 5 stat cards (Total, Completed, Pending, Rejected, Employees)
- ✅ Role-based navigation (SUPERVISOR full, MC_OFFICER limited)
- ✅ Employee Management: Create Surveyor/Supervisor/MC Officer
- ✅ Dataset Upload: CSV format
- ✅ Submissions: Approve/Reject with remarks
- ✅ Surveyor Dashboard: Attendance status card, Total Complete Data stat
- ✅ Attendance Page: One-time daily selfie check-in
- ✅ Survey Form with:
  - Locked property fields (read-only section)
  - Receiver Name & Relation (Self, Family Member, Tenant, Neighbour, Other)
  - Family ID, Aadhar Number, Ward Number (editable)
  - Self Satisfied Yes/No radio buttons
  - 50m radius check with distance display
  - Remarks
- ✅ GPS-watermarked photos
- ✅ Digital signature pad
- ✅ Property Map with numbered pins

### Data Model - Survey Fields
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| receiver_name | string | Yes | Name of notice receiver |
| relation | enum | Yes | Relation with owner (Self, Family Member, Tenant, Neighbour, Other) |
| family_id | string | No | Family identifier |
| aadhar_number | string | No | 12-digit Aadhar |
| ward_number | string | No | Ward number (editable) |
| self_satisfied | enum | Yes | Yes or No |
| remarks | string | No | Additional notes |

### Test Credentials
- **Admin**: admin / nastu123
- **Surveyor**: surveyor1 / test123

## Prioritized Backlog

### P0 (Critical - Done)
- [x] Authentication system
- [x] Property upload
- [x] Employee management with roles
- [x] Role-based access control
- [x] Property assignment
- [x] Survey submission with all fields
- [x] 50m radius check
- [x] Attendance system
- [x] Approve/Reject workflow
- [x] Admin dashboard

### P1 (Important)
- [x] Excel export
- [x] PDF export with watermarked photos
- [x] Digital signature
- [x] GPS watermarking
- [ ] Mobile photo watermark bug fix (photo capture on mobile)

### P2 (Nice to Have)
- [ ] Offline support for mobile
- [ ] Real-time notifications
- [ ] Bulk reassignment
- [ ] Advanced reporting
- [ ] SMS notifications

## Technical Architecture
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI
- **Maps**: Leaflet + React-Leaflet
- **Auth**: JWT with bcrypt password hashing
- **File Storage**: Local uploads directory
- **Export**: openpyxl (Excel), reportlab (PDF)

## Code Architecture
```
/app/
├── backend/
│   ├── uploads/
│   ├── .env
│   ├── requirements.txt
│   └── server.py     # FastAPI app with role-based access
└── frontend/
    ├── public/
    │   └── nstu-logo.png
    ├── src/
    │   ├── components/
    │   │   ├── AdminLayout.js    # Role-based navigation
    │   │   └── EmployeeLayout.js
    │   ├── context/
    │   │   └── AuthContext.js
    │   ├── pages/
    │   │   ├── admin/
    │   │   │   ├── Dashboard.js     # 5 stat cards, no Batches
    │   │   │   ├── Employees.js
    │   │   │   ├── Export.js
    │   │   │   ├── Map.js
    │   │   │   ├── Properties.js
    │   │   │   ├── Submissions.js
    │   │   │   └── Upload.js
    │   │   ├── employee/
    │   │   │   ├── Attendance.js   # NEW - Selfie check-in
    │   │   │   ├── Dashboard.js
    │   │   │   ├── Properties.js
    │   │   │   └── Survey.js       # 50m check, locked fields
    │   │   └── Login.js
    │   ├── App.js                   # Role-based routing
    │   └── index.css
    ├── .env
    └── package.json
```
