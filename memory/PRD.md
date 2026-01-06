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

## What's Been Implemented (January 6, 2026)

### Latest Session Changes ✅
- **PDF Bills Management - New Features:**
  - **Delete All Button**: Bulk delete all bills (with filter support)
  - **Add to Properties Button**: Copy bills to properties database for survey workflow
  - **Split by Employee - Select by Name**: Now shows employee list with names, usernames, roles; select specific employees instead of just a count
  - **Serial Number Format**: Changed from "SN: X" to "SR : X" format in generated PDFs
  
- **Property Map Features - Complete:**
  - "Arrange by GPS Route" - GPS-based nearest neighbor sorting
  - "Save Arranged Data" - Save new serial order to database
  - "Download Arranged PDF" - Generate PDF with properties sorted by GPS route

### PDF Bill Processing System (Complete)
- ✅ Upload multi-page PDFs
- ✅ Extract bill data from each page using PyMuPDF
- ✅ Store extracted data (owner, mobile, colony, GPS, amounts)
- ✅ Filter by colony/batch
- ✅ Arrange bills by GPS route (nearest neighbor algorithm)
- ✅ Generate arranged PDFs with "SR : X" serial numbers
- ✅ Split PDFs by specific employees (select by name)
- ✅ Edit bill data
- ✅ View bills on map
- ✅ Delete all bills
- ✅ Copy bills to properties database

### Branding & UI
- ✅ NSTU India Pvt Ltd logo integration
- ✅ Modern admin dashboard with graphs first, then employee table
- ✅ Mobile-friendly surveyor interface
- ✅ Clean, professional design

### Backend (FastAPI + MongoDB)
- ✅ JWT Authentication (login/logout)
- ✅ User Management with roles: ADMIN, SURVEYOR, SUPERVISOR, MC_OFFICER
- ✅ Role-based access control
- ✅ Dataset Batch Upload (CSV/Excel)
- ✅ PDF Bills Upload & Processing
- ✅ Property Management with pagination
- ✅ Survey Submission with 50m radius check
- ✅ Approve/Reject workflow
- ✅ Dashboard Statistics
- ✅ Employee Progress Tracking
- ✅ Attendance System (selfie + GPS)
- ✅ Excel & PDF Export
- ✅ GPS Route Sorting (Nearest Neighbor Algorithm)

### Frontend (React + Tailwind + Shadcn UI)
- ✅ Login Page with NSTU logo
- ✅ Admin Dashboard with stats and charts
- ✅ Employee Management
- ✅ Dataset Upload (CSV/Excel)
- ✅ PDF Bills Management with all features
- ✅ Property Map with GPS markers and action buttons
- ✅ Bills Map visualization
- ✅ Submissions review
- ✅ Surveyor mobile interface

### Test Credentials
- **Admin**: admin / nastu123
- **Surveyors**: Created via admin panel

## Prioritized Backlog

### P0 (Critical - Done)
- [x] Authentication system
- [x] Property upload (CSV/Excel)
- [x] PDF Bills upload & processing
- [x] Employee management with roles
- [x] Property assignment
- [x] Survey submission with 50m radius check
- [x] GPS route arrangement
- [x] PDF generation with serial numbers
- [x] Split by employee (select by name)
- [x] Copy bills to properties
- [x] Delete all bills

### P1 (Important - Done)
- [x] Excel export
- [x] PDF export with watermarked photos
- [x] Digital signature
- [x] GPS watermarking
- [x] Property Map with action buttons

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
- **PDF Processing**: PyMuPDF (fitz)
- **Auth**: JWT with bcrypt password hashing
- **File Storage**: Local uploads directory
- **Export**: openpyxl (Excel), reportlab (PDF)

## API Endpoints - Bills Management
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/bills/upload-pdf` | POST | Upload PDF and extract bills |
| `/api/admin/bills` | GET | List bills with filters |
| `/api/admin/bills/colonies` | GET | Get unique colonies |
| `/api/admin/bills/{id}` | PUT | Update bill data |
| `/api/admin/bills/arrange-by-route` | POST | Arrange by GPS route |
| `/api/admin/bills/generate-pdf` | POST | Generate arranged PDF |
| `/api/admin/bills/split-by-employees` | POST | Split by specific employees |
| `/api/admin/bills/delete-all` | POST | Delete all bills |
| `/api/admin/bills/copy-to-properties` | POST | Copy to properties DB |
| `/api/admin/bills/map-data` | GET | Get bills for map |

## Code Architecture
```
/app/
├── backend/
│   ├── uploads/
│   ├── .env
│   ├── requirements.txt
│   └── server.py
└── frontend/
    ├── src/
    │   ├── components/
    │   ├── context/
    │   ├── pages/
    │   │   ├── admin/
    │   │   │   ├── Bills.js       # PDF Bills Management
    │   │   │   ├── BillsMap.js    # Bills Map View
    │   │   │   ├── Dashboard.js
    │   │   │   ├── Map.js         # Property Map with actions
    │   │   │   ├── Properties.js
    │   │   │   └── ...
    │   │   ├── employee/
    │   │   └── Login.js
    │   └── App.js
    └── package.json
```

## Key Data Models

### Bills Collection
```javascript
{
  id: string,
  batch_id: string,
  serial_number: number,
  page_number: number,
  property_id: string,
  owner_name: string,
  mobile: string,
  colony: string,
  latitude: number,
  longitude: number,
  category: string,
  total_outstanding: string,
  // ... other extracted fields
}
```

### Properties Collection
```javascript
{
  id: string,
  batch_id: string,
  serial_number: number,
  property_id: string,
  owner_name: string,
  mobile: string,
  colony: string,
  latitude: number,
  longitude: number,
  category: string,
  amount: string,
  assigned_employee_id: string,
  status: string,
  source_bill_id: string  // Reference to original bill
}
```
