from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import bcrypt
import jwt
from bson import ObjectId
import aiofiles
import csv
import io
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'nstu-property-tax-secret-key-2025')
JWT_ALGORITHM = "HS256"

# Create uploads directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Create the main app
app = FastAPI(title="NSTU Property Tax Manager")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ============== MODELS ==============

class UserCreate(BaseModel):
    username: str
    password: str
    name: str
    role: str = "EMPLOYEE"  # ADMIN or EMPLOYEE
    assigned_area: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    name: str
    role: str
    assigned_area: Optional[str] = None
    created_at: str

class TokenResponse(BaseModel):
    token: str
    user: UserResponse

class DatasetBatchCreate(BaseModel):
    name: str

class DatasetBatchResponse(BaseModel):
    id: str
    name: str
    uploaded_by: str
    uploaded_at: str
    status: str
    total_records: int

class PropertyResponse(BaseModel):
    id: str
    batch_id: str
    property_id: str
    old_property_id: Optional[str] = None
    owner_name: str
    mobile: str
    plot_address: str
    colony_name: Optional[str] = None
    total_area: Optional[str] = None
    category: Optional[str] = None
    latitude: Optional[str] = None
    longitude: Optional[str] = None
    area: Optional[str] = None
    assigned_employee_id: Optional[str] = None
    assigned_employee_name: Optional[str] = None
    status: str
    created_at: str

class AssignmentRequest(BaseModel):
    property_ids: List[str]
    employee_id: str

class BulkAssignmentRequest(BaseModel):
    area: str
    employee_id: str

class SurveySubmission(BaseModel):
    respondent_name: str
    respondent_phone: str
    house_number: Optional[str] = None
    tax_number: Optional[str] = None
    remarks: Optional[str] = None
    latitude: float
    longitude: float

class SubmissionResponse(BaseModel):
    id: str
    property_record_id: str
    property_id: str
    employee_id: str
    employee_name: str
    respondent_name: str
    respondent_phone: str
    house_number: Optional[str] = None
    tax_number: Optional[str] = None
    remarks: Optional[str] = None
    latitude: float
    longitude: float
    submitted_at: str
    photos: List[dict]

class DashboardStats(BaseModel):
    total_properties: int
    completed: int
    pending: int
    in_progress: int
    flagged: int
    employees: int
    batches: int

class EmployeeProgress(BaseModel):
    employee_id: str
    employee_name: str
    total_assigned: int
    completed: int
    pending: int

# ============== HELPER FUNCTIONS ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7  # 7 days
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

from fastapi import Header

async def get_current_user(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Token required")
    try:
        token = authorization
        if token.startswith("Bearer "):
            token = token[7:]
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ============== AUTH ROUTES ==============

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(data: UserLogin):
    user = await db.users.find_one({"username": data.username}, {"_id": 0})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["role"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "name": user["name"],
            "role": user["role"],
            "assigned_area": user.get("assigned_area"),
            "created_at": user["created_at"]
        }
    }

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "name": current_user["name"],
        "role": current_user["role"],
        "assigned_area": current_user.get("assigned_area"),
        "created_at": current_user["created_at"]
    }

# ============== ADMIN USER ROUTES ==============

@api_router.post("/admin/users", response_model=UserResponse)
async def create_user(data: UserCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    existing = await db.users.find_one({"username": data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user_doc = {
        "id": str(uuid.uuid4()),
        "username": data.username,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "role": data.role,
        "assigned_area": data.assigned_area,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    return {
        "id": user_doc["id"],
        "username": user_doc["username"],
        "name": user_doc["name"],
        "role": user_doc["role"],
        "assigned_area": user_doc["assigned_area"],
        "created_at": user_doc["created_at"]
    }

@api_router.get("/admin/users", response_model=List[UserResponse])
async def list_users(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}

# ============== BATCH UPLOAD ROUTES ==============

@api_router.post("/admin/batch/upload")
async def upload_batch(
    file: UploadFile = File(...),
    batch_name: str = Form(...),
    authorization: str = Form(...)
):
    current_user = await get_current_user(authorization)
    if current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Read file content
    content = await file.read()
    content_str = content.decode('utf-8')
    
    # Parse CSV
    reader = csv.DictReader(io.StringIO(content_str))
    properties = []
    
    for row in reader:
        prop = {
            "id": str(uuid.uuid4()),
            "property_id": row.get("property_id") or row.get("Property ID") or row.get("PropertyID") or str(uuid.uuid4())[:8].upper(),
            "old_property_id": row.get("old_property_id") or row.get("Old Property ID") or None,
            "owner_name": row.get("owner_name") or row.get("Owner Name") or row.get("OwnerName") or "Unknown",
            "mobile": row.get("mobile") or row.get("Mobile") or row.get("Mobile No") or "",
            "plot_address": row.get("plot_address") or row.get("Plot Address") or row.get("Address") or "",
            "colony_name": row.get("colony_name") or row.get("Colony Name") or row.get("Colony") or "",
            "total_area": row.get("total_area") or row.get("Total Area") or "",
            "category": row.get("category") or row.get("Category") or "Residential",
            "latitude": row.get("latitude") or row.get("Latitude") or "",
            "longitude": row.get("longitude") or row.get("Longitude") or "",
            "area": row.get("area") or row.get("Area") or row.get("Zone") or "",
            "assigned_employee_id": None,
            "assigned_employee_name": None,
            "status": "Pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        properties.append(prop)
    
    # Create batch
    batch_doc = {
        "id": str(uuid.uuid4()),
        "name": batch_name,
        "uploaded_by": current_user["id"],
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "status": "ACTIVE",
        "total_records": len(properties)
    }
    await db.batches.insert_one(batch_doc)
    
    # Add batch_id to properties and insert
    for prop in properties:
        prop["batch_id"] = batch_doc["id"]
    
    if properties:
        await db.properties.insert_many(properties)
    
    return {
        "batch_id": batch_doc["id"],
        "name": batch_doc["name"],
        "total_records": len(properties),
        "message": f"Successfully uploaded {len(properties)} properties"
    }

@api_router.get("/admin/batches", response_model=List[DatasetBatchResponse])
async def list_batches(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    batches = await db.batches.find({"status": {"$ne": "DELETED"}}, {"_id": 0}).to_list(100)
    return batches

@api_router.post("/admin/batch/{batch_id}/archive")
async def archive_batch(batch_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.batches.update_one(
        {"id": batch_id},
        {"$set": {"status": "ARCHIVED"}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Batch not found")
    return {"message": "Batch archived"}

@api_router.delete("/admin/batch/{batch_id}")
async def delete_batch(batch_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Delete all properties in batch
    await db.properties.delete_many({"batch_id": batch_id})
    # Delete submissions
    await db.submissions.delete_many({"batch_id": batch_id})
    # Delete batch
    await db.batches.delete_one({"id": batch_id})
    
    return {"message": "Batch and all related data deleted"}

# ============== PROPERTY ROUTES ==============

@api_router.get("/admin/properties")
async def list_properties(
    batch_id: Optional[str] = None,
    area: Optional[str] = None,
    status: Optional[str] = None,
    employee_id: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if batch_id:
        query["batch_id"] = batch_id
    if area:
        query["area"] = area
    if status:
        query["status"] = status
    if employee_id:
        query["assigned_employee_id"] = employee_id
    if search:
        query["$or"] = [
            {"property_id": {"$regex": search, "$options": "i"}},
            {"owner_name": {"$regex": search, "$options": "i"}},
            {"mobile": {"$regex": search, "$options": "i"}}
        ]
    
    skip = (page - 1) * limit
    total = await db.properties.count_documents(query)
    properties = await db.properties.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    
    return {
        "properties": properties,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

@api_router.post("/admin/assign")
async def assign_properties(data: AssignmentRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    employee = await db.users.find_one({"id": data.employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    result = await db.properties.update_many(
        {"id": {"$in": data.property_ids}},
        {"$set": {
            "assigned_employee_id": data.employee_id,
            "assigned_employee_name": employee["name"]
        }}
    )
    
    return {"message": f"Assigned {result.modified_count} properties to {employee['name']}"}

@api_router.post("/admin/assign-bulk")
async def bulk_assign_by_area(data: BulkAssignmentRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    employee = await db.users.find_one({"id": data.employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    result = await db.properties.update_many(
        {"area": data.area, "assigned_employee_id": None},
        {"$set": {
            "assigned_employee_id": data.employee_id,
            "assigned_employee_name": employee["name"]
        }}
    )
    
    # Update employee's assigned area
    await db.users.update_one(
        {"id": data.employee_id},
        {"$set": {"assigned_area": data.area}}
    )
    
    return {"message": f"Assigned {result.modified_count} properties in area {data.area} to {employee['name']}"}

@api_router.get("/admin/areas")
async def list_areas(authorization: str = None):
    current_user = await get_current_user(authorization)
    if current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    areas = await db.properties.distinct("area")
    areas = [a for a in areas if a]  # Filter out empty values
    return {"areas": areas}

# ============== DASHBOARD ROUTES ==============

@api_router.get("/admin/dashboard", response_model=DashboardStats)
async def admin_dashboard(authorization: str = None):
    current_user = await get_current_user(authorization)
    if current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    total = await db.properties.count_documents({})
    completed = await db.properties.count_documents({"status": "Completed"})
    pending = await db.properties.count_documents({"status": "Pending"})
    in_progress = await db.properties.count_documents({"status": "In Progress"})
    flagged = await db.properties.count_documents({"status": "Flagged"})
    employees = await db.users.count_documents({"role": "EMPLOYEE"})
    batches = await db.batches.count_documents({"status": "ACTIVE"})
    
    return {
        "total_properties": total,
        "completed": completed,
        "pending": pending,
        "in_progress": in_progress,
        "flagged": flagged,
        "employees": employees,
        "batches": batches
    }

@api_router.get("/admin/employee-progress", response_model=List[EmployeeProgress])
async def get_employee_progress(authorization: str = None):
    current_user = await get_current_user(authorization)
    if current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    employees = await db.users.find({"role": "EMPLOYEE"}, {"_id": 0}).to_list(100)
    progress = []
    
    for emp in employees:
        total = await db.properties.count_documents({"assigned_employee_id": emp["id"]})
        completed = await db.properties.count_documents({
            "assigned_employee_id": emp["id"],
            "status": "Completed"
        })
        progress.append({
            "employee_id": emp["id"],
            "employee_name": emp["name"],
            "total_assigned": total,
            "completed": completed,
            "pending": total - completed
        })
    
    return progress

# ============== SUBMISSIONS ROUTES ==============

@api_router.get("/admin/submissions")
async def list_submissions(
    batch_id: Optional[str] = None,
    employee_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    authorization: str = None
):
    current_user = await get_current_user(authorization)
    if current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if batch_id:
        query["batch_id"] = batch_id
    if employee_id:
        query["employee_id"] = employee_id
    if date_from:
        query["submitted_at"] = {"$gte": date_from}
    if date_to:
        if "submitted_at" in query:
            query["submitted_at"]["$lte"] = date_to
        else:
            query["submitted_at"] = {"$lte": date_to}
    
    skip = (page - 1) * limit
    total = await db.submissions.count_documents(query)
    submissions = await db.submissions.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    
    return {
        "submissions": submissions,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

# ============== EXPORT ROUTES ==============

@api_router.get("/admin/export")
async def export_data(
    batch_id: Optional[str] = None,
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    authorization: str = None
):
    current_user = await get_current_user(authorization)
    if current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if batch_id:
        query["batch_id"] = batch_id
    if employee_id:
        query["assigned_employee_id"] = employee_id
    if status:
        query["status"] = status
    
    properties = await db.properties.find(query, {"_id": 0}).to_list(100000)
    
    # Create workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Property Survey Data"
    
    # Header style
    header_fill = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)
    
    # Headers
    headers = [
        "Property ID", "Owner Name", "Mobile", "Plot Address", "Colony", 
        "Total Area", "Category", "Area/Zone", "Assigned Employee", "Status",
        "Survey - Respondent Name", "Survey - Phone", "Survey - House No",
        "Survey - Tax No", "Survey - Remarks", "GPS Latitude", "GPS Longitude",
        "Submission Date", "Photo URLs"
    ]
    
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")
    
    # Data rows
    for row_idx, prop in enumerate(properties, 2):
        # Get submission if exists
        submission = await db.submissions.find_one(
            {"property_record_id": prop["id"]}, 
            {"_id": 0}
        )
        
        ws.cell(row=row_idx, column=1, value=prop.get("property_id", ""))
        ws.cell(row=row_idx, column=2, value=prop.get("owner_name", ""))
        ws.cell(row=row_idx, column=3, value=prop.get("mobile", ""))
        ws.cell(row=row_idx, column=4, value=prop.get("plot_address", ""))
        ws.cell(row=row_idx, column=5, value=prop.get("colony_name", ""))
        ws.cell(row=row_idx, column=6, value=prop.get("total_area", ""))
        ws.cell(row=row_idx, column=7, value=prop.get("category", ""))
        ws.cell(row=row_idx, column=8, value=prop.get("area", ""))
        ws.cell(row=row_idx, column=9, value=prop.get("assigned_employee_name", ""))
        ws.cell(row=row_idx, column=10, value=prop.get("status", ""))
        
        if submission:
            ws.cell(row=row_idx, column=11, value=submission.get("respondent_name", ""))
            ws.cell(row=row_idx, column=12, value=submission.get("respondent_phone", ""))
            ws.cell(row=row_idx, column=13, value=submission.get("house_number", ""))
            ws.cell(row=row_idx, column=14, value=submission.get("tax_number", ""))
            ws.cell(row=row_idx, column=15, value=submission.get("remarks", ""))
            ws.cell(row=row_idx, column=16, value=submission.get("latitude", ""))
            ws.cell(row=row_idx, column=17, value=submission.get("longitude", ""))
            ws.cell(row=row_idx, column=18, value=submission.get("submitted_at", ""))
            photos = submission.get("photos", [])
            photo_urls = ", ".join([p.get("file_url", "") for p in photos])
            ws.cell(row=row_idx, column=19, value=photo_urls)
    
    # Adjust column widths
    for col in ws.columns:
        max_length = 0
        column = col[0].column_letter
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = min(max_length + 2, 50)
        ws.column_dimensions[column].width = adjusted_width
    
    # Save to file
    export_path = UPLOAD_DIR / f"export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    wb.save(export_path)
    
    return FileResponse(
        path=str(export_path),
        filename=f"property_survey_export_{datetime.now().strftime('%Y%m%d')}.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

# ============== EMPLOYEE ROUTES ==============

@api_router.get("/employee/properties")
async def get_employee_properties(
    search: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    authorization: str = None
):
    current_user = await get_current_user(authorization)
    
    query = {"assigned_employee_id": current_user["id"]}
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"property_id": {"$regex": search, "$options": "i"}},
            {"owner_name": {"$regex": search, "$options": "i"}},
            {"mobile": {"$regex": search, "$options": "i"}}
        ]
    
    skip = (page - 1) * limit
    total = await db.properties.count_documents(query)
    properties = await db.properties.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    
    return {
        "properties": properties,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

@api_router.get("/employee/property/{property_id}")
async def get_property_detail(property_id: str, authorization: str = None):
    current_user = await get_current_user(authorization)
    
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    
    # Check if employee has access
    if current_user["role"] != "ADMIN" and prop.get("assigned_employee_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get existing submission if any
    submission = await db.submissions.find_one({"property_record_id": property_id}, {"_id": 0})
    
    return {
        "property": prop,
        "submission": submission
    }

@api_router.post("/employee/submit/{property_id}")
async def submit_survey(
    property_id: str,
    respondent_name: str = Form(...),
    respondent_phone: str = Form(...),
    house_number: str = Form(None),
    tax_number: str = Form(None),
    remarks: str = Form(None),
    latitude: float = Form(...),
    longitude: float = Form(...),
    house_photo: UploadFile = File(...),
    gate_photo: UploadFile = File(...),
    extra_photos: List[UploadFile] = File(default=[]),
    authorization: str = Form(...)
):
    current_user = await get_current_user(authorization)
    
    # Get property
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if current_user["role"] != "ADMIN" and prop.get("assigned_employee_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Save photos
    photos = []
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # House photo
    house_filename = f"{property_id}_house_{timestamp}{Path(house_photo.filename).suffix}"
    house_path = UPLOAD_DIR / house_filename
    async with aiofiles.open(house_path, 'wb') as f:
        content = await house_photo.read()
        await f.write(content)
    photos.append({"photo_type": "HOUSE", "file_url": f"/api/uploads/{house_filename}"})
    
    # Gate photo
    gate_filename = f"{property_id}_gate_{timestamp}{Path(gate_photo.filename).suffix}"
    gate_path = UPLOAD_DIR / gate_filename
    async with aiofiles.open(gate_path, 'wb') as f:
        content = await gate_photo.read()
        await f.write(content)
    photos.append({"photo_type": "GATE", "file_url": f"/api/uploads/{gate_filename}"})
    
    # Extra photos
    for idx, photo in enumerate(extra_photos):
        if photo.filename:
            extra_filename = f"{property_id}_extra{idx}_{timestamp}{Path(photo.filename).suffix}"
            extra_path = UPLOAD_DIR / extra_filename
            async with aiofiles.open(extra_path, 'wb') as f:
                content = await photo.read()
                await f.write(content)
            photos.append({"photo_type": "EXTRA", "file_url": f"/api/uploads/{extra_filename}"})
    
    # Create submission
    submission_doc = {
        "id": str(uuid.uuid4()),
        "property_record_id": property_id,
        "property_id": prop["property_id"],
        "batch_id": prop["batch_id"],
        "employee_id": current_user["id"],
        "employee_name": current_user["name"],
        "respondent_name": respondent_name,
        "respondent_phone": respondent_phone,
        "house_number": house_number,
        "tax_number": tax_number,
        "remarks": remarks,
        "latitude": latitude,
        "longitude": longitude,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "photos": photos
    }
    
    # Check if submission already exists
    existing = await db.submissions.find_one({"property_record_id": property_id})
    if existing:
        await db.submissions.update_one(
            {"property_record_id": property_id},
            {"$set": submission_doc}
        )
    else:
        await db.submissions.insert_one(submission_doc)
    
    # Update property status
    await db.properties.update_one(
        {"id": property_id},
        {"$set": {"status": "Completed"}}
    )
    
    return {"message": "Survey submitted successfully", "submission_id": submission_doc["id"]}

@api_router.post("/employee/flag/{property_id}")
async def flag_property(property_id: str, remarks: str = Form(...), authorization: str = Form(...)):
    current_user = await get_current_user(authorization)
    
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if current_user["role"] != "ADMIN" and prop.get("assigned_employee_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.properties.update_one(
        {"id": property_id},
        {"$set": {"status": "Flagged", "flag_remarks": remarks}}
    )
    
    return {"message": "Property flagged successfully"}

@api_router.get("/employee/progress")
async def get_employee_own_progress(authorization: str = None):
    current_user = await get_current_user(authorization)
    
    total = await db.properties.count_documents({"assigned_employee_id": current_user["id"]})
    completed = await db.properties.count_documents({
        "assigned_employee_id": current_user["id"],
        "status": "Completed"
    })
    pending = await db.properties.count_documents({
        "assigned_employee_id": current_user["id"],
        "status": "Pending"
    })
    flagged = await db.properties.count_documents({
        "assigned_employee_id": current_user["id"],
        "status": "Flagged"
    })
    
    return {
        "total_assigned": total,
        "completed": completed,
        "pending": pending,
        "flagged": flagged
    }

# ============== FILE SERVING ==============

@api_router.get("/uploads/{filename}")
async def serve_upload(filename: str):
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(file_path))

# ============== INITIALIZATION ==============

@api_router.get("/")
async def root():
    return {"message": "NSTU Property Tax Manager API"}

@api_router.post("/init-admin")
async def init_admin():
    """Initialize default admin user if not exists"""
    existing = await db.users.find_one({"username": "admin"})
    if existing:
        return {"message": "Admin already exists"}
    
    admin_doc = {
        "id": str(uuid.uuid4()),
        "username": "admin",
        "password_hash": hash_password("admin123"),
        "name": "Super Admin",
        "role": "ADMIN",
        "assigned_area": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(admin_doc)
    return {"message": "Admin user created", "username": "admin", "password": "admin123"}

# Include the router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
