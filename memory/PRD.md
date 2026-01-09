# NSTU India Private Limited - Property Tax Survey Application

## Original Problem Statement
Build a full-stack web application for NSTU India Private Limited to manage property tax notice distribution and surveys. The application requires:
- Different user roles (Admin, Surveyor, Supervisor, MC Officer)
- Bulk data upload via Excel and PDF
- Property assignment to employees
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
  - [x] Serial number generation on bills
- [x] Generate arranged PDFs per colony
- [x] Split PDFs by assigned employee
- [x] Delete by Colony feature
- [x] Property Map view
- [x] Submissions review/approval

### Employee/Surveyor Features
- [x] Mobile-optimized dashboard
- [x] Daily attendance with selfie capture
- [x] Assigned Properties page with:
  - [x] Persistent map view
  - [x] **Live GPS tracking** with real-time location
  - [x] **Nearest-first sorting** based on surveyor location
  - [x] **GREEN animated highlight** for nearest property:
    - Rotating dashed green border on map marker
    - Pulsing green glow effect
    - Green badge "⭐ NEAREST" on list card
    - Spinning border animation around card
  - [x] Full Size Map modal
  - [x] Smart zoom algorithm (adjusts based on distance)
  - [x] Print map as PDF feature
- [x] Survey submission with:
  - [x] Photo capture (watermark issue on mobile - P1)
  - [x] Signature pad
  - [x] GPS coordinates

### Maps & Visualization
- [x] Interactive maps using Leaflet
- [x] Custom numbered markers
- [x] Min/Max zoom limits to prevent blank tiles
- [x] User location marker (blue dot)
- [x] Property clustering

---

## Known Issues

### P0 (Critical)
- None currently blocking

### P1 (High Priority)
1. **Mobile Photo Watermark Bug** (Recurring)
   - Photos taken via mobile camera don't get GPS/timestamp watermark
   - File: `frontend/src/pages/employee/Survey.js`
   - Needs investigation of `applyWatermark` function

### P2 (Medium Priority)
1. **E2E Testing Needed**
   - Full regression test of all workflows
   - Admin: PDF upload, generation, delete by colony
   - Employee: Attendance, properties, survey submission

---

## Technical Debt

### High Priority
1. **Backend Refactoring** - `server.py` is 2700+ lines
   - Split into modular FastAPI routers:
     - `/routes/auth.py`
     - `/routes/users.py`
     - `/routes/properties.py`
     - `/routes/bills.py`
     - `/routes/submissions.py`

### Medium Priority
1. Clean up unused `PropertyMap.js` file
2. Add comprehensive test suite

---

## Future/Backlog Tasks

1. **Offline Support** - Enable surveyor mobile to work offline and sync later
2. **Download ZIP** - All split-employee PDFs as single ZIP
3. **Sound/Vibration Alert** - When surveyor is close to nearest property
4. **Push Notifications** - For new assignments

---

## Test Credentials
- **Admin**: `admin` / `nastu123`
- **Employee**: Create via admin panel, reset password

## Key Files
- `/app/backend/server.py` - Main backend (monolithic)
- `/app/frontend/src/pages/employee/Properties.js` - GPS-aware property list with green animation
- `/app/frontend/src/pages/employee/Attendance.js` - Attendance with selfie
- `/app/frontend/src/pages/employee/Survey.js` - Survey form with photo/signature
- `/app/frontend/src/pages/admin/Bills.js` - PDF bill management

---

*Last Updated: January 2026*
