# NSTU India Private Limited - Property Tax Notice Distribution System

## Original Problem Statement
Build a full-stack web application for NSTU India Private Limited to manage property tax notice distribution and surveys. The application requires different user roles (Admin, Surveyor, Supervisor, MC Officer), bulk data upload via Excel and PDF, property assignment, a surveyor mobile interface for data collection (including photos with GPS watermarks and signatures), and an admin dashboard for progress tracking, review/approval, and data export.

## User Personas
1. **Super Admin** - Full system access, user management, data management, export
2. **Surveyor** - Field worker collecting property data, photos, signatures
3. **Supervisor** - Can upload data, view submissions, but cannot export or manage users
4. **MC Officer** - Can view and export data, but cannot upload or edit submissions

## Role-Based Access Control (RBAC) - Implemented Jan 16, 2026

### Permission Matrix

| Feature | Admin | Supervisor | MC Officer | Employee/Surveyor |
|---------|-------|------------|------------|-------------------|
| Dashboard | ✅ | ✅ | ✅ | ❌ (own dashboard) |
| View Employees | ✅ | ❌ | ✅ | ❌ |
| Manage Employees | ✅ | ❌ | ❌ | ❌ |
| View Attendance | ✅ | ✅ | ✅ | ❌ |
| Upload Data/Bills | ✅ | ✅ | ❌ | ❌ |
| View Properties | ✅ | ✅ | ✅ | ✅ (own) |
| Assign Properties | ✅ | ✅ | ❌ | ❌ |
| View Submissions | ✅ | ✅ | ✅ | ✅ (own) |
| Edit Submissions | ✅ | ❌ | ❌ | ❌ |
| Approve/Reject | ✅ | ❌ | ❌ | ❌ |
| Export (PDF/Excel) | ✅ | ❌ | ✅ | ❌ |
| Manage Batches | ✅ | ❌ | ❌ | ❌ |

### Backend Role Constants
```python
ADMIN_ROLES = ["ADMIN", "SUPERVISOR"]  # Can modify data
ADMIN_VIEW_ROLES = ["ADMIN", "SUPERVISOR", "MC_OFFICER"]  # Can view admin pages
EXPORT_ROLES = ["ADMIN", "MC_OFFICER"]  # Can export data
UPLOAD_ROLES = ["ADMIN", "SUPERVISOR"]  # Can upload data
SUBMISSION_EDIT_ROLES = ["ADMIN"]  # Can edit submissions
PERFORMANCE_DOWNLOAD_ROLES = ["ADMIN"]  # Can download performance reports
```

## Core Requirements
- Role-based access control (Admin, Surveyor, Supervisor, MC Officer) ✅
- Bulk data upload (Excel/PDF) ✅
- Property assignment to surveyors ✅
- Mobile-friendly surveyor interface with GPS tracking ✅
- Photo capture with GPS/timestamp watermark ✅
- Signature capture ✅
- Admin dashboard for progress tracking ✅
- Survey submission review and approval workflow ✅
- Data export functionality with filters ✅
- PDF generation with multiple layouts ✅

## Technology Stack
- **Backend:** FastAPI, MongoDB (Motor), JWT authentication
- **Frontend:** React, React-Leaflet, Tailwind CSS, Shadcn UI
- **PDF Processing:** PyMuPDF, reportlab, pytesseract, pdf2image
- **Maps:** Leaflet with Google Satellite tiles

## What's Been Implemented

### Completed Features (as of Jan 16, 2026)

1. **Role-Based Access Control (NEW)**
   - 4 distinct roles: Admin, Supervisor, MC Officer, Surveyor
   - Backend permission enforcement on all endpoints
   - Frontend navigation adapts to role
   - Permissions returned via /auth/me endpoint

2. **Submission Module Filters (NEW)**
   - Filter by Employee
   - Filter by Status
   - Filter by Colony
   - Filter by Date

3. **Export Module Filters (NEW)**
   - Filter by Batch
   - Filter by Employee  
   - Filter by Status
   - Filter by Colony (date-wise)
   - Filter by Date Range (from/to)
   - Export formats: PDF and Excel

4. **Authentication & User Management**
   - JWT-based login system
   - Role-based access (Admin, Supervisor, MC Officer, Surveyor)
   - User CRUD operations

5. **PDF Bills Management**
   - PDF upload with batch processing
   - Bill extraction with serial number detection
   - GPS-based route optimization
   - PDF generation: 1, 2 or 3 bills per page
   - Split bills by employee

6. **Property Management**
   - Property creation from bills
   - Assignment to employees
   - GPS coordinates tracking
   - Colony/area filtering

7. **Survey System**
   - Mobile-friendly survey form
   - Photo capture with GPS watermark
   - Signature capture
   - Special conditions (House Locked, Owner Denied)
   - Self-certified status
   - 50m GPS distance check for submission

8. **Admin Dashboard**
   - Bills management with map view
   - Property map with satellite imagery
   - Survey submission review
   - Photo editing (add/delete) in submissions
   - Approve/Reject workflow
   - Export functionality

9. **Attendance System**
   - Daily selfie-based attendance
   - Admin visibility

## Pending Issues

### P1 - High Priority
1. **Backend Refactoring:** `server.py` is 3000+ lines - needs to be split into FastAPI routers

### P2 - Medium Priority
1. **Mobile Photo Watermark Bug:** GPS watermark not applied when taking photos directly from mobile camera (needs real device testing)
2. **Surveyor App Verification:** Need to verify fixes for completed property locking and rejection remarks display

## Future Tasks / Backlog
1. **Offline Support:** Enable surveyor app to work offline and sync later
2. **Download ZIP:** Add feature to download all split-employee PDFs as ZIP
3. **Remove Single Employee:** UI to remove one employee from multi-assigned property

## Key API Endpoints
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get user info with permissions
- `GET /api/admin/submissions` - List submissions (with colony, date filters)
- `GET /api/admin/export` - Export Excel (with colony, date filters)
- `GET /api/admin/export-pdf` - Export PDF (with colony, date filters)
- `POST /api/admin/bills/generate-pdf` - Generate arranged PDF (1, 2 or 3 per page)
- `PUT /api/admin/submissions/{id}` - Update submission (Admin only)
- `POST /api/employee/survey` - Submit survey data

## Database Schema (Key Collections)
- `users` - User accounts with roles
- `batches` - PDF upload batches
- `bills` - Individual bills extracted from PDFs
- `properties` - Properties created from bills
- `submissions` - Survey submissions
- `attendance` - Daily attendance records

## Test Credentials
- **Admin:** username: `admin`, password: `nastu123`
- **MC Officer:** username: `1234567890`, password: `test123`
- **Supervisor:** username: `a`, password: `test123`
- **Surveyor:** Create via admin panel

## File Structure
```
/app/
├── backend/
│   ├── .env
│   ├── requirements.txt
│   └── server.py         # Main backend with RBAC
└── frontend/
    └── src/
        ├── pages/
        │   ├── admin/
        │   │   ├── Bills.js
        │   │   ├── Export.js        # Updated with date/colony filters
        │   │   ├── Submissions.js   # Updated with date/colony filters
        │   │   └── ...
        │   └── employee/
        │       └── ...
        ├── components/
        │   └── AdminLayout.js       # Updated for role-based navigation
        └── context/
            └── AuthContext.js
```
