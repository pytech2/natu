# NSTU India Private Limited - Property Tax Notice Distribution System

## Original Problem Statement
Build a full-stack web application for NSTU India Private Limited to manage property tax notice distribution and surveys.

## Latest Updates (Jan 16, 2026)

### Property Management - Unassign Feature (NEW)
Added comprehensive unassign functionality for admin property management:

**Two Unassign Modes:**
1. **Unassign Selected Properties** - Select properties → Click "Unassign (N)" → Choose specific employee or clear all
2. **Unassign Employee from All Properties** - Click "Unassign Employee" → Select employee → Removes them from ALL their assigned properties

**Use Cases:**
- Employee leaves the organization → Unassign all their properties at once
- Employee completes survey in an area → Unassign them from that area
- Reassignment needed → Unassign first, then assign to new employee

**Backend Endpoints:**
- `POST /api/admin/unassign` - Unassign selected properties
- `POST /api/admin/unassign-by-employee` - Unassign ALL properties from an employee

### UI/UX Improvements
1. **Serial Number Display** - Bill serial numbers now shown prominently:
   - Survey form header has amber badge with serial number
   - Property cards show "Sr: X" badge before property ID
   - Map markers display serial numbers instead of property IDs
   - Map popups show serial number prominently with property ID below

2. **Map Performance Optimization**
   - Limited markers to 100 (regular) / 200 (fullscreen) for better performance

3. **Map 360° Rotation**
   - Added `leaflet-rotate` library for map rotation
   - Touch rotation enabled for mobile devices

4. **PWA Desktop Icon**
   - Created manifest.json with app icons

### Role-Based Access Control (RBAC)
| Feature | Admin | Supervisor | MC Officer | Surveyor |
|---------|-------|------------|------------|----------|
| Dashboard | ✅ | ✅ | ✅ | ✅ (own) |
| View Employees | ✅ | ❌ | ✅ | ❌ |
| Upload Data/Bills | ✅ | ✅ | ❌ | ❌ |
| View Properties | ✅ | ✅ | ✅ | ✅ (own) |
| **Unassign Properties** | ✅ | ✅ | ❌ | ❌ |
| Edit Submissions | ✅ | ❌ | ❌ | ❌ |
| Export (PDF/Excel) | ✅ | ❌ | ✅ | ❌ |

## Technology Stack
- **Backend:** FastAPI, MongoDB (Motor), JWT authentication
- **Frontend:** React, React-Leaflet, Tailwind CSS, Shadcn UI
- **Maps:** Leaflet with leaflet-rotate for 360° rotation
- **PDF Processing:** PyMuPDF, reportlab

## Key Features
- Multi-role authentication (Admin, Supervisor, MC Officer, Surveyor)
- Property tax bill upload and extraction from PDF
- **Property Assignment & Unassignment Management**
- GPS-based route optimization
- Survey submission with photo (GPS watermark) and signature
- Admin review and approval workflow
- Export to Excel and PDF with filters (date, colony, employee)

## Pending Issues
- **P1:** Verify serial number matching with bill PDFs on live server
- **P2:** Mobile photo watermark bug (needs real device testing)
- **P3:** Backend refactoring - split server.py into modular routes

## Test Credentials
- **Admin:** `admin` / `nastu123`
- **MC Officer:** `1234567890` / `test123`
- **Supervisor:** `a` / `test123`

## File Structure
```
/app/
├── backend/
│   └── server.py         # Added /admin/unassign and /admin/unassign-by-employee
└── frontend/
    └── src/
        └── pages/admin/
            └── Properties.js   # Added Unassign dialog and functionality
```
