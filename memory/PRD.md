# NSTU India Private Limited - Property Tax Notice Distribution System

## Original Problem Statement
Build a full-stack web application for NSTU India Private Limited to manage property tax notice distribution and surveys. The application requires different user roles (Admin, Surveyor, Supervisor, MC Officer), bulk data upload via Excel and PDF, property assignment, a surveyor mobile interface for data collection (including photos with GPS watermarks and signatures), and an admin dashboard for progress tracking, review/approval, and data export.

## Latest Updates (Jan 16, 2026)

### UI/UX Improvements Implemented
1. **Serial Number Display** - Bill serial numbers now shown prominently:
   - Survey form header has amber badge with serial number
   - Property cards show "Sr: X" badge before property ID
   - Map markers display serial numbers instead of property IDs
   - Map popups show serial number prominently with property ID below

2. **Map Performance Optimization**
   - Limited markers to 100 (regular) / 200 (fullscreen) for better performance
   - Only recalculates distances when user moves >50m
   - Reduced GPS update frequency to prevent constant re-renders

3. **Map 360° Rotation**
   - Added `leaflet-rotate` library for map rotation
   - Rotation controls available on both surveyor and admin maps
   - Touch rotation enabled for mobile devices

4. **PWA Desktop Icon**
   - Created manifest.json with app icons
   - App can be installed on desktop/mobile home screen
   - Theme color: #2563eb (blue)

### Role-Based Access Control (RBAC)
| Feature | Admin | Supervisor | MC Officer | Surveyor |
|---------|-------|------------|------------|----------|
| Dashboard | ✅ | ✅ | ✅ | ✅ (own) |
| View Employees | ✅ | ❌ | ✅ | ❌ |
| Upload Data/Bills | ✅ | ✅ | ❌ | ❌ |
| View Properties | ✅ | ✅ | ✅ | ✅ (own) |
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
- GPS-based route optimization
- Survey submission with photo (GPS watermark) and signature
- Admin review and approval workflow
- Export to Excel and PDF with filters (date, colony, employee)

## Pending Issues
- **P1:** Verify serial number matching with bill PDFs on live server
- **P2:** Mobile photo watermark bug (needs real device testing)
- **P3:** Backend refactoring - split server.py into modular routes

## Future Tasks
- Offline support for surveyor app
- Download ZIP for split-employee PDFs
- Remove single employee from multi-assigned property

## Test Credentials
- **Admin:** `admin` / `nastu123`
- **MC Officer:** `1234567890` / `test123`
- **Supervisor:** `a` / `test123`
- **Surveyor:** Create via admin panel or reset password for existing users

## File Structure
```
/app/
├── backend/
│   └── server.py         # Main backend with RBAC
└── frontend/
    ├── public/
    │   └── manifest.json  # PWA manifest for desktop icon
    └── src/
        ├── pages/
        │   ├── admin/
        │   │   ├── Map.js       # With serial numbers, rotation
        │   │   └── ...
        │   └── employee/
        │       ├── Properties.js # With serial numbers, rotation
        │       └── Survey.js     # Serial number in header
        └── components/
            └── AdminLayout.js    # Role-based navigation
```
