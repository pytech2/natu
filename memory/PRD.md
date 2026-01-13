# NSTU India Private Limited - Property Tax Notice Distribution System

## Original Problem Statement
Build a full-stack web application for NSTU India Private Limited to manage property tax notice distribution and surveys. The application requires different user roles (Admin, Surveyor, Supervisor, MC Officer), bulk data upload via Excel and PDF, property assignment, a surveyor mobile interface for data collection (including photos with GPS watermarks and signatures), and an admin dashboard for progress tracking, review/approval, and data export.

## User Personas
1. **Super Admin** - Full system access, user management, data management
2. **Surveyor** - Field worker collecting property data, photos, signatures
3. **Supervisor** - Oversees surveyors, reviews submissions
4. **MC Officer** - Municipal council officer, approval authority

## Core Requirements
- Role-based access control (Admin, Surveyor, Supervisor, MC Officer)
- Bulk data upload (Excel/PDF)
- Property assignment to surveyors
- Mobile-friendly surveyor interface with GPS tracking
- Photo capture with GPS/timestamp watermark
- Signature capture
- Admin dashboard for progress tracking
- Survey submission review and approval workflow
- Data export functionality
- PDF generation with multiple layouts

## Technology Stack
- **Backend:** FastAPI, MongoDB (Motor), JWT authentication
- **Frontend:** React, React-Leaflet, Tailwind CSS, Shadcn UI
- **PDF Processing:** PyMuPDF, reportlab, pytesseract, pdf2image
- **Maps:** Leaflet with Google Satellite tiles

## What's Been Implemented

### Completed Features (as of Jan 13, 2026)
1. **Authentication & User Management**
   - JWT-based login system
   - Role-based access (Admin, Employee/Surveyor)
   - User CRUD operations

2. **PDF Bills Management**
   - PDF upload with batch processing
   - Bill extraction with serial number detection
   - GPS-based route optimization
   - PDF generation: 1 bill per page OR 3 bills per page (FIXED Jan 13)
   - Split bills by employee

3. **Property Management**
   - Property creation from bills
   - Assignment to employees
   - GPS coordinates tracking
   - Colony/area filtering

4. **Survey System**
   - Mobile-friendly survey form
   - Photo capture with GPS watermark
   - Signature capture
   - Special conditions (House Locked, Owner Denied)
   - Self-certified status
   - 50m GPS distance check for submission

5. **Admin Dashboard**
   - Bills management with map view
   - Property map with satellite imagery
   - Survey submission review
   - Photo editing (add/delete) in submissions
   - Approve/Reject workflow
   - Export functionality

6. **Attendance System**
   - Daily selfie-based attendance
   - Admin visibility

### Bug Fixes (Jan 13, 2026)
- **PDF Generation Fix:** 3 bills per page now correctly scales and stacks landscape bills on A4 portrait without overlap or cut-off

## Pending Issues

### P1 - High Priority
1. **Backend Refactoring:** `server.py` is 2800+ lines - needs to be split into FastAPI routers
2. **Surveyor App Verification:** Need to verify fixes for completed property locking and rejection remarks display

### P2 - Medium Priority
1. **Mobile Photo Watermark Bug:** GPS watermark not applied when taking photos directly from mobile camera (needs real device testing)

## Future Tasks / Backlog
1. **Offline Support:** Enable surveyor app to work offline and sync later
2. **Download ZIP:** Add feature to download all split-employee PDFs as ZIP
3. **Remove Single Employee:** UI to remove one employee from multi-assigned property

## Key API Endpoints
- `POST /api/auth/login` - User login
- `POST /api/admin/bills/generate-pdf` - Generate arranged PDF (1 or 3 per page)
- `POST /api/admin/bills/split-by-employee` - Split bills by employee
- `PUT /api/admin/submissions/{id}` - Update submission (with photo editing)
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
- **Surveyor:** Create via admin panel

## File Structure
```
/app/
├── backend/
│   ├── .env
│   ├── requirements.txt
│   └── server.py         # Main backend (needs refactoring)
└── frontend/
    └── src/
        ├── pages/
        │   ├── admin/
        │   │   ├── Bills.js
        │   │   ├── BillsMap.js
        │   │   ├── Map.js
        │   │   └── Submissions.js
        │   └── employee/
        │       ├── Properties.js
        │       └── Survey.js
        └── components/ui/  # Shadcn components
```
