# Bills Router - PDF Bills Management
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
from typing import Optional
import uuid
from datetime import datetime, timezone
import math
import re
import fitz  # PyMuPDF
import aiofiles

router = APIRouter(prefix="/admin/bills", tags=["Bills"])

# These will be injected from main app
db = None
UPLOAD_DIR = None
ADMIN_ROLES = None
ADMIN_VIEW_ROLES = None
get_current_user = None

def init_router(database, upload_dir, admin_roles, admin_view_roles, current_user_func):
    global db, UPLOAD_DIR, ADMIN_ROLES, ADMIN_VIEW_ROLES, get_current_user
    db = database
    UPLOAD_DIR = upload_dir
    ADMIN_ROLES = admin_roles
    ADMIN_VIEW_ROLES = admin_view_roles
    get_current_user = current_user_func

# Helper function to extract bill data from PDF text
def extract_bill_data(text: str, page_num: int) -> dict:
    """Extract structured bill data from PDF page text"""
    
    def find_value(patterns, text, default=""):
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
            if match:
                return match.group(1).strip()
        return default
    
    # Extract coordinates (latitude : longitude format)
    coords_match = re.search(r'(\d+\.\d+)\s*:\s*(\d+\.\d+)', text)
    latitude = float(coords_match.group(1)) if coords_match else None
    longitude = float(coords_match.group(2)) if coords_match else None
    
    bill_data = {
        "bill_sr_no": find_value([r'Bill\s*Sr\s*No[:\s]*(\d+)', r'BillSrNo[:\s]*(\d+)'], text),
        "property_id": find_value([r'Property\s*Id[:\s]*([A-Z0-9]+)', r'PropertyId[:\s]*([A-Z0-9]+)'], text),
        "old_property_id": find_value([r'Old\s*Property\s*Id[:\s]*([A-Z0-9/-]+)', r'OldPropertyId[:\s]*([A-Z0-9/-]+)'], text),
        "financial_year": find_value([r'Financial\s*Year[:\s]*(\d{4}-\d{2,4})', r'FY[:\s]*(\d{4}-\d{2,4})'], text, "2025-26"),
        "print_date": find_value([r'Print\s*Date[:\s]*([0-9/\-]+)', r'Date[:\s]*([0-9/\-]+)'], text),
        "latitude": latitude,
        "longitude": longitude,
        "mobile": find_value([r'Mobile\s*No[:\s]*(\d{10})', r'Mobile[:\s]*(\d{10})', r'Phone[:\s]*(\d{10})'], text),
        "colony": find_value([r'Colony\s*Name[:\s]*([^\n]+)', r'Colony[:\s]*([^\n]+)'], text),
        "owner_name": find_value([r'Owner\s*Name[:\s]*([^\n]+)', r'Owner[:\s]*([^\n]+)'], text),
        "plot_address": find_value([r'Plot\s*Address[:\s]*([^\n]+)', r'Address[:\s]*([^\n]+)'], text),
        "permanent_address": find_value([r'Permanent\s*Address[:\s]*([^\n]+)'], text),
        "total_area": find_value([r'Total\s*Area[:\s]*([0-9.]+\s*SqYard)', r'Area[:\s]*([0-9.]+)'], text),
        "category": find_value([r'Category[:\s]*([^\n,]+)', r'Type[:\s]*([^\n,]+)'], text),
        "authorized_status": find_value([r'Authorized\s*Status[:\s]*([^\n]+)'], text),
        "total_outstanding": find_value([r'Total\s*Outstanding[:\s]*Rs?\.?\s*([0-9,.-]+)', r'Outstanding[:\s]*Rs?\.?\s*([0-9,.-]+)'], text),
        "property_tax_outstanding": find_value([r'Property\s*&?\s*Fire\s*Tax\s*Outstanding[:\s]*Rs?\.?\s*([0-9,.-]+)'], text),
        "page_number": page_num
    }
    
    return bill_data

# Calculate distance between two GPS points (Haversine formula)
def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

# Sort bills by GPS route (nearest neighbor algorithm)
def sort_by_gps_route(bills: list) -> list:
    if not bills:
        return bills
    
    # Filter bills with valid GPS
    valid_bills = [b for b in bills if b.get('latitude') and b.get('longitude')]
    no_gps_bills = [b for b in bills if not b.get('latitude') or not b.get('longitude')]
    
    if not valid_bills:
        return bills
    
    # Start from the first bill
    sorted_bills = [valid_bills[0]]
    remaining = valid_bills[1:]
    
    while remaining:
        last = sorted_bills[-1]
        last_lat, last_lon = last['latitude'], last['longitude']
        
        # Find nearest neighbor
        nearest_idx = 0
        nearest_dist = float('inf')
        
        for i, bill in enumerate(remaining):
            dist = haversine_distance(last_lat, last_lon, bill['latitude'], bill['longitude'])
            if dist < nearest_dist:
                nearest_dist = dist
                nearest_idx = i
        
        sorted_bills.append(remaining.pop(nearest_idx))
    
    # Add bills without GPS at the end
    sorted_bills.extend(no_gps_bills)
    
    return sorted_bills

@router.post("/upload-pdf")
async def upload_pdf_bills(
    file: UploadFile = File(...),
    batch_name: str = Form(...),
    authorization: str = Form(...)
):
    """Upload multi-page PDF and extract bill data from each page"""
    current_user = await get_current_user(authorization)
    if current_user["role"] not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Please upload a PDF file")
    
    # Save uploaded PDF
    content = await file.read()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    pdf_filename = f"bills_{timestamp}.pdf"
    pdf_path = UPLOAD_DIR / pdf_filename
    
    async with aiofiles.open(pdf_path, 'wb') as f:
        await f.write(content)
    
    # Create batch record
    batch_id = str(uuid.uuid4())
    batch_doc = {
        "id": batch_id,
        "name": batch_name,
        "type": "PDF_BILLS",
        "pdf_filename": pdf_filename,
        "pdf_url": f"/api/uploads/{pdf_filename}",
        "uploaded_by": current_user["id"],
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "status": "ACTIVE",
        "total_records": 0
    }
    
    # Extract text from each page using PyMuPDF
    bills = []
    try:
        pdf_doc = fitz.open(str(pdf_path))
        
        for page_num in range(len(pdf_doc)):
            page = pdf_doc[page_num]
            text = page.get_text()
            
            # Extract bill data
            bill_data = extract_bill_data(text, page_num + 1)
            bill_data["id"] = str(uuid.uuid4())
            bill_data["batch_id"] = batch_id
            bill_data["serial_number"] = page_num + 1
            bill_data["created_at"] = datetime.now(timezone.utc).isoformat()
            bill_data["status"] = "Pending"
            
            bills.append(bill_data)
        
        pdf_doc.close()
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")
    
    # Insert bills into database
    if bills:
        await db.bills.insert_many(bills)
        batch_doc["total_records"] = len(bills)
    
    await db.batches.insert_one(batch_doc)
    
    # Get unique colonies
    colonies = list(set([b.get("colony", "").strip() for b in bills if b.get("colony")]))
    
    return {
        "batch_id": batch_id,
        "name": batch_name,
        "total_bills": len(bills),
        "colonies": colonies,
        "message": f"Successfully extracted {len(bills)} bills from PDF"
    }

@router.get("")
async def list_bills(
    batch_id: Optional[str] = None,
    colony: Optional[str] = None,
    status: Optional[str] = None,
    sorted_by_route: bool = False,
    page: int = 1,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get bills with optional filtering"""
    if current_user["role"] not in ADMIN_VIEW_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if batch_id and batch_id.strip():
        query["batch_id"] = batch_id
    if colony and colony.strip():
        query["colony"] = {"$regex": colony, "$options": "i"}
    if status and status.strip():
        query["status"] = status
    
    skip = (page - 1) * limit
    total = await db.bills.count_documents(query)
    bills = await db.bills.find(query, {"_id": 0}).sort("serial_number", 1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "bills": bills,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

@router.get("/colonies")
async def get_bill_colonies(
    batch_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get unique colonies from bills"""
    if current_user["role"] not in ADMIN_VIEW_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if batch_id and batch_id.strip():
        query["batch_id"] = batch_id
    
    colonies = await db.bills.distinct("colony", query)
    colonies = [c for c in colonies if c and c.strip()]
    
    return {"colonies": sorted(colonies)}

@router.put("/{bill_id}")
async def update_bill(
    bill_id: str,
    current_user: dict = Depends(get_current_user),
    owner_name: str = Form(None),
    mobile: str = Form(None),
    plot_address: str = Form(None),
    permanent_address: str = Form(None),
    category: str = Form(None),
    total_area: str = Form(None),
    total_outstanding: str = Form(None),
    colony: str = Form(None)
):
    """Edit bill data"""
    if current_user["role"] not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    bill = await db.bills.find_one({"id": bill_id})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if owner_name is not None:
        update_data["owner_name"] = owner_name
    if mobile is not None:
        update_data["mobile"] = mobile
    if plot_address is not None:
        update_data["plot_address"] = plot_address
    if permanent_address is not None:
        update_data["permanent_address"] = permanent_address
    if category is not None:
        update_data["category"] = category
    if total_area is not None:
        update_data["total_area"] = total_area
    if total_outstanding is not None:
        update_data["total_outstanding"] = total_outstanding
    if colony is not None:
        update_data["colony"] = colony
    
    await db.bills.update_one({"id": bill_id}, {"$set": update_data})
    
    return {"message": "Bill updated successfully"}

@router.post("/arrange-by-route")
async def arrange_bills_by_route(
    batch_id: str = Form(None),
    colony: str = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Arrange bills by GPS route and assign new serial numbers"""
    if current_user["role"] not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if batch_id and batch_id.strip():
        query["batch_id"] = batch_id
    if colony and colony.strip():
        query["colony"] = {"$regex": colony, "$options": "i"}
    
    # Get all matching bills
    bills = await db.bills.find(query, {"_id": 0}).to_list(None)
    
    if not bills:
        raise HTTPException(status_code=404, detail="No bills found")
    
    # Sort by GPS route
    sorted_bills = sort_by_gps_route(bills)
    
    # Update serial numbers in database
    for i, bill in enumerate(sorted_bills):
        await db.bills.update_one(
            {"id": bill["id"]},
            {"$set": {"serial_number": i + 1, "route_ordered": True}}
        )
    
    return {
        "message": f"Arranged {len(sorted_bills)} bills by GPS route",
        "total_arranged": len(sorted_bills)
    }

@router.post("/delete-all")
async def delete_all_bills(
    batch_id: str = Form(None),
    colony: str = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Delete all bills matching the given filters"""
    if current_user["role"] not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if batch_id and batch_id.strip():
        query["batch_id"] = batch_id
    if colony and colony.strip():
        query["colony"] = {"$regex": colony, "$options": "i"}
    
    count = await db.bills.count_documents(query)
    
    if count == 0:
        return {"message": "No bills found to delete", "deleted_count": 0}
    
    result = await db.bills.delete_many(query)
    
    # Update batch record counts if batch_id specified
    if batch_id and batch_id.strip():
        remaining = await db.bills.count_documents({"batch_id": batch_id})
        await db.batches.update_one(
            {"id": batch_id},
            {"$set": {"total_records": remaining}}
        )
        if remaining == 0:
            await db.batches.delete_one({"id": batch_id})
    
    return {
        "message": f"Successfully deleted {result.deleted_count} bills",
        "deleted_count": result.deleted_count
    }

@router.post("/copy-to-properties")
async def copy_bills_to_properties(
    batch_id: str = Form(None),
    colony: str = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Copy bill data to properties collection"""
    if current_user["role"] not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if batch_id and batch_id.strip():
        query["batch_id"] = batch_id
    if colony and colony.strip():
        query["colony"] = {"$regex": colony, "$options": "i"}
    
    bills = await db.bills.find(query, {"_id": 0}).sort("serial_number", 1).to_list(None)
    
    if not bills:
        raise HTTPException(status_code=404, detail="No bills found to copy")
    
    # Create a new batch for properties
    prop_batch_id = str(uuid.uuid4())
    prop_batch_name = f"Bills Import {colony or 'All'} - {datetime.now().strftime('%d/%m/%Y %H:%M')}"
    
    prop_batch_doc = {
        "id": prop_batch_id,
        "name": prop_batch_name,
        "uploaded_by": current_user["id"],
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "status": "ACTIVE",
        "total_records": len(bills),
        "source": "PDF_BILLS"
    }
    await db.batches.insert_one(prop_batch_doc)
    
    # Convert bills to properties
    properties = []
    for i, bill in enumerate(bills):
        prop = {
            "id": str(uuid.uuid4()),
            "batch_id": prop_batch_id,
            "serial_number": i + 1,
            "property_id": bill.get("property_id", str(uuid.uuid4())[:8].upper()),
            "old_property_id": bill.get("old_property_id", ""),
            "owner_name": bill.get("owner_name", "Unknown"),
            "mobile": bill.get("mobile", ""),
            "address": bill.get("plot_address", ""),
            "colony": bill.get("colony", ""),
            "ward": bill.get("colony", ""),
            "latitude": bill.get("latitude"),
            "longitude": bill.get("longitude"),
            "total_area": bill.get("total_area", ""),
            "category": bill.get("category", ""),
            "amount": bill.get("total_outstanding", "0"),
            "financial_year": bill.get("financial_year", "2025-2026"),
            "assigned_employee_id": None,
            "assigned_employee_name": None,
            "status": "Pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "source_bill_id": bill.get("id")
        }
        properties.append(prop)
    
    if properties:
        await db.properties.insert_many(properties)
    
    return {
        "message": f"Successfully added {len(properties)} bills to properties",
        "batch_id": prop_batch_id,
        "batch_name": prop_batch_name,
        "total_added": len(properties)
    }

@router.get("/map-data")
async def get_bills_map_data(
    batch_id: Optional[str] = None,
    colony: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get bill data for map display"""
    if current_user["role"] not in ADMIN_VIEW_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if batch_id and batch_id.strip():
        query["batch_id"] = batch_id
    if colony and colony.strip():
        query["colony"] = {"$regex": colony, "$options": "i"}
    
    query["latitude"] = {"$ne": None}
    query["longitude"] = {"$ne": None}
    
    bills = await db.bills.find(query, {
        "_id": 0,
        "id": 1,
        "serial_number": 1,
        "property_id": 1,
        "owner_name": 1,
        "mobile": 1,
        "colony": 1,
        "latitude": 1,
        "longitude": 1,
        "total_outstanding": 1,
        "category": 1
    }).sort("serial_number", 1).to_list(None)
    
    return {
        "bills": bills,
        "total": len(bills)
    }

@router.delete("/batch/{batch_id}")
async def delete_bill_batch(batch_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a bill batch and all its bills"""
    if current_user["role"] not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.bills.delete_many({"batch_id": batch_id})
    await db.batches.delete_one({"id": batch_id})
    
    return {"message": f"Deleted batch and {result.deleted_count} bills"}
