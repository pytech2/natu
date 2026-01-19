# NSTU India Private Limited - Property Tax Notice Distribution System

## Original Problem Statement
Build a full-stack web application for NSTU India Private Limited to manage property tax notice distribution and surveys.

## Latest Updates (Jan 19, 2026)

### GridFS File Storage (COMPLETED) ✅
All uploads now stored in MongoDB GridFS instead of local UPLOAD_DIR:

**Backend Changes:**
1. **New File Serve Endpoint:** `GET /api/file/{file_id}` - Serves files from GridFS with caching
2. **Survey Submit:** Photos, signatures saved to GridFS with `file_id` reference
3. **Attendance:** Selfie photos saved to GridFS
4. **PDF Export:** Updated to fetch photos from GridFS for embedding in reports

**Database Schema Update:**
```javascript
// Submission photos now include file_id
photos: [
  { photo_type: "HOUSE", file_url: "/api/file/{file_id}", file_id: "{file_id}" }
]
signature_url: "/api/file/{file_id}"

// Attendance record
selfie_url: "/api/file/{file_id}"
selfie_file_id: "{file_id}"
```

### Fast Map API (COMPLETED) ✅
New lightweight endpoints for map markers:

| Endpoint | Purpose | Response Time |
|----------|---------|---------------|
| `GET /api/map/properties` | Admin map (500 markers) | ~0.09s |
| `GET /api/map/employee-properties` | Surveyor map (200 markers) | ~0.05s |

**Optimization Details:**
- Minimal projection (only id, lat, lng, status, serial, name)
- No unnecessary joins or lookups
- Index-optimized queries

### Previous Performance Optimizations (COMPLETED)
1. **MongoDB Indexes:** 20+ indexes on properties, users, submissions, attendance
2. **Connection Pool:** maxPoolSize=50, minPoolSize=10
3. **GPS Frequency:** 200m movement threshold, 60s max age

## API Endpoints Summary

### File APIs
- `GET /api/file/{file_id}` - Serve file from GridFS (cached 24hrs)

### Map APIs (FAST)
- `GET /api/map/properties?limit=500` - Admin map markers
- `GET /api/map/employee-properties?limit=200` - Surveyor map markers

### Auth APIs
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user with permissions

### Admin APIs
- `GET /api/admin/dashboard` - Dashboard stats
- `GET /api/admin/properties` - Property list (full data)
- `POST /api/admin/bills/upload-pdf` - Upload PDF bills
- `GET /api/admin/submissions/export` - Export to Excel/PDF

### Employee APIs
- `GET /api/employee/properties` - Assigned properties
- `POST /api/employee/submit/{property_id}` - Submit survey (GridFS)
- `POST /api/employee/attendance` - Mark attendance (GridFS)
- `GET /api/employee/attendance/today` - Check attendance

## Test Credentials
- **Admin:** `admin` / `nastu123`
- **Surveyor:** `surveyor1` / `test123`

## VPS Deployment Commands

```bash
# 1. Go to app folder
cd /var/www/nstu-app

# 2. Pull latest code
git fetch origin
git reset --hard origin/main

# 3. Backend update
cd backend
source venv/bin/activate
pip install -r requirements.txt
pkill -f uvicorn
nohup python -m uvicorn server:app --host 0.0.0.0 --port 8001 > backend.log 2>&1 &
cd ..

# 4. Frontend build
cd frontend
npm install --legacy-peer-deps
npm run build
cd ..

# 5. Restart Nginx
sudo systemctl reload nginx
```

## File Structure
```
/app/
├── backend/
│   ├── server.py         # Main API with GridFS, Fast Map endpoints
│   └── requirements.txt
└── frontend/
    └── src/
        └── pages/
            ├── admin/Map.js         # Uses /api/map/properties
            └── employee/Properties.js # Uses /api/map/employee-properties
```

## Pending/Future Tasks
- **P2:** Backend refactoring - split server.py into routers
- **P3:** Offline surveyor support
- **P3:** "Completed Colony" access restrictions
