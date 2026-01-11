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
- [x] Password reset functionality (Fixed hash storage bug)
- [x] Role-based access control
- [x] Employee management (CRUD)

### Admin Features
- [x] Dashboard with statistics (properties, completions, attendance)
- [x] Employee performance charts
- [x] Property upload via Excel
- [x] PDF Bill upload and processing
  - [x] Multi-page PDF extraction
  - [x] Filter out "NA" owner names during import
  - [x] GPS-based route sorting by colony
  - [x] **BillSrNo extraction from PDF** (extracts "BillSrNo. : 112" format)
  - [x] N/A handling for missing serial numbers
- [x] Generate arranged PDFs per colony (original sequence, no numbering overlay)
- [x] Split PDFs by assigned employee
- [x] Delete by Colony feature
- [x] Property Map view (Google Satellite)
- [x] Submissions review/approval
- [x] **Multi-employee assignment** - Same properties can be assigned to multiple employees
- [x] **Export Approved Submissions Only** - Excel and PDF export defaults to Approved status
- [x] **Attendance GPS Tracker** - Map shows employee check-in locations with markers

### Employee/Surveyor Features
- [x] Mobile-optimized dashboard
- [x] Daily attendance with selfie capture
- [x] Assigned Properties page with:
  - [x] Persistent map view
  - [x] **Live GPS tracking** with real-time location
  - [x] **Nearest-first sorting** based on surveyor location
  - [x] **GREEN static highlight** for nearest property
  - [x] Full Size Map modal
  - [x] Smart zoom algorithm (no aggressive auto-zoom)
  - [x] Print map as PDF feature
- [x] Survey submission with:
  - [x] **Photo capture with GPS/timestamp watermark**
  - [x] Signature pad (now optional)
  - [x] GPS coordinates
  - [x] **Special Conditions**: House Locked / Owner Denied options

### Survey Form Features
- [x] Property Information display
- [x] GPS Status with 50m range validation
- [x] **Special Conditions** (House Locked / Owner Denied)
- [x] **Self-Certified** radio buttons
- [x] Notice Receiver Details (conditional)
- [x] Property Photo capture with GPS watermark
- [x] **Signature is now OPTIONAL**
- [x] Survey submission to backend
- [x] Completed survey view

### Maps & Visualization
- [x] Google Satellite tiles for all maps
- [x] Custom markers showing Property ID
- [x] Min/Max zoom limits
- [x] User location marker (blue dot)
- [x] Property clustering
- [x] Pink markers for completed surveys

---

## Recent Fixes (January 2026)

### BillSrNo Extraction (Fixed - Jan 11)
- Enhanced extraction to find BillSrNo using position-aware block detection
- Handles "BillSrNo. : 112" format where number may be in separate text block
- Bills without BillSrNo marked as "N/A" with amber badge

### PDF Generation (Fixed - Jan 11)
- Removed all serial numbering options from UI
- PDF generates in original sequence
- No serial numbers overlaid on generated PDF

### Syntax Error Fix (Jan 11)
- Fixed Bills.js line 703 (extra closing brace)

---

## Known Issues

### P1: Mobile Photo Watermark
- Watermark may not apply when using mobile camera directly
- Fix applied but needs user verification on real device

---

## Technical Debt

### High Priority
1. **Backend Refactoring** - `server.py` is 2800+ lines
   - Split into modular FastAPI routers:
     - `/routes/auth.py`
     - `/routes/users.py`
     - `/routes/properties.py`
     - `/routes/bills.py`
     - `/routes/submissions.py`

---

## Future/Backlog Tasks

1. **Offline Support** - Enable surveyor mobile to work offline and sync later
2. **Download ZIP** - All split-employee PDFs as single ZIP
3. **Remove Employee** - Option to remove specific employee from property assignment
4. **Push Notifications** - For new assignments

---

## Test Credentials
- **Admin**: `admin` / `nastu123`
- **Employee**: Create via admin panel

## Key Files
- `/app/backend/server.py` - Main backend (monolithic, needs refactoring)
- `/app/frontend/src/pages/employee/Properties.js` - GPS-aware property list
- `/app/frontend/src/pages/employee/Attendance.js` - Attendance with selfie
- `/app/frontend/src/pages/employee/Survey.js` - Survey form with watermark
- `/app/frontend/src/pages/admin/Attendance.js` - GPS tracker map
- `/app/frontend/src/pages/admin/Bills.js` - PDF bills management
- `/app/frontend/src/pages/admin/Export.js` - Approved export

---

*Last Updated: January 11, 2026*
