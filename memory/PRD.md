# NSTU India Private Limited - Property Tax Survey Application

## Original Problem Statement
Build a full-stack web application for NSTU India Private Limited to manage property tax notice distribution and surveys. The application requires:
- Different user roles (Admin, Surveyor, Supervisor, MC Officer)
- Bulk data upload via Excel and PDF
- Property assignment to employees (multiple employees can be assigned to same properties)
- Surveyor mobile interface for data collection (photos with GPS watermarks, signatures)
- Admin dashboard for progress tracking, review/approval, and data export

## Tech Stack
- **Backend**: FastAPI, MongoDB (Motor), JWT Authentication
- **Frontend**: React, React-Leaflet, Tailwind CSS, Shadcn UI
- **Libraries**: PyMuPDF, pytesseract, pdf2image, reportlab, html2canvas, jspdf

## User Roles & Permissions
1. **Super Admin**: Full access to all features
2. **Surveyor**: View assigned properties, submit surveys, mark attendance
3. **Supervisor**: Manage surveyors in assigned area
4. **MC Officer**: Review and approve submissions

---

## What's Been Implemented

### Authentication & Users
- [x] JWT-based authentication using mobile numbers
- [x] Password reset functionality
- [x] Role-based access control
- [x] Employee management (CRUD)

### Admin Features
- [x] Dashboard with statistics
- [x] Property upload via Excel
- [x] PDF Bill upload with BillSrNo extraction
- [x] Generate arranged PDFs (original sequence, no numbering overlay)
- [x] Split PDFs by assigned employee
- [x] Delete by Colony feature
- [x] Property Map view (Google Satellite)
- [x] Submissions review/approval with rejection remarks
- [x] Multi-employee assignment
- [x] Export Approved Submissions Only
- [x] Attendance GPS Tracker

### Employee/Surveyor Features
- [x] Mobile-optimized dashboard
- [x] Daily attendance with selfie capture
- [x] Assigned Properties page with:
  - [x] Live GPS tracking (optimized for performance)
  - [x] Nearest-first sorting for pending properties
  - [x] **Completed properties locked** - show "Done" badge, click shows toast
  - [x] **Rejected properties highlighted** - show red badge and rejection reason
  - [x] Stats: Total, Pending, Done, Rejected
  - [x] Full Size Map modal
  - [x] Print map as PDF feature
- [x] Survey submission with:
  - [x] Photo capture with GPS/timestamp watermark
  - [x] Optional signature pad
  - [x] Special Conditions: House Locked / Owner Denied

### Survey Form Features
- [x] Property Information display
- [x] GPS Status with 50m range validation
- [x] Special Conditions (House Locked / Owner Denied)
- [x] Self-Certified radio buttons
- [x] Survey submission to backend
- [x] Completed survey view (read-only)

### Maps & Visualization
- [x] Google Satellite tiles for all maps
- [x] Custom markers showing Property ID
- [x] Pink markers for completed surveys
- [x] Red markers for rejected surveys

---

## Recent Fixes (January 11, 2026)

### Surveyor Performance Issues (Fixed)
- Reduced GPS tracking frequency from 25m to 50m threshold
- Added distance calculation caching to prevent constant re-renders
- GPS watch updates throttled to significant movements only

### Completed Properties Locking (Fixed)
- Completed/Approved surveys now show lock icon
- Clicking shows toast instead of reopening survey
- Visual styling: faded/grayed appearance

### Rejected Properties Display (Fixed)
- Red "⚠ Rejected" badge on property cards
- Rejection reason displayed under property card
- Stats row now shows 4 columns including Rejected count
- Backend: Rejection remarks now saved to property record

### BillSrNo Extraction (Fixed)
- Enhanced extraction for "BillSrNo. : 112" format
- Position-aware block detection
- N/A handling for missing serial numbers

---

## Known Issues

### P1: Mobile Photo Watermark
- Watermark may not apply on some mobile cameras
- Needs user verification on real device

---

## Technical Debt

### High Priority
1. **Backend Refactoring** - `server.py` is 2800+ lines
   - Split into modular FastAPI routers

---

## Future/Backlog Tasks

1. **Offline Support** - Enable surveyor mobile to work offline
2. **Download ZIP** - All split-employee PDFs as single ZIP
3. **Remove Employee** - Option to remove specific employee from assignment
4. **Push Notifications** - For new assignments

---

## Test Credentials
- **Admin**: `admin` / `nastu123`
- **Employee**: `rajeev_gurgaon` / `test123`

## Key Files
- `/app/backend/server.py` - Main backend
- `/app/frontend/src/pages/employee/Properties.js` - Surveyor property list (updated)
- `/app/frontend/src/pages/employee/Survey.js` - Survey form
- `/app/frontend/src/pages/admin/Bills.js` - PDF bills management

---

*Last Updated: January 11, 2026*
