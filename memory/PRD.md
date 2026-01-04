# NSTU India Pvt Ltd - Property Tax Manager PRD

## Original Problem Statement
Build a web application for **NSTU India Private Limited** to manage property tax notice/bill distribution + surveys for 50,000+ properties, handled by 1 Super Admin + ~15 field surveyors.

## User Personas
1. **Super Admin**: Manages employees (Surveyors, Supervisors, MC Officers), uploads property datasets, assigns areas, views progress, reviews & approves/rejects submissions, exports data
2. **Surveyor**: Views assigned properties, submits surveys with GPS-watermarked photos, digital signature, marks completion
3. **Supervisor** (Future): Oversees surveyor work, intermediate approvals
4. **MC Officer** (Future): Municipal Corporation level review

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

## What's Been Implemented (January 4, 2026)

### Branding & UI
- ✅ NSTU India Pvt Ltd logo integration
- ✅ Modern admin dashboard with graphs first, then employee table
- ✅ Mobile-friendly surveyor interface
- ✅ Clean, professional design

### Backend (FastAPI + MongoDB)
- ✅ JWT Authentication (login/logout)
- ✅ User Management with roles: ADMIN, SURVEYOR, SUPERVISOR, MC_OFFICER
- ✅ Dataset Batch Upload (CSV) - new format: property_id, owner_name, mobile, address, amount, ward
- ✅ Property Management with pagination
- ✅ Survey Submission with all new fields
- ✅ Approve/Reject workflow with mandatory remarks
- ✅ Dashboard Statistics with today_completed, today_wards
- ✅ Employee Progress Tracking with total_completed
- ✅ Excel & PDF Export
- ✅ Batch Archive/Delete

### Frontend (React + Tailwind + Shadcn UI)
- ✅ Login Page with NSTU logo
- ✅ Admin Dashboard: Graphs first, employee table second
- ✅ Employee Management: Create Surveyor/Supervisor/MC Officer
- ✅ Dataset Upload: New CSV format (property_id, owner_name, mobile, address, amount, ward)
- ✅ Submissions: Approve/Reject with remarks
- ✅ Surveyor Dashboard: Total Complete Data stat
- ✅ Survey Form with new fields:
  - New Owner's Name
  - New Mobile Number
  - Receiver Name
  - Relation with Owner (dropdown)
  - Old Property ID
  - Family ID
  - Aadhar Number
  - Ward Number
  - Remarks
- ✅ GPS-watermarked photos
- ✅ Digital signature pad

### Data Model - Survey Fields
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| new_owner_name | string | Yes | New owner's name |
| new_mobile | string | Yes | New mobile number |
| receiver_name | string | Yes | Name of notice receiver |
| relation | enum | Yes | Relation with owner (Self, Spouse, Son, etc.) |
| old_property_id | string | No | Old property ID reference |
| family_id | string | No | Family identifier |
| aadhar_number | string | No | 12-digit Aadhar |
| ward_number | string | No | Ward number |
| remarks | string | No | Additional notes |

### CSV Upload Format
```
property_id,owner_name,mobile,address,amount,ward
PROP001,राम कुमार,9876543210,Plot 101 Sector 5 Green Colony,5000,Ward 1
```

## Prioritized Backlog

### P0 (Critical - Done)
- [x] Authentication system
- [x] Property upload (new CSV format)
- [x] Employee management with new roles
- [x] Property assignment
- [x] Survey submission with new fields
- [x] Approve/Reject workflow
- [x] Admin dashboard with graphs
- [x] Surveyor dashboard with total completed

### P1 (Important)
- [x] Excel export
- [x] PDF export with watermarked photos
- [x] Digital signature
- [x] GPS watermarking
- [ ] Photo metadata extraction (EXIF GPS data)
- [ ] Mobile photo watermark bug fix (pending verification)

### P2 (Nice to Have)
- [ ] Offline support for mobile
- [ ] Real-time notifications
- [ ] Map view for properties
- [ ] Bulk reassignment
- [ ] Advanced reporting
- [ ] SMS notifications

## Technical Architecture
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI
- **Auth**: JWT with bcrypt password hashing
- **File Storage**: Local uploads directory
- **Export**: openpyxl (Excel), reportlab (PDF)

## Test Credentials
- **Admin**: admin / admin123
- **Surveyor**: surveyor1 / test123
