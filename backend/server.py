from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Query, Header, Request
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
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from bson import ObjectId
import aiofiles
import csv
import io
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill
import json
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from PIL import Image as PILImage, ImageDraw, ImageFont
import tempfile

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

# Role options: ADMIN, SURVEYOR, SUPERVISOR, MC_OFFICER
class UserCreate(BaseModel):
    username: str
    password: str
    name: str
    role: str = "SURVEYOR"  # ADMIN, SURVEYOR, SUPERVISOR, MC_OFFICER
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
    owner_name: str
    mobile: str
    address: str
    total_area: Optional[str] = None
    amount: Optional[str] = None
    ward: Optional[str] = None
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

class SubmissionApproval(BaseModel):
    submission_id: str
    action: str  # APPROVE or REJECT
    remarks: Optional[str] = None

class DashboardStats(BaseModel):
    total_properties: int
    completed: int
    pending: int
    in_progress: int
    rejected: int
    employees: int
    batches: int
    today_completed: int
    today_wards: int

class EmployeeProgress(BaseModel):
    employee_id: str
    employee_name: str
    role: str
    total_assigned: int
    completed: int
    pending: int
    today_completed: int
    overall_completed: int

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

def get_today_start():
    """Get the start of today in UTC"""
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)

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
    
    # Parse CSV - New fields: property_id, owner_name, mobile, address, total_area, amount, ward
    reader = csv.DictReader(io.StringIO(content_str))
    properties = []
    
    for row in reader:
        prop = {
            "id": str(uuid.uuid4()),
            "property_id": row.get("property_id") or row.get("Property ID") or row.get("PropertyID") or str(uuid.uuid4())[:8].upper(),
            "owner_name": row.get("owner_name") or row.get("Owner Name") or row.get("OwnerName") or "Unknown",
            "mobile": row.get("mobile") or row.get("Mobile") or row.get("Mobile No") or "",
            "address": row.get("address") or row.get("Address") or row.get("plot_address") or "",
            "total_area": row.get("total_area") or row.get("Total Area") or "",
            "amount": row.get("amount") or row.get("Amount") or row.get("category") or "",
            "ward": row.get("ward") or row.get("Ward") or row.get("area") or "",
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
    
    await db.properties.delete_many({"batch_id": batch_id})
    await db.submissions.delete_many({"batch_id": batch_id})
    await db.batches.delete_one({"id": batch_id})
    
    return {"message": "Batch and all related data deleted"}

# ============== PROPERTY ROUTES ==============

@api_router.get("/admin/properties")
async def list_properties(
    batch_id: Optional[str] = None,
    ward: Optional[str] = None,
    status: Optional[str] = None,
    employee_id: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] not in ADMIN_VIEW_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if batch_id and batch_id.strip():
        query["batch_id"] = batch_id
    if ward and ward.strip():
        query["ward"] = ward
    if status and status.strip():
        query["status"] = status
    if employee_id and employee_id.strip():
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
    if current_user["role"] not in ADMIN_ROLES:
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
async def bulk_assign_by_ward(data: BulkAssignmentRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    employee = await db.users.find_one({"id": data.employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    result = await db.properties.update_many(
        {"ward": data.area, "assigned_employee_id": None},
        {"$set": {
            "assigned_employee_id": data.employee_id,
            "assigned_employee_name": employee["name"]
        }}
    )
    
    await db.users.update_one(
        {"id": data.employee_id},
        {"$set": {"assigned_area": data.area}}
    )
    
    return {"message": f"Assigned {result.modified_count} properties in ward {data.area} to {employee['name']}"}

@api_router.get("/admin/wards")
async def list_wards(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    wards = await db.properties.distinct("ward")
    wards = [w for w in wards if w]
    return {"wards": wards}

# ============== DASHBOARD ROUTES ==============

# Roles with admin-level access
ADMIN_ROLES = ["ADMIN", "SUPERVISOR"]
# Roles that can view admin dashboard (including MC_OFFICER with limited access)
ADMIN_VIEW_ROLES = ["ADMIN", "SUPERVISOR", "MC_OFFICER"]

@api_router.get("/admin/dashboard", response_model=DashboardStats)
async def admin_dashboard(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ADMIN_VIEW_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    today_start = get_today_start().isoformat()
    
    total = await db.properties.count_documents({})
    completed = await db.properties.count_documents({"status": "Completed"})
    pending = await db.properties.count_documents({"status": "Pending"})
    in_progress = await db.properties.count_documents({"status": "In Progress"})
    rejected = await db.properties.count_documents({"status": "Rejected"})
    employees = await db.users.count_documents({"role": {"$ne": "ADMIN"}})
    batches = await db.batches.count_documents({"status": "ACTIVE"})
    
    # Today's completed
    today_completed = await db.submissions.count_documents({
        "submitted_at": {"$gte": today_start},
        "status": {"$ne": "Rejected"}
    })
    
    # Today's unique wards (now called "colonies")
    today_submissions = await db.submissions.find(
        {"submitted_at": {"$gte": today_start}},
        {"property_record_id": 1, "_id": 0}
    ).to_list(10000)
    
    today_prop_ids = [s["property_record_id"] for s in today_submissions]
    if today_prop_ids:
        today_wards = await db.properties.distinct("ward", {"id": {"$in": today_prop_ids}})
        today_wards_count = len([w for w in today_wards if w])
    else:
        today_wards_count = 0
    
    return {
        "total_properties": total,
        "completed": completed,
        "pending": pending,
        "in_progress": in_progress,
        "rejected": rejected,
        "employees": employees,
        "batches": batches,
        "today_completed": today_completed,
        "today_wards": today_wards_count
    }

@api_router.get("/admin/employee-progress")
async def get_employee_progress(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ADMIN_VIEW_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    today_start = get_today_start().isoformat()
    
    employees = await db.users.find({"role": {"$ne": "ADMIN"}}, {"_id": 0}).to_list(100)
    progress = []
    
    for emp in employees:
        total = await db.properties.count_documents({"assigned_employee_id": emp["id"]})
        completed = await db.properties.count_documents({
            "assigned_employee_id": emp["id"],
            "status": "Completed"
        })
        
        # Today's completed for this employee
        today_completed = await db.submissions.count_documents({
            "employee_id": emp["id"],
            "submitted_at": {"$gte": today_start},
            "status": {"$ne": "Rejected"}
        })
        
        # Overall completed (all time)
        overall_completed = await db.submissions.count_documents({
            "employee_id": emp["id"],
            "status": {"$ne": "Rejected"}
        })
        
        progress.append({
            "employee_id": emp["id"],
            "employee_name": emp["name"],
            "role": emp["role"],
            "total_assigned": total,
            "completed": completed,
            "pending": total - completed,
            "today_completed": today_completed,
            "overall_completed": overall_completed
        })
    
    return progress

# ============== SUBMISSIONS ROUTES ==============

@api_router.get("/admin/areas")
async def list_areas(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get unique areas/wards from properties
    areas = await db.properties.distinct("ward")
    # Filter out None/empty values and sort
    areas = sorted([a for a in areas if a])
    
    return {"areas": areas}

@api_router.get("/admin/submissions")
async def list_submissions(
    batch_id: Optional[str] = None,
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] not in ADMIN_VIEW_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if batch_id and batch_id.strip():
        query["batch_id"] = batch_id
    if employee_id and employee_id.strip():
        query["employee_id"] = employee_id
    if status and status.strip():
        query["status"] = status
    if date_from:
        query["submitted_at"] = {"$gte": date_from}
    if date_to:
        if "submitted_at" in query:
            query["submitted_at"]["$lte"] = date_to
        else:
            query["submitted_at"] = {"$lte": date_to}
    
    skip = (page - 1) * limit
    total = await db.submissions.count_documents(query)
    submissions = await db.submissions.find(query, {"_id": 0}).sort("submitted_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with property details
    for sub in submissions:
        if sub.get("property_record_id"):
            prop = await db.properties.find_one({"id": sub["property_record_id"]}, {"_id": 0})
            if prop:
                sub["property_owner_name"] = prop.get("owner_name", "")
                sub["property_mobile"] = prop.get("mobile", "")
                sub["property_address"] = prop.get("address", "")
                sub["property_amount"] = prop.get("amount", "")
                sub["property_ward"] = prop.get("ward", "")
    
    return {
        "submissions": submissions,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

@api_router.post("/admin/submissions/approve")
async def approve_reject_submission(data: SubmissionApproval, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    submission = await db.submissions.find_one({"id": data.submission_id}, {"_id": 0})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    if data.action == "REJECT" and not data.remarks:
        raise HTTPException(status_code=400, detail="Remarks are required for rejection")
    
    new_status = "Approved" if data.action == "APPROVE" else "Rejected"
    
    update_data = {
        "status": new_status,
        "reviewed_by": current_user["id"],
        "reviewed_at": datetime.now(timezone.utc).isoformat()
    }
    
    if data.remarks:
        update_data["review_remarks"] = data.remarks
    
    await db.submissions.update_one(
        {"id": data.submission_id},
        {"$set": update_data}
    )
    
    # Update property status
    prop_status = "Completed" if data.action == "APPROVE" else "Rejected"
    await db.properties.update_one(
        {"id": submission["property_record_id"]},
        {"$set": {"status": prop_status}}
    )
    
    return {"message": f"Submission {new_status.lower()}"}

@api_router.put("/admin/submissions/{submission_id}")
async def edit_submission(
    submission_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    data = await request.json()
    
    update_data = {}
    allowed_fields = [
        "new_owner_name", "new_mobile", "receiver_name", "relation",
        "old_property_id", "family_id", "aadhar_number", "ward_number",
        "remarks", "latitude", "longitude"
    ]
    
    for field in allowed_fields:
        if field in data:
            value = data[field]
            # Convert latitude/longitude to float if provided
            if field in ["latitude", "longitude"] and value:
                try:
                    update_data[field] = float(value)
                except ValueError:
                    pass
            else:
                update_data[field] = value
    
    update_data["edited_by"] = current_user["id"]
    update_data["edited_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.submissions.update_one(
        {"id": submission_id},
        {"$set": update_data}
    )
    
    return {"message": "Submission updated"}

@api_router.put("/admin/properties/{property_id}")
async def edit_property(
    property_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    data = await request.json()
    
    update_data = {}
    allowed_fields = [
        "property_id", "owner_name", "mobile", "address", "amount", "ward"
    ]
    
    for field in allowed_fields:
        if field in data and data[field]:
            update_data[field] = data[field]
    
    update_data["edited_by"] = current_user["id"]
    update_data["edited_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.properties.update_one(
        {"id": property_id},
        {"$set": update_data}
    )
    
    return {"message": "Property updated"}

# ============== EXPORT ROUTES ==============

@api_router.get("/admin/export")
async def export_data(
    batch_id: Optional[str] = None,
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if batch_id and batch_id.strip():
        query["batch_id"] = batch_id
    if employee_id and employee_id.strip():
        query["assigned_employee_id"] = employee_id
    if status and status.strip():
        query["status"] = status
    
    properties = await db.properties.find(query, {"_id": 0}).to_list(100000)
    
    wb = Workbook()
    ws = wb.active
    ws.title = "Property Survey Data"
    
    header_fill = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)
    
    headers = [
        "Property ID", "Owner Name", "Mobile", "Address", "Total Area", "Amount", "Ward",
        "Assigned Employee", "Status", "New Owner Name", "New Mobile", "Receiver Name",
        "Relation", "Old Property ID", "Family ID", "Aadhar Number", "Ward Number",
        "GPS Latitude", "GPS Longitude", "Submission Date", "Signature URL", "Photo URLs",
        "Approval Status", "Review Remarks"
    ]
    
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")
    
    for row_idx, prop in enumerate(properties, 2):
        submission = await db.submissions.find_one(
            {"property_record_id": prop["id"]}, 
            {"_id": 0}
        )
        
        ws.cell(row=row_idx, column=1, value=prop.get("property_id", ""))
        ws.cell(row=row_idx, column=2, value=prop.get("owner_name", ""))
        ws.cell(row=row_idx, column=3, value=prop.get("mobile", ""))
        ws.cell(row=row_idx, column=4, value=prop.get("address", ""))
        ws.cell(row=row_idx, column=5, value=prop.get("total_area", ""))
        ws.cell(row=row_idx, column=6, value=prop.get("amount", ""))
        ws.cell(row=row_idx, column=7, value=prop.get("ward", ""))
        ws.cell(row=row_idx, column=8, value=prop.get("assigned_employee_name", ""))
        ws.cell(row=row_idx, column=9, value=prop.get("status", ""))
        
        if submission:
            ws.cell(row=row_idx, column=10, value=submission.get("new_owner_name", ""))
            ws.cell(row=row_idx, column=11, value=submission.get("new_mobile", ""))
            ws.cell(row=row_idx, column=12, value=submission.get("receiver_name", ""))
            ws.cell(row=row_idx, column=13, value=submission.get("relation", ""))
            ws.cell(row=row_idx, column=14, value=submission.get("old_property_id", ""))
            ws.cell(row=row_idx, column=15, value=submission.get("family_id", ""))
            ws.cell(row=row_idx, column=16, value=submission.get("aadhar_number", ""))
            ws.cell(row=row_idx, column=17, value=submission.get("ward_number", ""))
            ws.cell(row=row_idx, column=18, value=submission.get("latitude", ""))
            ws.cell(row=row_idx, column=19, value=submission.get("longitude", ""))
            ws.cell(row=row_idx, column=20, value=submission.get("submitted_at", ""))
            ws.cell(row=row_idx, column=21, value=submission.get("signature_url", ""))
            photos = submission.get("photos", [])
            photo_urls = ", ".join([p.get("file_url", "") for p in photos])
            ws.cell(row=row_idx, column=22, value=photo_urls)
            ws.cell(row=row_idx, column=23, value=submission.get("status", "Pending"))
            ws.cell(row=row_idx, column=24, value=submission.get("review_remarks", ""))
    
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
    
    export_path = UPLOAD_DIR / f"export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    wb.save(export_path)
    
    return FileResponse(
        path=str(export_path),
        filename=f"property_survey_export_{datetime.now().strftime('%Y%m%d')}.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

# Helper function to add watermark to photo
def add_watermark_to_photo(photo_path, latitude, longitude, submitted_at):
    try:
        img = PILImage.open(photo_path)
        draw = ImageDraw.Draw(img)
        
        if isinstance(submitted_at, str):
            try:
                dt = datetime.fromisoformat(submitted_at.replace('Z', '+00:00'))
            except:
                dt = datetime.now()
        else:
            dt = submitted_at or datetime.now()
        
        date_str = dt.strftime("%d/%m/%Y")
        time_str = dt.strftime("%I:%M:%S %p")
        
        watermark_lines = [
            f"Date: {date_str}",
            f"Time: {time_str}",
            f"Lat: {latitude:.6f}" if latitude else "Lat: N/A",
            f"Long: {longitude:.6f}" if longitude else "Long: N/A"
        ]
        
        font_size = max(16, min(img.width, img.height) // 25)
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except:
            font = ImageFont.load_default()
        
        padding = font_size // 2
        line_height = font_size + 5
        
        max_text_width = max([draw.textlength(line, font=font) for line in watermark_lines])
        box_width = int(max_text_width + padding * 2)
        box_height = line_height * len(watermark_lines) + padding * 2
        
        box_x = padding
        box_y = img.height - box_height - padding
        
        overlay = PILImage.new('RGBA', img.size, (0, 0, 0, 0))
        overlay_draw = ImageDraw.Draw(overlay)
        overlay_draw.rectangle(
            [box_x, box_y, box_x + box_width, box_y + box_height],
            fill=(0, 0, 0, 180)
        )
        
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        img = PILImage.alpha_composite(img, overlay)
        draw = ImageDraw.Draw(img)
        
        for i, line in enumerate(watermark_lines):
            draw.text(
                (box_x + padding, box_y + padding + i * line_height),
                line,
                font=font,
                fill=(255, 255, 255, 255)
            )
        
        img = img.convert('RGB')
        
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
        img.save(temp_file.name, 'JPEG', quality=90)
        return temp_file.name
    except Exception as e:
        logger.error(f"Error adding watermark: {e}")
        return photo_path

@api_router.get("/admin/export-pdf")
async def export_pdf(
    batch_id: Optional[str] = None,
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {"status": "Completed"}
    if batch_id and batch_id.strip():
        query["batch_id"] = batch_id
    if employee_id and employee_id.strip():
        query["assigned_employee_id"] = employee_id
    if status and status.strip():
        query["status"] = status
    
    properties = await db.properties.find(query, {"_id": 0}).to_list(10000)
    
    pdf_path = UPLOAD_DIR / f"survey_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        rightMargin=20*mm,
        leftMargin=20*mm,
        topMargin=20*mm,
        bottomMargin=20*mm
    )
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=18, spaceAfter=20, alignment=TA_CENTER, textColor=colors.HexColor('#0f172a'))
    heading_style = ParagraphStyle('CustomHeading', parent=styles['Heading2'], fontSize=14, spaceAfter=10, textColor=colors.HexColor('#1e40af'))
    normal_style = ParagraphStyle('CustomNormal', parent=styles['Normal'], fontSize=10, spaceAfter=5)
    
    story = []
    
    story.append(Paragraph("NSTU Property Tax Survey Report", title_style))
    story.append(Paragraph(f"Generated on: {datetime.now().strftime('%d/%m/%Y %I:%M %p')}", normal_style))
    story.append(Spacer(1, 20))
    
    for prop in properties:
        submission = await db.submissions.find_one({"property_record_id": prop["id"]}, {"_id": 0})
        
        if not submission:
            continue
        
        story.append(Paragraph(f"Property ID: {prop.get('property_id', 'N/A')}", heading_style))
        
        prop_data = [
            ["Owner Name", prop.get("owner_name", "N/A")],
            ["Mobile", prop.get("mobile", "N/A")],
            ["Address", prop.get("address", "N/A")],
            ["Ward", prop.get("ward", "N/A")],
            ["Amount", prop.get("amount", "N/A")],
        ]
        
        prop_table = Table(prop_data, colWidths=[80*mm, 90*mm])
        prop_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f1f5f9')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#0f172a')),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('PADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(prop_table)
        story.append(Spacer(1, 10))
        
        story.append(Paragraph("Survey Information", heading_style))
        survey_data = [
            ["New Owner Name", submission.get("new_owner_name", "N/A")],
            ["New Mobile", submission.get("new_mobile", "N/A")],
            ["Receiver Name", submission.get("receiver_name", "N/A")],
            ["Relation", submission.get("relation", "N/A")],
            ["Old Property ID", submission.get("old_property_id", "N/A")],
            ["Family ID", submission.get("family_id", "N/A")],
            ["Aadhar Number", submission.get("aadhar_number", "N/A")],
            ["Ward Number", submission.get("ward_number", "N/A")],
            ["Submitted By", submission.get("employee_name", "N/A")],
            ["Submitted At", submission.get("submitted_at", "N/A")],
            ["GPS Latitude", str(submission.get("latitude", "N/A"))],
            ["GPS Longitude", str(submission.get("longitude", "N/A"))],
            ["Status", submission.get("status", "Pending")],
        ]
        
        if submission.get("remarks"):
            survey_data.append(["Remarks", submission.get("remarks")])
        
        survey_table = Table(survey_data, colWidths=[80*mm, 90*mm])
        survey_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f1f5f9')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#0f172a')),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('PADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(survey_table)
        story.append(Spacer(1, 15))
        
        photos = submission.get("photos", [])
        if photos:
            story.append(Paragraph("Photo Evidence (with GPS & Timestamp)", heading_style))
            
            for photo in photos:
                photo_url = photo.get("file_url", "")
                photo_type = photo.get("photo_type", "PHOTO")
                
                if photo_url.startswith("/api/uploads/"):
                    filename = photo_url.replace("/api/uploads/", "")
                    photo_path = UPLOAD_DIR / filename
                    
                    if photo_path.exists():
                        watermarked_path = add_watermark_to_photo(
                            str(photo_path),
                            submission.get("latitude"),
                            submission.get("longitude"),
                            submission.get("submitted_at")
                        )
                        
                        try:
                            img = RLImage(watermarked_path, width=80*mm, height=60*mm)
                            story.append(Paragraph(f"<b>{photo_type}</b>", normal_style))
                            story.append(img)
                            story.append(Spacer(1, 10))
                        except Exception as e:
                            logger.error(f"Error adding photo to PDF: {e}")
        
        signature_url = submission.get("signature_url")
        if signature_url:
            story.append(Paragraph("Property Holder Signature", heading_style))
            
            if signature_url.startswith("/api/uploads/"):
                sig_filename = signature_url.replace("/api/uploads/", "")
                sig_path = UPLOAD_DIR / sig_filename
                
                if sig_path.exists():
                    try:
                        sig_img = RLImage(str(sig_path), width=60*mm, height=30*mm)
                        sig_table = Table([[sig_img]], colWidths=[170*mm])
                        sig_table.setStyle(TableStyle([
                            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
                            ('BACKGROUND', (0, 0), (-1, -1), colors.white),
                            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                            ('PADDING', (0, 0), (-1, -1), 10),
                        ]))
                        story.append(sig_table)
                    except Exception as e:
                        logger.error(f"Error adding signature to PDF: {e}")
        
        story.append(PageBreak())
    
    doc.build(story)
    
    return FileResponse(
        path=str(pdf_path),
        filename=f"property_survey_report_{datetime.now().strftime('%Y%m%d')}.pdf",
        media_type="application/pdf"
    )

# ============== EMPLOYEE ROUTES ==============

@api_router.get("/employee/properties")
async def get_employee_properties(
    search: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    query = {"assigned_employee_id": current_user["id"]}
    if status and status.strip():
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
async def get_property_detail(property_id: str, current_user: dict = Depends(get_current_user)):
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if current_user["role"] != "ADMIN" and prop.get("assigned_employee_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    submission = await db.submissions.find_one({"property_record_id": property_id}, {"_id": 0})
    
    return {
        "property": prop,
        "submission": submission
    }

@api_router.post("/employee/submit/{property_id}")
async def submit_survey(
    property_id: str,
    # Survey fields
    new_owner_name: str = Form(...),
    new_mobile: str = Form(...),
    receiver_name: str = Form(...),
    relation: str = Form(...),
    old_property_id: str = Form(None),
    family_id: str = Form(None),
    aadhar_number: str = Form(None),
    ward_number: str = Form(None),
    remarks: str = Form(None),
    self_satisfied: str = Form(None),  # New field: 'yes' or 'no'
    latitude: float = Form(...),
    longitude: float = Form(...),
    house_photo: UploadFile = File(...),
    gate_photo: UploadFile = File(...),
    signature: UploadFile = File(...),
    extra_photos: List[UploadFile] = File(default=[]),
    authorization: str = Form(...)
):
    current_user = await get_current_user(authorization)
    
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if current_user["role"] != "ADMIN" and prop.get("assigned_employee_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
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
    
    # Signature
    signature_filename = f"{property_id}_signature_{timestamp}.png"
    signature_path = UPLOAD_DIR / signature_filename
    async with aiofiles.open(signature_path, 'wb') as f:
        content = await signature.read()
        await f.write(content)
    signature_url = f"/api/uploads/{signature_filename}"
    
    # Extra photos
    for idx, photo in enumerate(extra_photos):
        if photo.filename:
            extra_filename = f"{property_id}_extra{idx}_{timestamp}{Path(photo.filename).suffix}"
            extra_path = UPLOAD_DIR / extra_filename
            async with aiofiles.open(extra_path, 'wb') as f:
                content = await photo.read()
                await f.write(content)
            photos.append({"photo_type": "EXTRA", "file_url": f"/api/uploads/{extra_filename}"})
    
    # Create submission with new fields
    submission_doc = {
        "id": str(uuid.uuid4()),
        "property_record_id": property_id,
        "property_id": prop["property_id"],
        "batch_id": prop["batch_id"],
        "employee_id": current_user["id"],
        "employee_name": current_user["name"],
        # Survey fields
        "new_owner_name": new_owner_name,
        "new_mobile": new_mobile,
        "receiver_name": receiver_name,
        "relation": relation,
        "old_property_id": old_property_id,
        "family_id": family_id,
        "aadhar_number": aadhar_number,
        "ward_number": ward_number,
        "remarks": remarks,
        "self_satisfied": self_satisfied,  # New field
        "latitude": latitude,
        "longitude": longitude,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "photos": photos,
        "signature_url": signature_url,
        "status": "Pending"  # Pending approval
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
    
    # Update property status to In Progress (until approved)
    await db.properties.update_one(
        {"id": property_id},
        {"$set": {"status": "In Progress"}}
    )
    
    return {"message": "Survey submitted successfully", "submission_id": submission_doc["id"]}

@api_router.post("/employee/reject/{property_id}")
async def reject_property(property_id: str, remarks: str = Form(...), authorization: str = Form(...)):
    current_user = await get_current_user(authorization)
    
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if current_user["role"] != "ADMIN" and prop.get("assigned_employee_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.properties.update_one(
        {"id": property_id},
        {"$set": {"status": "Rejected", "reject_remarks": remarks}}
    )
    
    return {"message": "Property rejected"}

@api_router.get("/employee/progress")
async def get_employee_own_progress(current_user: dict = Depends(get_current_user)):
    today_start = get_today_start().isoformat()
    
    total = await db.properties.count_documents({"assigned_employee_id": current_user["id"]})
    completed = await db.properties.count_documents({
        "assigned_employee_id": current_user["id"],
        "status": "Completed"
    })
    pending = await db.properties.count_documents({
        "assigned_employee_id": current_user["id"],
        "status": "Pending"
    })
    rejected = await db.properties.count_documents({
        "assigned_employee_id": current_user["id"],
        "status": "Rejected"
    })
    in_progress = await db.properties.count_documents({
        "assigned_employee_id": current_user["id"],
        "status": "In Progress"
    })
    
    # Today's completed
    today_completed = await db.submissions.count_documents({
        "employee_id": current_user["id"],
        "submitted_at": {"$gte": today_start}
    })
    
    # Total completed (all time)
    total_completed = await db.submissions.count_documents({
        "employee_id": current_user["id"]
    })
    
    return {
        "total_assigned": total,
        "completed": completed,
        "pending": pending,
        "rejected": rejected,
        "in_progress": in_progress,
        "today_completed": today_completed,
        "total_completed": total_completed
    }

# ============== ATTENDANCE ROUTES ==============

@api_router.get("/employee/attendance/today")
async def check_today_attendance(current_user: dict = Depends(get_current_user)):
    """Check if employee has marked attendance today"""
    today_date = get_today_start().strftime("%Y-%m-%d")
    
    attendance = await db.attendance.find_one({
        "employee_id": current_user["id"],
        "date": today_date
    }, {"_id": 0})
    
    return {
        "has_attendance": attendance is not None,
        "attendance": attendance
    }

@api_router.post("/employee/attendance")
async def mark_attendance(
    selfie: UploadFile = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    authorization: str = Form(...)
):
    """Mark one-time daily attendance with selfie"""
    current_user = await get_current_user(authorization)
    today_date = get_today_start().strftime("%Y-%m-%d")
    
    # Check if already marked
    existing = await db.attendance.find_one({
        "employee_id": current_user["id"],
        "date": today_date
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Attendance already marked for today")
    
    # Save selfie
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    selfie_filename = f"attendance_{current_user['id']}_{timestamp}{Path(selfie.filename).suffix}"
    selfie_path = UPLOAD_DIR / selfie_filename
    async with aiofiles.open(selfie_path, 'wb') as f:
        content = await selfie.read()
        await f.write(content)
    
    selfie_url = f"/api/uploads/{selfie_filename}"
    
    # Create attendance record
    attendance_doc = {
        "id": str(uuid.uuid4()),
        "employee_id": current_user["id"],
        "employee_name": current_user["name"],
        "date": today_date,
        "marked_at": datetime.now(timezone.utc).isoformat(),
        "selfie_url": selfie_url,
        "latitude": latitude,
        "longitude": longitude
    }
    
    await db.attendance.insert_one(attendance_doc)
    
    return {
        "message": "Attendance marked successfully",
        "attendance_id": attendance_doc["id"],
        "marked_at": attendance_doc["marked_at"]
    }

@api_router.get("/admin/attendance")
async def get_attendance_records(
    date: Optional[str] = None,
    employee_id: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get attendance records (admin/supervisor only)"""
    if current_user["role"] not in ADMIN_VIEW_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if date:
        query["date"] = date
    if employee_id and employee_id.strip():
        query["employee_id"] = employee_id
    
    skip = (page - 1) * limit
    total = await db.attendance.count_documents(query)
    records = await db.attendance.find(query, {"_id": 0}).sort("marked_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "attendance": records,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
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
