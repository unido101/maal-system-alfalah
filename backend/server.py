"""
BAITUL MAAL AL-FALAH — Internal management system backend.
Masjid Raya Al-Falah Sragen.

Single-file FastAPI app: Auth (JWT email/password + Emergent Google OAuth),
RBAC, and CRUD for Users, Programs, Donors, Donations, Expenses, Tasks,
Briefs, Checklists, plus Dashboard/Finance/Reports aggregations.
"""
import os
import uuid
import io
import csv
import json
import re
import secrets
import logging
from google import genai
from google.genai import types
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import bcrypt
import httpx
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Header, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# --------------------------------------------------------------------------
# Environment / Configuration
# --------------------------------------------------------------------------

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-3.8-flash"

gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

app = FastAPI(title="Baitul Maal Al-Falah API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("baitulmaal")


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:16]}"


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def iso(dt) -> Optional[str]:
    if dt is None:
        return None
    if isinstance(dt, str):
        return dt
    return dt.isoformat()


ROLES = ("manager", "content", "fundraising")


# --------------------------------------------------------------------------
# Models
# --------------------------------------------------------------------------
class UserPublic(BaseModel):
    id: str
    name: str
    email: str
    role: str
    avatar: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "content"


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class SessionInput(BaseModel):
    session_id: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None
    avatar: Optional[str] = None


class ProgramInput(BaseModel):
    name: str
    category: Optional[str] = "Umum"
    description: Optional[str] = ""
    target: float = 0
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    pic_id: Optional[str] = None
    status: str = "Active"


class DonorInput(BaseModel):
    name: str
    phone: Optional[str] = ""
    notes: Optional[str] = ""


class DonationInput(BaseModel):
    donor_id: Optional[str] = None
    donor_name: Optional[str] = None
    donor_phone: Optional[str] = None
    program_id: Optional[str] = None
    date: Optional[str] = None
    type: str = "Sedekah"
    amount: float = 0
    payment_method: str = "Cash"
    payment_status: str = "Paid"
    notes: Optional[str] = ""


class ExpenseInput(BaseModel):
    program_id: Optional[str] = None
    date: Optional[str] = None
    category: str = "Operational"
    description: str = ""
    amount: float = 0
    payment_method: str = "Cash"
    notes: Optional[str] = ""
    receipt: Optional[str] = None


class TaskInput(BaseModel):
    title: str
    description: Optional[str] = ""
    assigned_user_id: Optional[str] = None
    program_id: Optional[str] = None
    category: str = "Feed"
    priority: str = "Medium"
    status: str = "Draft"
    start_date: Optional[str] = None
    deadline: Optional[str] = None


class BriefInput(BaseModel):
    objective: Optional[str] = ""
    target_audience: Optional[str] = ""
    platform: Optional[str] = "Instagram"
    format: Optional[str] = ""
    hook: Optional[str] = ""
    main_content: Optional[str] = ""
    cta: Optional[str] = ""
    reference: Optional[str] = ""
    caption: Optional[str] = ""


class ChecklistItemInput(BaseModel):
    item: str


class ChecklistToggle(BaseModel):
    completed: bool


class StatusUpdate(BaseModel):
    status: str


# --------------------------------------------------------------------------
# Auth dependency
# --------------------------------------------------------------------------
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1].strip()

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < now_utc():
        raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_roles(*roles):
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Akses ditolak untuk peran Anda")
        return user
    return checker


FIN_ROLES = ("manager",)
DONATION_ROLES = ("manager", "fundraising")
PROGRAM_ROLES = ("manager", "fundraising")


async def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "created_at": now_utc(),
        "expires_at": now_utc() + timedelta(days=7),
    })
    return token


def public_user(u: dict) -> dict:
    return {
        "id": u["id"], "name": u.get("name"), "email": u.get("email"),
        "role": u.get("role"), "avatar": u.get("avatar"),
        "created_at": iso(u.get("created_at")), "updated_at": iso(u.get("updated_at")),
    }


# --------------------------------------------------------------------------
# Auth routes
# --------------------------------------------------------------------------
@api.post("/auth/register")
async def register(inp: RegisterInput):
    existing = await db.users.find_one({"email": inp.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    role = inp.role if inp.role in ROLES else "content"
    uid = new_id("user_")
    doc = {
        "id": uid, "name": inp.name, "email": inp.email.lower(),
        "password_hash": hash_password(inp.password), "role": role,
        "avatar": None, "created_at": now_utc(), "updated_at": now_utc(),
    }
    await db.users.insert_one(doc)
    token = await create_session(uid)
    return {"session_token": token, "user": public_user(doc)}


@api.post("/auth/login")
async def login(inp: LoginInput):
    user = await db.users.find_one({"email": inp.email.lower()})
    if not user or not user.get("password_hash") or not verify_password(inp.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email atau kata sandi salah")
    token = await create_session(user["id"])
    return {"session_token": token, "user": public_user(user)}


@api.post("/auth/session")
async def google_session(inp: SessionInput):
    async with httpx.AsyncClient(timeout=20) as hc:
        resp = await hc.get(EMERGENT_AUTH_URL, headers={"X-Session-ID": inp.session_id})
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Sesi tidak valid")
    data = resp.json()
    email = (data.get("email") or "").lower()
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")

    user = await db.users.find_one({"email": email})
    if user:
        uid = user["id"]
        await db.users.update_one({"id": uid}, {"$set": {"avatar": picture, "updated_at": now_utc()}})
        user["avatar"] = picture
    else:
        uid = new_id("user_")
        user = {
            "id": uid, "name": name, "email": email, "password_hash": None,
            "role": "content", "avatar": picture,
            "created_at": now_utc(), "updated_at": now_utc(),
        }
        await db.users.insert_one(user)

    token = await create_session(uid)
    return {"session_token": token, "user": public_user(user)}


@api.get("/auth/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@api.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# --------------------------------------------------------------------------
# Users
# --------------------------------------------------------------------------
@api.get("/users")
async def list_users(user: dict = Depends(get_current_user), q: Optional[str] = None):
    query = {"deleted_at": None}
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(500)
    return [public_user(u) for u in users]


@api.post("/users")
async def create_user(inp: RegisterInput, user: dict = Depends(require_roles("manager"))):
    existing = await db.users.find_one({"email": inp.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    uid = new_id("user_")
    doc = {
        "id": uid, "name": inp.name, "email": inp.email.lower(),
        "password_hash": hash_password(inp.password),
        "role": inp.role if inp.role in ROLES else "content",
        "avatar": None, "deleted_at": None, "created_at": now_utc(), "updated_at": now_utc(),
    }
    await db.users.insert_one(doc)
    return public_user(doc)


@api.put("/users/{uid}")
async def update_user(uid: str, inp: UserUpdate, user: dict = Depends(require_roles("manager"))):
    upd = {"updated_at": now_utc()}
    if inp.name is not None:
        upd["name"] = inp.name
    if inp.role is not None and inp.role in ROLES:
        upd["role"] = inp.role
    if inp.avatar is not None:
        upd["avatar"] = inp.avatar
    if inp.password:
        upd["password_hash"] = hash_password(inp.password)
    await db.users.update_one({"id": uid}, {"$set": upd})
    doc = await db.users.find_one({"id": uid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    return public_user(doc)


@api.delete("/users/{uid}")
async def delete_user(uid: str, user: dict = Depends(require_roles("manager"))):
    if uid == user["id"]:
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus akun sendiri")
    await db.users.update_one({"id": uid}, {"$set": {"deleted_at": now_utc()}})
    return {"ok": True}


# --------------------------------------------------------------------------
# Aggregation helpers
# --------------------------------------------------------------------------
async def program_stats(program_id: str) -> dict:
    donations = await db.donations.find(
        {"program_id": program_id, "payment_status": "Paid", "deleted_at": None}, {"_id": 0}
    ).to_list(5000)
    raised = sum(d.get("amount", 0) for d in donations)
    expenses = await db.expenses.find({"program_id": program_id, "deleted_at": None}, {"_id": 0}).to_list(5000)
    spent = sum(e.get("amount", 0) for e in expenses)
    return {
        "total_raised": raised,
        "total_expenses": spent,
        "remaining_funds": raised - spent,
        "donation_count": len(donations),
    }


async def enrich_program(p: dict) -> dict:
    stats = await program_stats(p["id"])
    target = p.get("target", 0) or 0
    achievement = (stats["total_raised"] / target * 100) if target > 0 else 0
    pic_name = None
    if p.get("pic_id"):
        pic = await db.users.find_one({"id": p["pic_id"]}, {"_id": 0, "name": 1})
        pic_name = pic["name"] if pic else None
    return {
        "id": p["id"], "name": p["name"], "category": p.get("category"),
        "description": p.get("description"), "target": target,
        "start_date": iso(p.get("start_date")), "end_date": iso(p.get("end_date")),
        "pic_id": p.get("pic_id"), "pic_name": pic_name, "status": p.get("status"),
        "created_at": iso(p.get("created_at")),
        "achievement": round(achievement, 1), **stats,
    }


async def enrich_donation(d: dict) -> dict:
    donor_name = None
    if d.get("donor_id"):
        dr = await db.donors.find_one({"id": d["donor_id"]}, {"_id": 0, "name": 1})
        donor_name = dr["name"] if dr else None
    program_name = None
    if d.get("program_id"):
        p = await db.programs.find_one({"id": d["program_id"]}, {"_id": 0, "name": 1})
        program_name = p["name"] if p else None
    return {
        "id": d["id"], "donor_id": d.get("donor_id"), "donor_name": donor_name,
        "program_id": d.get("program_id"), "program_name": program_name,
        "date": iso(d.get("date")), "type": d.get("type"), "amount": d.get("amount"),
        "payment_method": d.get("payment_method"), "payment_status": d.get("payment_status"),
        "notes": d.get("notes"), "created_at": iso(d.get("created_at")),
    }


async def enrich_expense(e: dict) -> dict:
    program_name = None
    if e.get("program_id"):
        p = await db.programs.find_one({"id": e["program_id"]}, {"_id": 0, "name": 1})
        program_name = p["name"] if p else None
    pic_name = None
    if e.get("pic_id"):
        u = await db.users.find_one({"id": e["pic_id"]}, {"_id": 0, "name": 1})
        pic_name = u["name"] if u else None
    return {
        "id": e["id"], "program_id": e.get("program_id"), "program_name": program_name,
        "date": iso(e.get("date")), "category": e.get("category"),
        "description": e.get("description"), "amount": e.get("amount"),
        "payment_method": e.get("payment_method"), "pic_id": e.get("pic_id"),
        "pic_name": pic_name, "notes": e.get("notes"), "receipt": e.get("receipt"),
        "created_at": iso(e.get("created_at")),
    }


async def donor_stats(donor_id: str) -> dict:
    dons = await db.donations.find(
        {"donor_id": donor_id, "payment_status": "Paid", "deleted_at": None}, {"_id": 0}
    ).sort("date", -1).to_list(2000)
    total = sum(d.get("amount", 0) for d in dons)
    last = dons[0]["date"] if dons else None
    return {"total_donations": total, "donation_count": len(dons), "last_donation": iso(last)}


async def enrich_donor(d: dict) -> dict:
    stats = await donor_stats(d["id"])
    return {
        "id": d["id"], "name": d["name"], "phone": d.get("phone"),
        "notes": d.get("notes"), "created_at": iso(d.get("created_at")), **stats,
    }


async def checklist_progress(task_id: str):
    items = await db.checklist_items.find({"task_id": task_id, "deleted_at": None}, {"_id": 0}).to_list(500)
    total = len(items)
    done = sum(1 for i in items if i.get("completed"))
    pct = round(done / total * 100) if total else 0
    return items, total, done, pct


async def enrich_task(t: dict, with_details: bool = False) -> dict:
    assignee = None
    if t.get("assigned_user_id"):
        u = await db.users.find_one({"id": t["assigned_user_id"]}, {"_id": 0, "name": 1, "avatar": 1})
        if u:
            assignee = {"id": t["assigned_user_id"], "name": u.get("name"), "avatar": u.get("avatar")}
    program_name = None
    if t.get("program_id"):
        p = await db.programs.find_one({"id": t["program_id"]}, {"_id": 0, "name": 1})
        program_name = p["name"] if p else None
    items, total, done, pct = await checklist_progress(t["id"])
    result = {
        "id": t["id"], "title": t["title"], "description": t.get("description"),
        "assigned_user_id": t.get("assigned_user_id"), "assignee": assignee,
        "program_id": t.get("program_id"), "program_name": program_name,
        "category": t.get("category"), "priority": t.get("priority"), "status": t.get("status"),
        "start_date": iso(t.get("start_date")), "deadline": iso(t.get("deadline")),
        "created_by": t.get("created_by"), "created_at": iso(t.get("created_at")),
        "checklist_total": total, "checklist_done": done, "checklist_progress": pct,
    }
    if with_details:
        result["checklist"] = [{"id": i["id"], "item": i["item"], "completed": i.get("completed", False),
                                "completed_at": iso(i.get("completed_at"))} for i in items]
        brief = await db.briefs.find_one({"task_id": t["id"]}, {"_id": 0})
        if brief:
            result["brief"] = {k: brief.get(k) for k in
                               ("objective", "target_audience", "platform", "format", "hook",
                                "main_content", "cta", "reference", "caption")}
        else:
            result["brief"] = None
    return result


# --------------------------------------------------------------------------
# Programs
# --------------------------------------------------------------------------
@api.get("/programs")
async def list_programs(user: dict = Depends(get_current_user),
                        q: Optional[str] = None, status: Optional[str] = None):
    query = {"deleted_at": None}
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    if status:
        query["status"] = status
    progs = await db.programs.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [await enrich_program(p) for p in progs]


@api.post("/programs")
async def create_program(inp: ProgramInput, user: dict = Depends(require_roles(*PROGRAM_ROLES))):
    doc = {"id": new_id("prog_"), **inp.dict(), "deleted_at": None, "created_at": now_utc()}
    await db.programs.insert_one(doc)
    return await enrich_program(doc)


@api.get("/programs/{pid}")
async def get_program(pid: str, user: dict = Depends(get_current_user)):
    p = await db.programs.find_one({"id": pid, "deleted_at": None}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Program tidak ditemukan")
    result = await enrich_program(p)
    dons = await db.donations.find({"program_id": pid, "deleted_at": None}, {"_id": 0}).sort("date", -1).to_list(200)
    result["recent_donations"] = [await enrich_donation(d) for d in dons[:20]]
    return result


@api.put("/programs/{pid}")
async def update_program(pid: str, inp: ProgramInput, user: dict = Depends(require_roles(*PROGRAM_ROLES))):
    await db.programs.update_one({"id": pid}, {"$set": inp.dict()})
    p = await db.programs.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Program tidak ditemukan")
    return await enrich_program(p)


@api.delete("/programs/{pid}")
async def delete_program(pid: str, user: dict = Depends(require_roles(*PROGRAM_ROLES))):
    await db.programs.update_one({"id": pid}, {"$set": {"deleted_at": now_utc()}})
    return {"ok": True}


# --------------------------------------------------------------------------
# Donors
# --------------------------------------------------------------------------
@api.get("/donors")
async def list_donors(user: dict = Depends(require_roles(*DONATION_ROLES)), q: Optional[str] = None):
    query = {"deleted_at": None}
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}},
                        {"phone": {"$regex": q, "$options": "i"}}]
    donors = await db.donors.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [await enrich_donor(d) for d in donors]


@api.post("/donors")
async def create_donor(inp: DonorInput, user: dict = Depends(require_roles(*DONATION_ROLES))):
    doc = {"id": new_id("donor_"), **inp.dict(), "deleted_at": None, "created_at": now_utc()}
    await db.donors.insert_one(doc)
    return await enrich_donor(doc)


@api.get("/donors/{did}")
async def get_donor(did: str, user: dict = Depends(require_roles(*DONATION_ROLES))):
    d = await db.donors.find_one({"id": did, "deleted_at": None}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Donatur tidak ditemukan")
    result = await enrich_donor(d)
    dons = await db.donations.find({"donor_id": did, "deleted_at": None}, {"_id": 0}).sort("date", -1).to_list(200)
    result["donations"] = [await enrich_donation(x) for x in dons]
    return result


@api.put("/donors/{did}")
async def update_donor(did: str, inp: DonorInput, user: dict = Depends(require_roles(*DONATION_ROLES))):
    await db.donors.update_one({"id": did}, {"$set": inp.dict()})
    d = await db.donors.find_one({"id": did}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Donatur tidak ditemukan")
    return await enrich_donor(d)


@api.delete("/donors/{did}")
async def delete_donor(did: str, user: dict = Depends(require_roles(*DONATION_ROLES))):
    await db.donors.update_one({"id": did}, {"$set": {"deleted_at": now_utc()}})
    return {"ok": True}


# --------------------------------------------------------------------------
# Donations
# --------------------------------------------------------------------------
@api.get("/donations")
async def list_donations(user: dict = Depends(require_roles(*DONATION_ROLES)),
                         q: Optional[str] = None, program_id: Optional[str] = None,
                         status: Optional[str] = None, type: Optional[str] = None,
                         start: Optional[str] = None, end: Optional[str] = None):
    query = {"deleted_at": None}
    if program_id:
        query["program_id"] = program_id
    if status:
        query["payment_status"] = status
    if type:
        query["type"] = type
    if start or end:
        rng = {}
        if start:
            rng["$gte"] = start
        if end:
            rng["$lte"] = end
        query["date"] = rng
    dons = await db.donations.find(query, {"_id": 0}).sort("date", -1).to_list(2000)
    result = [await enrich_donation(d) for d in dons]
    if q:
        ql = q.lower()
        result = [r for r in result if ql in (r.get("donor_name") or "").lower()
                  or ql in (r.get("program_name") or "").lower()]
    return result


@api.post("/donations")
async def create_donation(inp: DonationInput, user: dict = Depends(require_roles(*DONATION_ROLES))):
    donor_id = inp.donor_id
    if not donor_id and inp.donor_name:
        donor_doc = {"id": new_id("donor_"), "name": inp.donor_name, "phone": inp.donor_phone or "",
                     "notes": "", "deleted_at": None, "created_at": now_utc()}
        await db.donors.insert_one(donor_doc)
        donor_id = donor_doc["id"]
    doc = {
        "id": new_id("don_"), "donor_id": donor_id, "program_id": inp.program_id,
        "date": inp.date or now_utc().isoformat(), "type": inp.type, "amount": inp.amount,
        "payment_method": inp.payment_method, "payment_status": inp.payment_status,
        "notes": inp.notes, "pic_id": user["id"], "deleted_at": None, "created_at": now_utc(),
    }
    await db.donations.insert_one(doc)
    return await enrich_donation(doc)


@api.put("/donations/{did}")
async def update_donation(did: str, inp: DonationInput, user: dict = Depends(require_roles(*DONATION_ROLES))):
    upd = {k: v for k, v in inp.dict().items() if k not in ("donor_name", "donor_phone")}
    await db.donations.update_one({"id": did}, {"$set": upd})
    d = await db.donations.find_one({"id": did}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Donasi tidak ditemukan")
    return await enrich_donation(d)


@api.delete("/donations/{did}")
async def delete_donation(did: str, user: dict = Depends(require_roles(*DONATION_ROLES))):
    await db.donations.update_one({"id": did}, {"$set": {"deleted_at": now_utc()}})
    return {"ok": True}


# --------------------------------------------------------------------------
# Expenses
# --------------------------------------------------------------------------
@api.get("/expenses")
async def list_expenses(user: dict = Depends(require_roles(*FIN_ROLES)),
                        q: Optional[str] = None, program_id: Optional[str] = None,
                        category: Optional[str] = None,
                        start: Optional[str] = None, end: Optional[str] = None):
    query = {"deleted_at": None}
    if program_id:
        query["program_id"] = program_id
    if category:
        query["category"] = category
    if start or end:
        rng = {}
        if start:
            rng["$gte"] = start
        if end:
            rng["$lte"] = end
        query["date"] = rng
    if q:
        query["description"] = {"$regex": q, "$options": "i"}
    exps = await db.expenses.find(query, {"_id": 0}).sort("date", -1).to_list(2000)
    return [await enrich_expense(e) for e in exps]


@api.post("/expenses")
async def create_expense(inp: ExpenseInput, user: dict = Depends(require_roles(*FIN_ROLES))):
    doc = {
        "id": new_id("exp_"), "program_id": inp.program_id,
        "date": inp.date or now_utc().isoformat(), "category": inp.category,
        "description": inp.description, "amount": inp.amount,
        "payment_method": inp.payment_method, "pic_id": user["id"],
        "notes": inp.notes, "receipt": inp.receipt, "deleted_at": None, "created_at": now_utc(),
    }
    await db.expenses.insert_one(doc)
    return await enrich_expense(doc)


@api.put("/expenses/{eid}")
async def update_expense(eid: str, inp: ExpenseInput, user: dict = Depends(require_roles(*FIN_ROLES))):
    await db.expenses.update_one({"id": eid}, {"$set": inp.dict()})
    e = await db.expenses.find_one({"id": eid}, {"_id": 0})
    if not e:
        raise HTTPException(status_code=404, detail="Pengeluaran tidak ditemukan")
    return await enrich_expense(e)


@api.delete("/expenses/{eid}")
async def delete_expense(eid: str, user: dict = Depends(require_roles(*FIN_ROLES))):
    await db.expenses.update_one({"id": eid}, {"$set": {"deleted_at": now_utc()}})
    return {"ok": True}


# --------------------------------------------------------------------------
# Tasks + Briefs + Checklists
# --------------------------------------------------------------------------
@api.get("/tasks")
async def list_tasks(user: dict = Depends(get_current_user),
                     q: Optional[str] = None, status: Optional[str] = None,
                     category: Optional[str] = None, priority: Optional[str] = None,
                     assigned_user_id: Optional[str] = None, mine: Optional[bool] = False):
    query = {"deleted_at": None}
    if status:
        query["status"] = status
    if category:
        query["category"] = category
    if priority:
        query["priority"] = priority
    if assigned_user_id:
        query["assigned_user_id"] = assigned_user_id
    if mine:
        query["assigned_user_id"] = user["id"]
    if q:
        query["title"] = {"$regex": q, "$options": "i"}
    tasks = await db.tasks.find(query, {"_id": 0}).sort("deadline", 1).to_list(1000)
    return [await enrich_task(t) for t in tasks]


@api.post("/tasks")
async def create_task(inp: TaskInput, user: dict = Depends(get_current_user)):
    doc = {"id": new_id("task_"), **inp.dict(), "created_by": user["id"],
           "deleted_at": None, "created_at": now_utc(), "updated_at": now_utc()}
    await db.tasks.insert_one(doc)
    return await enrich_task(doc, with_details=True)


@api.get("/tasks/{tid}")
async def get_task(tid: str, user: dict = Depends(get_current_user)):
    t = await db.tasks.find_one({"id": tid, "deleted_at": None}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Tugas tidak ditemukan")
    return await enrich_task(t, with_details=True)


@api.put("/tasks/{tid}")
async def update_task(tid: str, inp: TaskInput, user: dict = Depends(get_current_user)):
    await db.tasks.update_one({"id": tid}, {"$set": {**inp.dict(), "updated_at": now_utc()}})
    t = await db.tasks.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Tugas tidak ditemukan")
    return await enrich_task(t, with_details=True)


@api.patch("/tasks/{tid}/status")
async def update_task_status(tid: str, inp: StatusUpdate, user: dict = Depends(get_current_user)):
    await db.tasks.update_one({"id": tid}, {"$set": {"status": inp.status, "updated_at": now_utc()}})
    t = await db.tasks.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Tugas tidak ditemukan")
    return await enrich_task(t, with_details=True)


@api.delete("/tasks/{tid}")
async def delete_task(tid: str, user: dict = Depends(get_current_user)):
    await db.tasks.update_one({"id": tid}, {"$set": {"deleted_at": now_utc()}})
    return {"ok": True}


@api.put("/tasks/{tid}/brief")
async def upsert_brief(tid: str, inp: BriefInput, user: dict = Depends(get_current_user)):
    await db.briefs.update_one({"task_id": tid},
                               {"$set": {**inp.dict(), "task_id": tid, "updated_at": now_utc()}}, upsert=True)
    return {"ok": True, **inp.dict()}


@api.post("/tasks/{tid}/checklist")
async def add_checklist(tid: str, inp: ChecklistItemInput, user: dict = Depends(get_current_user)):
    doc = {"id": new_id("chk_"), "task_id": tid, "item": inp.item,
           "completed": False, "completed_at": None, "deleted_at": None, "created_at": now_utc()}
    await db.checklist_items.insert_one(doc)
    return {"id": doc["id"], "item": doc["item"], "completed": False, "completed_at": None}


@api.patch("/tasks/{tid}/checklist/{cid}")
async def toggle_checklist(tid: str, cid: str, inp: ChecklistToggle, user: dict = Depends(get_current_user)):
    await db.checklist_items.update_one(
        {"id": cid}, {"$set": {"completed": inp.completed,
                               "completed_at": now_utc() if inp.completed else None}})
    return {"ok": True}


@api.delete("/tasks/{tid}/checklist/{cid}")
async def delete_checklist(tid: str, cid: str, user: dict = Depends(get_current_user)):
    await db.checklist_items.update_one({"id": cid}, {"$set": {"deleted_at": now_utc()}})
    return {"ok": True}


# --------------------------------------------------------------------------
# Finance summary
# --------------------------------------------------------------------------
OPENING_BALANCE = 0


async def finance_summary() -> dict:
    dons = await db.donations.find({"payment_status": "Paid", "deleted_at": None}, {"_id": 0}).to_list(20000)
    income_by_type = {}
    total_income = 0
    for d in dons:
        total_income += d.get("amount", 0)
        t = d.get("type", "Lainnya")
        income_by_type[t] = income_by_type.get(t, 0) + d.get("amount", 0)
    exps = await db.expenses.find({"deleted_at": None}, {"_id": 0}).to_list(20000)
    total_expenses = sum(e.get("amount", 0) for e in exps)
    expense_by_cat = {}
    for e in exps:
        c = e.get("category", "Lainnya")
        expense_by_cat[c] = expense_by_cat.get(c, 0) + e.get("amount", 0)
    balance = OPENING_BALANCE + total_income - total_expenses
    status = "SURPLUS" if balance > 0 else ("DEFICIT" if balance < 0 else "BALANCED")
    return {
        "opening_balance": OPENING_BALANCE, "total_income": total_income,
        "total_expenses": total_expenses, "closing_balance": balance,
        "status": status, "income_by_type": income_by_type, "expense_by_category": expense_by_cat,
    }


@api.get("/finance/summary")
async def get_finance_summary(user: dict = Depends(require_roles(*FIN_ROLES))):
    return await finance_summary()


# --------------------------------------------------------------------------
# Dashboard
# --------------------------------------------------------------------------
@api.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    role = user["role"]
    today = now_utc().date().isoformat()
    month_prefix = now_utc().strftime("%Y-%m")

    result = {"role": role, "attention": []}

    all_tasks = await db.tasks.find({"deleted_at": None}, {"_id": 0}).to_list(5000)

    def task_deadline_date(t):
        dl = iso(t.get("deadline"))
        return dl[:10] if dl else None

    open_statuses = ("Draft", "Assigned", "In Progress", "Review", "Revision")
    tasks_today = [t for t in all_tasks if task_deadline_date(t) == today and t.get("status") in open_statuses]
    overdue = [t for t in all_tasks
               if task_deadline_date(t) and task_deadline_date(t) < today and t.get("status") in open_statuses]
    result["today"] = {"tasks_today": len(tasks_today), "overdue_tasks": len(overdue)}

    def count_status(s):
        return len([t for t in all_tasks if t.get("status") == s])

    result["content"] = {
        "in_production": count_status("In Progress") + count_status("Assigned"),
        "pending_review": count_status("Review") + count_status("Revision"),
        "published": count_status("Published"),
        "overdue": len(overdue),
    }
    if overdue:
        result["attention"].append({"type": "warning", "icon": "warning",
                                     "text": f"{len(overdue)} tugas melewati deadline"})
    review_ct = count_status("Review")
    if review_ct:
        result["attention"].append({"type": "info", "icon": "eye",
                                     "text": f"{review_ct} konten menunggu review"})

    if role in ("manager", "fundraising"):
        dons_paid = await db.donations.find({"payment_status": "Paid", "deleted_at": None}, {"_id": 0}).to_list(20000)
        month_dons = [d for d in dons_paid if (iso(d.get("date")) or "")[:7] == month_prefix]
        today_dons = [d for d in dons_paid if (iso(d.get("date")) or "")[:10] == today]
        month_total = sum(d.get("amount", 0) for d in month_dons)
        donor_ids = set(d.get("donor_id") for d in month_dons if d.get("donor_id"))
        active_progs = await db.programs.find({"status": "Active", "deleted_at": None}, {"_id": 0}).to_list(500)
        monthly_target = sum(p.get("target", 0) for p in active_progs)
        result["today"]["donations_today"] = sum(d.get("amount", 0) for d in today_dons)
        result["today"]["active_programs"] = len(active_progs)
        result["fundraising"] = {
            "month_total": month_total,
            "monthly_target": monthly_target,
            "achievement": round(month_total / monthly_target * 100, 1) if monthly_target else 0,
            "donor_count": len(donor_ids),
        }
        pending_ct = await db.donations.count_documents({"payment_status": "Pending", "deleted_at": None})
        if pending_ct:
            result["attention"].append({"type": "info", "icon": "clock",
                                         "text": f"{pending_ct} donasi menunggu konfirmasi"})
        for p in active_progs:
            stats = await program_stats(p["id"])
            if p.get("target", 0) > 0 and stats["total_raised"] < p["target"] * 0.5:
                result["attention"].append({"type": "warning", "icon": "target",
                                             "text": f"Program {p['name']} belum mencapai 50% target"})
                break

    if role == "manager":
        fin = await finance_summary()
        result["finance"] = {
            "total_income": fin["total_income"], "total_expenses": fin["total_expenses"],
            "closing_balance": fin["closing_balance"], "status": fin["status"],
        }

    return result


# --------------------------------------------------------------------------
# Reports
# --------------------------------------------------------------------------

# --------------------------------------------------------------------------
# Report Export — Excel / CSV / PDF
# --------------------------------------------------------------------------

def _export_rows(report_data: dict):
    """Mengubah data laporan menjadi tabel untuk export."""

    report_type = report_data.get("type", "report")
    rows = report_data.get("rows") or []

    # Laporan keuangan
    if report_type == "financial":
        summary = report_data.get("summary") or {}
        rows = [
            {
                "Metric": key,
                "Value": value
            }
            for key, value in summary.items()
        ]
        return ["Metric", "Value"], rows

    # Tidak ada data
    if not rows:
        return ["Keterangan"], [
            {"Keterangan": "Tidak ada data"}
        ]

    # Kolom yang ditampilkan
    preferred_fields = {
        "fundraising": [
            "date",
            "donor_name",
            "program_name",
            "type",
            "amount",
            "payment_method",
            "payment_status",
            "notes",
        ],

        "donation": [
            "date",
            "donor_name",
            "program_name",
            "type",
            "amount",
            "payment_method",
            "payment_status",
            "notes",
        ],

        "expense": [
            "date",
            "program_name",
            "category",
            "description",
            "amount",
            "payment_method",
            "notes",
        ],

        "program": [
            "name",
            "category",
            "target",
            "start_date",
            "end_date",
            "status",
        ],

        "content": [
            "title",
            "category",
            "status",
            "deadline",
            "assigned_user_id",
            "program_name",
        ],
    }

    fields = preferred_fields.get(report_type)

    if not fields:
        fields = [
            key
            for key in rows[0].keys()
            if key not in {"id", "_id"}
        ]

    headers = []

    for field in fields:
        if any(field in row for row in rows):
            headers.append(field)

    def clean_value(value):

        if isinstance(value, (dict, list)):
            return json.dumps(
                value,
                ensure_ascii=False
            )

        if isinstance(value, datetime):
            return iso(value)

        return value

    clean_rows = []

    for row in rows:

        clean_row = {}

        for header in headers:
            clean_row[header] = clean_value(
                row.get(header)
            )

        clean_rows.append(clean_row)

    return headers, clean_rows


async def _get_report_for_export(
    report_type: str,
    user: dict,
    start: Optional[str],
    end: Optional[str],
    program_id: Optional[str],
    category: Optional[str],
    status: Optional[str],
):

    # Menggunakan laporan existing
    # sehingga filter dan permission tetap sama.

    return await reports(
        report_type=report_type,
        user=user,
        start=start,
        end=end,
        program_id=program_id,
        category=category,
        status=status,
    )


@api.get("/reports/export/{file_format}/{report_type}")
async def export_report(
    file_format: str,
    report_type: str,
    user: dict = Depends(get_current_user),

    start: Optional[str] = None,
    end: Optional[str] = None,
    program_id: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
):

    file_format = file_format.lower()

    # Validasi format
    if file_format not in {
        "csv",
        "xlsx",
        "pdf",
    }:

        raise HTTPException(
            status_code=400,
            detail="Format export harus csv, xlsx, atau pdf"
        )

    # Ambil data laporan
    data = await _get_report_for_export(
        report_type,
        user,
        start,
        end,
        program_id,
        category,
        status,
    )

    headers, rows = _export_rows(data)

    # Nama file
    safe_type = re.sub(
        r"[^a-zA-Z0-9_-]+",
        "-",
        report_type
    ).strip("-") or "report"

    date_part = (
        start
        or end
        or now_utc().date().isoformat()
    ).replace(":", "-")

    filename_base = (
        f"laporan-{safe_type}-{date_part}"
    )

    # =========================================================
    # CSV
    # =========================================================

    if file_format == "csv":

        output = io.StringIO()

        writer = csv.DictWriter(
            output,
            fieldnames=headers,
            extrasaction="ignore",
        )

        writer.writeheader()
        writer.writerows(rows)

        content = output.getvalue().encode(
            "utf-8-sig"
        )

        return Response(
            content=content,

            media_type="text/csv; charset=utf-8",

            headers={
                "Content-Disposition":
                    f'attachment; filename="{filename_base}.csv"'
            },
        )

    # =========================================================
    # EXCEL
    # =========================================================

    if file_format == "xlsx":

        try:

            from openpyxl import Workbook

            from openpyxl.styles import (
                Font,
                Alignment,
            )

            from openpyxl.utils import (
                get_column_letter,
            )

        except ImportError:

            raise HTTPException(
                status_code=500,
                detail=(
                    "Library openpyxl belum terpasang. "
                    "Jalankan: pip install openpyxl"
                )
            )

        workbook = Workbook()

        worksheet = workbook.active

        worksheet.title = "Laporan"

        # Header
        worksheet.append(headers)

        for cell in worksheet[1]:

            cell.font = Font(
                bold=True
            )

            cell.alignment = Alignment(
                horizontal="center"
            )

        # Data
        for row in rows:

            worksheet.append(
                [
                    row.get(header)
                    for header in headers
                ]
            )

        # Format kolom angka
        for column_index, header in enumerate(
            headers,
            start=1
        ):

            if header in {
                "amount",
                "target",
                "Value",
            }:

                for row_index in range(
                    2,
                    worksheet.max_row + 1
                ):

                    cell = worksheet.cell(
                        row=row_index,
                        column=column_index
                    )

                    if isinstance(
                        cell.value,
                        (int, float)
                    ):

                        cell.number_format = "#,##0"

            # Auto width
            max_length = 0

            for row_index in range(
                1,
                worksheet.max_row + 1
            ):

                value = worksheet.cell(
                    row=row_index,
                    column=column_index
                ).value

                length = len(
                    str(value or "")
                )

                max_length = max(
                    max_length,
                    length
                )

            worksheet.column_dimensions[
                get_column_letter(column_index)
            ].width = min(
                max(max_length + 2, 12),
                40
            )

        # Freeze header
        worksheet.freeze_panes = "A2"

        # Filter
        worksheet.auto_filter.ref = (
            worksheet.dimensions
        )

        # Generate file
        output = io.BytesIO()

        workbook.save(output)

        content = output.getvalue()

        return Response(
            content=content,

            media_type=(
                "application/"
                "vnd.openxmlformats-officedocument."
                "spreadsheetml.sheet"
            ),

            headers={
                "Content-Disposition":
                    f'attachment; filename="{filename_base}.xlsx"'
            },
        )

    # =========================================================
    # PDF
    # =========================================================

    try:

        from reportlab.lib.pagesizes import (
            A4,
            landscape,
        )

        from reportlab.lib.styles import (
            getSampleStyleSheet,
        )

        from reportlab.lib.units import mm

        from reportlab.platypus import (
            SimpleDocTemplate,
            Table,
            TableStyle,
            Paragraph,
            Spacer,
        )

        from reportlab.lib import colors

    except ImportError:

        raise HTTPException(
            status_code=500,
            detail=(
                "Library reportlab belum terpasang. "
                "Jalankan: pip install reportlab"
            )
        )

    output = io.BytesIO()

    document = SimpleDocTemplate(

        output,

        pagesize=landscape(A4),

        rightMargin=10 * mm,
        leftMargin=10 * mm,

        topMargin=10 * mm,
        bottomMargin=10 * mm,
    )

    styles = getSampleStyleSheet()

    story = [

        Paragraph(
            "Laporan Baitul Maal Al-Falah",
            styles["Title"]
        ),

        Paragraph(
            (
                f"Jenis: {report_type.title()} "
                f"| Periode: "
                f"{start or '-'} "
                f"s/d "
                f"{end or '-'}"
            ),
            styles["Normal"]
        ),

        Spacer(
            1,
            6 * mm
        ),
    ]

    # Header PDF
    table_data = [

        [
            Paragraph(
                str(header),
                styles["Heading5"]
            )

            for header in headers
        ]
    ]

    # Isi
    for row in rows:

        table_data.append(

            [
                Paragraph(
                    str(
                        row.get(header)
                        if row.get(header)
                        is not None
                        else ""
                    ),
                    styles["BodyText"]
                )

                for header in headers
            ]
        )

    table = Table(
        table_data,
        repeatRows=1
    )

    table.setStyle(

        TableStyle([

            (
                "BACKGROUND",
                (0, 0),
                (-1, 0),
                colors.HexColor("#0f766e"),
            ),

            (
                "TEXTCOLOR",
                (0, 0),
                (-1, 0),
                colors.white,
            ),

            (
                "GRID",
                (0, 0),
                (-1, -1),
                0.35,
                colors.grey,
            ),

            (
                "VALIGN",
                (0, 0),
                (-1, -1),
                "TOP",
            ),

            (
                "FONTSIZE",
                (0, 0),
                (-1, -1),
                7,
            ),

            (
                "LEFTPADDING",
                (0, 0),
                (-1, -1),
                4,
            ),

            (
                "RIGHTPADDING",
                (0, 0),
                (-1, -1),
                4,
            ),

            (
                "TOPPADDING",
                (0, 0),
                (-1, -1),
                3,
            ),

            (
                "BOTTOMPADDING",
                (0, 0),
                (-1, -1),
                3,
            ),

        ])
    )

    story.append(table)

    document.build(story)

    content = output.getvalue()

    return Response(

        content=content,

        media_type="application/pdf",

        headers={
            "Content-Disposition":
                f'attachment; filename="{filename_base}.pdf"'
        },
    )

@api.get("/reports/{report_type}")
async def reports(report_type: str, user: dict = Depends(get_current_user),
                  start: Optional[str] = None, end: Optional[str] = None,
                  program_id: Optional[str] = None, category: Optional[str] = None,
                  status: Optional[str] = None):
    if report_type in ("financial", "expense") and user["role"] != "manager":
        raise HTTPException(status_code=403, detail="Akses ditolak")
    if report_type in ("fundraising", "donation", "program") and user["role"] not in ("manager", "fundraising"):
        raise HTTPException(status_code=403, detail="Akses ditolak")

    def in_range(dt):
        s = iso(dt)
        if not s:
            return False
        d = s[:10]
        if start and d < start:
            return False
        if end and d > end:
            return False
        return True

    if report_type == "financial":
        fin = await finance_summary()
        return {"type": "financial", "summary": fin}

    if report_type == "expense":
        query = {"deleted_at": None}
        if program_id:
            query["program_id"] = program_id
        if category:
            query["category"] = category
        exps = await db.expenses.find(query, {"_id": 0}).to_list(5000)
        rows = [await enrich_expense(e) for e in exps if (not (start or end)) or in_range(e.get("date"))]
        return {"type": "expense", "total": sum(r["amount"] for r in rows), "rows": rows}

    if report_type in ("fundraising", "donation"):
        query = {"deleted_at": None}
        if program_id:
            query["program_id"] = program_id
        if status:
            query["payment_status"] = status
        dons = await db.donations.find(query, {"_id": 0}).to_list(10000)
        rows = [await enrich_donation(d) for d in dons if (not (start or end)) or in_range(d.get("date"))]
        paid = [r for r in rows if r["payment_status"] == "Paid"]
        return {"type": report_type, "total": sum(r["amount"] for r in paid), "count": len(rows), "rows": rows}

    if report_type == "program":
        progs = await db.programs.find({"deleted_at": None}, {"_id": 0}).to_list(500)
        rows = [await enrich_program(p) for p in progs]
        return {"type": "program", "rows": rows}

    if report_type == "content":
        query = {"deleted_at": None}
        if category:
            query["category"] = category
        if status:
            query["status"] = status
        tasks = await db.tasks.find(query, {"_id": 0}).to_list(5000)
        rows = [await enrich_task(t) for t in tasks if (not (start or end)) or in_range(t.get("deadline"))]
        by_status = {}
        for r in rows:
            by_status[r["status"]] = by_status.get(r["status"], 0) + 1
        return {"type": "content", "count": len(rows), "by_status": by_status, "rows": rows}

    raise HTTPException(status_code=404, detail="Jenis laporan tidak dikenal")
# ==========================================================================
# ALFALAH AI CONTENT ASSISTANT
# ==========================================================================
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-3.8-flash"
AI_ROLES = ("manager", "content")

CONTENT_DNA = [
    "MASJID INI AGAK LAEN", "BUAT APA?", "JANGAN... TAPI...",
    "KELIHATANNYA SEPELE", "BUKAN TENTANG BANGUNANNYA", "PESAN UNTUK KAMU",
]

AI_SYSTEM_PROMPT = """Kamu adalah SENIOR CONTENT STRATEGIST untuk Masjid Raya Al-Falah Sragen.
Kamu bukan generator teks biasa. Kamu duduk di samping Manajer dan membantu mengubah program/aktivitas/cerita masjid menjadi konten Reels yang menarik, jujur, dan berdampak.

BRAND: "MASJID RAMAH MUSAFIR". Al-Falah adalah tempat ibadah, tempat aman & nyaman, tempat istirahat, tempat makan & keramahan, tempat berkumpul, pusat layanan sosial, tempat solusi, tempat bahagia, dekat dengan kehidupan manusia sehari-hari.
NILAI INTI: MELAYANI, MEMBAHAGIAKAN, MENCERAHKAN.
FOKUS KONTEN: MANUSIA, PENGALAMAN, MANFAAT, DAMPAK. Jangan sekadar memamerkan bangunan masjid yang megah.

6 CONTENT DNA (pilih SATU yang paling tepat):
1. "MASJID INI AGAK LAEN" - fakta tak terduga/unik. Struktur: Hook -> Fakta Tak Terduga -> Bukti Visual -> Kenapa -> Manfaat -> Makna Lebih Besar -> Closing/CTA.
2. "BUAT APA?" - fasilitas/layanan/program. Struktur: Pertanyaan -> Jawaban 1 -> Jawaban 2 -> Jawaban 3 -> Akumulasi Manfaat -> Makna Lebih Besar -> CTA.
3. "JANGAN... TAPI..." - plot twist/reframing. Struktur: Ekspektasi -> Kesalahpahaman -> "Tapi..." -> Plot Twist -> Solusi -> Manfaat -> Closing Emosional. Boleh bikin penasaran, TIDAK boleh menipu.
4. "KELIHATANNYA SEPELE" - layanan kecil yang berdampak (makan gratis, minum gratis, beras, istirahat, keramahan, relawan). Inti: "Yang kecil buat kita, bisa berarti besar buat orang lain." Struktur: Hal Kecil -> Kenapa Diremehkan -> Penerima Manfaat Nyata -> Dampak Emosional -> Reframing -> Makna Lebih Besar -> Closing.
5. "BUKAN TENTANG BANGUNANNYA" - fundraising/filosofi/dampak sosial. Struktur: Persepsi Umum -> Pertanyaan/Keberatan -> Counterargument -> Contoh Nyata -> Dampak -> Filosofi -> CTA Fundraising. Pesan inti: masjid bukan soal megahnya bangunan, tapi soal manfaat untuk manusia. JANGAN menyerang masjid/lembaga lain.
6. "PESAN UNTUK KAMU" - emosional/motivasi/pengingat spiritual, sangat shareable. Struktur: Situasi Relatable -> Validasi Emosi -> Insight Singkat -> Nilai Islami/Spiritual -> Harapan/Doa -> Closing. Tone hangat, tulus, sederhana, manusiawi. Hindari bahasa terlalu puitis, menggurui, atau manipulatif.

HOOK ENGINE: 1-3 detik pertama krusial. Prioritaskan kontradiksi, rasa penasaran, pertanyaan, kejutan, relatability, pernyataan emosional, fakta tak terduga, atau reframe keyakinan umum. JANGAN pernah mulai dengan "Assalamualaikum...", "Halo sobat...", "Pada kesempatan kali ini...", atau "Masjid Raya Al-Falah memiliki...". Mulai dari bagian paling menarik. Hook harus terdengar natural saat diucapkan.

SHOW DON'T TELL: terjemahkan pernyataan jadi bukti visual. Selalu pikirkan "apa yang bisa DILIHAT penonton", bukan hanya "apa yang diucapkan".

RETENTION: setiap 3-5 detik hadirkan sesuatu yang baru (info/visual/pertanyaan/emosi/perspektif/orang/objek/detail tak terduga). Hindari penjelasan panjang tanpa jeda.

FUNDRAISING RULE: JANGAN langsung minta uang. Pola: Masalah -> Cerita Manusia -> Dampak -> Kenapa Penting -> CTA. Harus terasa hangat, jujur, konstruktif, manusiawi. Dilarang manipulasi rasa bersalah, melebih-lebihkan, urgensi palsu, penerima manfaat palsu, testimoni palsu.

TONE: santai, hangat, manusiawi, ramah anak muda, percakapan, Bahasa Indonesia sederhana, Islami tapi mudah didekati. Hindari bahasa korporat, pengumuman formal, jargon agama berlebihan, tulisan terlalu puitis/dramatis, klise motivasi generik. Terdengar seperti content creator Indonesia asli.

VISUAL STYLE: handheld, UGC, candid, orang nyata, aktivitas nyata, dokumenter, quick cuts, text overlay, lingkungan natural, minim setting. Autentik > sinematik sempurna.

INTEGRITAS FAKTUAL (KRITIS): JANGAN PERNAH mengarang angka, jumlah penerima manfaat, testimoni, hasil program, fasilitas, tanggal, acara, ayat Quran, hadits, atau angka keuangan. Hanya gunakan data yang diberikan Manajer atau konteks database terverifikasi. Jika ada fakta penting yang tidak tersedia, tulis persis: [DATA DIPERLUKAN]. Jangan berhalusinasi.

CTA (pilih SATU utama): AWARENESS (cth "Kalau lewat Sragen, mampir ya."), ENGAGEMENT (cth "Kalau kamu jadi musafir, fasilitas mana yang paling kamu butuhkan?"), FUNDRAISING (cth "Kalau kamu ingin ikut menghadirkan manfaat seperti ini, kamu bisa ikut bersedekah."), COMMUNITY (cth "Jadikan masjid rumah bersama."). CTA fundraising tidak boleh agresif.

OUTPUT: WAJIB HANYA JSON valid (tanpa teks lain, tanpa markdown fences), skema:
{
  "title": "judul konten singkat & menarik",
  "content_dna": "salah satu dari 6 nama DNA persis",
  "strategy": {
    "dna": "nama DNA",
    "hook_type": "cth Curiosity/Emotional/Contrarian/Question/Surprise",
    "emotional_trigger": "cth Surprise/Empati/Haru/Bangga",
    "target": "target audiens",
    "goal": "Awareness/Engagement/Community/Fundraising",
    "main_message": "1 kalimat pesan utama"
  },
  "hook": "hook utama, natural saat diucapkan (maks ~15 kata)",
  "alt_hooks": [
    {"angle": "Curiosity", "text": "..."},
    {"angle": "Emotional", "text": "..."},
    {"angle": "Contrarian", "text": "..."}
  ],
  "script": [
    {"scene": 1, "duration": "0-3 dtk", "visual": "...", "voice_over": "...", "text_overlay": "...", "edit": "..."}
  ],
  "shot_list": ["1. ...", "2. ..."],
  "cta": {"category": "Awareness/Engagement/Fundraising/Community", "text": "..."},
  "caption": "caption Instagram: hook -> cerita singkat -> makna -> CTA, percakapan, sedikit hashtag",
  "platform": "Instagram"
}
Durasi total Reels 20-45 detik (jangan dipaksa 45 detik). Script berbasis scene. Shot list realistis untuk tim kecil (5-10 shot)."""


class AIGenerateInput(BaseModel):
    source_type: Optional[str] = "idea"      # program|idea|facility|fundraising|develop
    idea: Optional[str] = ""
    program_id: Optional[str] = None
    facility: Optional[str] = ""
    problem: Optional[str] = ""
    target_audience: Optional[str] = ""
    important_facts: Optional[str] = ""
    available_footage: Optional[str] = ""
    objective: Optional[str] = "Awareness"   # Awareness|Engagement|Community|Fundraising
    fundraising_objective: Optional[str] = ""
    force_dna: Optional[str] = None


class AITransformInput(BaseModel):
    content_item_id: str
    action: str   # generate_again|improve_hook|more_casual|more_emotional|shorter|youth_friendly|fundraising_version


class ContentItemUpdate(BaseModel):
    title: Optional[str] = None
    content_dna: Optional[str] = None
    hook: Optional[str] = None
    caption: Optional[str] = None
    status: Optional[str] = None
    script: Optional[list] = None
    shot_list: Optional[list] = None
    cta: Optional[dict] = None
    strategy: Optional[dict] = None
    alt_hooks: Optional[list] = None


class CreateTaskFromContent(BaseModel):
    assigned_user_id: Optional[str] = None
    deadline: Optional[str] = None
    priority: str = "Medium"


def _extract_json(text: str) -> dict:
    if not isinstance(text, str):
        text = getattr(text, "content", None) or str(text)
    m = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.S)
    raw = m.group(1) if m else text
    s = raw.find("{")
    e = raw.rfind("}")
    if s >= 0 and e > s:
        raw = raw[s:e + 1]
    return json.loads(raw)


async def _ai_generate_json(prompt: str) -> dict:
    if not GEMINI_API_KEY or gemini_client is None:
        raise HTTPException(
            status_code=503,
            detail="AI belum dikonfigurasi (GEMINI_API_KEY kosong)."
        )

    try:
        response = await gemini_client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=AI_SYSTEM_PROMPT,
                response_mime_type="application/json",
                temperature=0.8,
            ),
        )
    except Exception as ex:
        logger.exception("Gemini API call failed")
        raise HTTPException(
            status_code=502,
            detail=f"Gagal memanggil Gemini API: {ex}"
        )

    try:
        return _extract_json(response.text)
    except Exception:
        logger.error(
            "Gemini returned invalid JSON: %s",
            (response.text or "")[:1000]
        )
        raise HTTPException(
            status_code=502,
            detail="Gemini mengembalikan format JSON tidak valid. Coba lagi."
        )


async def _program_context(program_id: Optional[str], role: str) -> str:
    if not program_id:
        return ""
    p = await db.programs.find_one({"id": program_id, "deleted_at": None}, {"_id": 0})
    if not p:
        return ""
    lines = [
        f"Nama Program: {p.get('name')}",
        f"Kategori: {p.get('category')}",
        f"Deskripsi: {p.get('description') or '[DATA DIPERLUKAN]'}",
        f"Status: {p.get('status')}",
    ]
    if role == "manager":
        stats = await program_stats(program_id)
        target = p.get("target", 0) or 0
        lines.append(f"Target dana: Rp {int(target):,}".replace(",", "."))
        lines.append(f"Dana terkumpul: Rp {int(stats['total_raised']):,}".replace(",", "."))
        lines.append(f"Jumlah donasi: {stats['donation_count']}")
    return "KONTEKS PROGRAM (data terverifikasi dari database, jangan mengarang di luar ini):\n" + "\n".join(lines)


def _build_generate_prompt(inp: AIGenerateInput, program_ctx: str, modifier: str = "", previous: Optional[dict] = None) -> str:
    parts = []
    if program_ctx:
        parts.append(program_ctx)
    parts.append("INPUT DARI MANAJER:")
    parts.append(f"- Sumber: {inp.source_type}")
    if inp.idea:
        parts.append(f"- Ide Konten: {inp.idea}")
    if inp.facility:
        parts.append(f"- Fasilitas/Aktivitas: {inp.facility}")
    if inp.problem:
        parts.append(f"- Masalah: {inp.problem}")
    if inp.target_audience:
        parts.append(f"- Target Audiens: {inp.target_audience}")
    if inp.important_facts:
        parts.append(f"- Fakta Penting (terverifikasi): {inp.important_facts}")
    if inp.available_footage:
        parts.append(f"- Footage Tersedia: {inp.available_footage}")
    parts.append(f"- Tujuan Konten: {inp.objective}")
    if inp.fundraising_objective:
        parts.append(f"- Tujuan Fundraising: {inp.fundraising_objective}")
    if inp.force_dna:
        parts.append(f"- Gunakan Content DNA: {inp.force_dna}")
    parts.append("\nUntuk fakta yang tidak tersedia, gunakan penanda [DATA DIPERLUKAN]. Jangan mengarang angka/testimoni/hadits/ayat.")
    if previous:
        parts.append("\nKONTEN SEBELUMNYA (untuk direvisi, pertahankan inti tapi terapkan instruksi berikut):")
        parts.append(json.dumps({k: previous.get(k) for k in ("hook", "strategy", "script", "cta", "caption")}, ensure_ascii=False)[:3000])
    if modifier:
        parts.append(f"\nINSTRUKSI TRANSFORMASI: {modifier}")
    parts.append("\nKembalikan HANYA JSON sesuai skema.")
    return "\n".join(parts)


async def enrich_content_item(c: dict, with_task: bool = True) -> dict:
    program_name = None
    if c.get("related_program_id"):
        p = await db.programs.find_one({"id": c["related_program_id"]}, {"_id": 0, "name": 1})
        program_name = p["name"] if p else None
    task_status = None
    if with_task and c.get("related_task_id"):
        t = await db.tasks.find_one({"id": c["related_task_id"], "deleted_at": None}, {"_id": 0, "status": 1})
        task_status = t["status"] if t else None
    return {
        "id": c["id"], "title": c.get("title"), "content_dna": c.get("content_dna"),
        "strategy": c.get("strategy"), "hook": c.get("hook"), "alt_hooks": c.get("alt_hooks", []),
        "script": c.get("script", []), "shot_list": c.get("shot_list", []), "cta": c.get("cta"),
        "caption": c.get("caption"), "platform": c.get("platform", "Instagram"),
        "status": c.get("status", "Draft"), "related_program_id": c.get("related_program_id"),
        "related_program_name": program_name, "related_task_id": c.get("related_task_id"),
        "related_task_status": task_status, "inputs": c.get("inputs"),
        "created_by": c.get("created_by"), "created_at": iso(c.get("created_at")),
        "updated_at": iso(c.get("updated_at")),
    }


def _pkg_to_item_fields(pkg: dict) -> dict:
    return {
        "title": pkg.get("title") or "Konten AI",
        "content_dna": pkg.get("content_dna"),
        "strategy": pkg.get("strategy"),
        "hook": pkg.get("hook"),
        "alt_hooks": pkg.get("alt_hooks", []),
        "script": pkg.get("script", []),
        "shot_list": pkg.get("shot_list", []),
        "cta": pkg.get("cta"),
        "caption": pkg.get("caption"),
        "platform": pkg.get("platform", "Instagram"),
    }


@api.post("/ai/generate")
async def ai_generate(inp: AIGenerateInput, user: dict = Depends(require_roles(*AI_ROLES))):
    program_ctx = await _program_context(inp.program_id, user["role"])
    prompt = _build_generate_prompt(inp, program_ctx)
    pkg = await _ai_generate_json(prompt)
    doc = {
        "id": new_id("ci_"), **_pkg_to_item_fields(pkg), "status": "Draft",
        "related_program_id": inp.program_id, "related_task_id": None,
        "inputs": inp.dict(), "created_by": user["id"],
        "deleted_at": None, "created_at": now_utc(), "updated_at": now_utc(),
    }
    await db.content_items.insert_one(doc)
    return await enrich_content_item(doc)


TRANSFORM_INSTRUCTIONS = {
    "generate_again": "Buat versi baru yang segar dengan sudut pandang berbeda, tetap sesuai konteks.",
    "improve_hook": "Perkuat hook utama dan 3 alternatif hook agar lebih menarik di 3 detik pertama. Pertahankan bagian lain.",
    "more_casual": "Buat seluruh naskah dan caption lebih santai dan percakapan.",
    "more_emotional": "Tingkatkan kedalaman emosi (empati/haru) secara tulus, tidak manipulatif.",
    "shorter": "Persingkat total durasi menjadi 15-25 detik dengan lebih sedikit scene, tetap kuat.",
    "youth_friendly": "Buat lebih ramah anak muda: bahasa gaul wajar, ritme cepat, relatable.",
    "fundraising_version": "Ubah menjadi versi fundraising memakai DNA 'BUKAN TENTANG BANGUNANNYA' dengan pola Masalah->Cerita Manusia->Dampak->Kenapa Penting->CTA fundraising yang hangat (tidak agresif).",
}


@api.post("/ai/transform")
async def ai_transform(inp: AITransformInput, user: dict = Depends(require_roles(*AI_ROLES))):
    c = await db.content_items.find_one({"id": inp.content_item_id, "deleted_at": None}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Konten tidak ditemukan")
    modifier = TRANSFORM_INSTRUCTIONS.get(inp.action)
    if not modifier:
        raise HTTPException(status_code=400, detail="Aksi tidak dikenal")
    src = AIGenerateInput(**(c.get("inputs") or {}))
    program_ctx = await _program_context(c.get("related_program_id"), user["role"])
    prompt = _build_generate_prompt(src, program_ctx, modifier=modifier, previous=c)
    pkg = await _ai_generate_json(prompt)
    fields = _pkg_to_item_fields(pkg)
    fields["updated_at"] = now_utc()
    await db.content_items.update_one({"id": inp.content_item_id}, {"$set": fields})
    doc = await db.content_items.find_one({"id": inp.content_item_id}, {"_id": 0})
    return await enrich_content_item(doc)


@api.get("/content-items")
async def list_content_items(user: dict = Depends(require_roles(*AI_ROLES)),
                             q: Optional[str] = None, status: Optional[str] = None,
                             program_id: Optional[str] = None):
    query = {"deleted_at": None}
    if status:
        query["status"] = status
    if program_id:
        query["related_program_id"] = program_id
    if q:
        query["title"] = {"$regex": q, "$options": "i"}
    items = await db.content_items.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [await enrich_content_item(c) for c in items]


@api.get("/content-items/{cid}")
async def get_content_item(cid: str, user: dict = Depends(require_roles(*AI_ROLES))):
    c = await db.content_items.find_one({"id": cid, "deleted_at": None}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Konten tidak ditemukan")
    return await enrich_content_item(c)


@api.put("/content-items/{cid}")
async def update_content_item(cid: str, inp: ContentItemUpdate, user: dict = Depends(require_roles(*AI_ROLES))):
    upd = {k: v for k, v in inp.dict().items() if v is not None}
    upd["updated_at"] = now_utc()
    await db.content_items.update_one({"id": cid}, {"$set": upd})
    c = await db.content_items.find_one({"id": cid}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Konten tidak ditemukan")
    return await enrich_content_item(c)


@api.post("/content-items/{cid}/duplicate")
async def duplicate_content_item(cid: str, user: dict = Depends(require_roles(*AI_ROLES))):
    c = await db.content_items.find_one({"id": cid, "deleted_at": None}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Konten tidak ditemukan")
    c.pop("id", None)
    c["id"] = new_id("ci_")
    c["title"] = (c.get("title") or "Konten") + " (Salinan)"
    c["status"] = "Draft"
    c["related_task_id"] = None
    c["created_by"] = user["id"]
    c["created_at"] = now_utc()
    c["updated_at"] = now_utc()
    await db.content_items.insert_one(c)
    return await enrich_content_item(c)


@api.delete("/content-items/{cid}")
async def delete_content_item(cid: str, user: dict = Depends(require_roles(*AI_ROLES))):
    await db.content_items.update_one({"id": cid}, {"$set": {"deleted_at": now_utc()}})
    return {"ok": True}


@api.post("/content-items/{cid}/create-task")
async def create_task_from_content(cid: str, inp: CreateTaskFromContent, user: dict = Depends(require_roles(*AI_ROLES))):
    c = await db.content_items.find_one({"id": cid, "deleted_at": None}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Konten tidak ditemukan")
    # Build a readable description from the script
    script = c.get("script") or []
    script_text = "\n".join(
        f"SCENE {s.get('scene', i + 1)} ({s.get('duration', '')})\nVISUAL: {s.get('visual', '')}\nVO: {s.get('voice_over', '')}\nTEKS: {s.get('text_overlay', '')}\nEDIT: {s.get('edit', '')}"
        for i, s in enumerate(script)
    )
    shot_text = "\n".join(c.get("shot_list") or [])
    description = f"HOOK: {c.get('hook', '')}\n\nSCRIPT:\n{script_text}\n\nSHOT LIST:\n{shot_text}"
    task_id = new_id("task_")
    task_doc = {
        "id": task_id, "title": c.get("title") or "Konten AI", "description": description,
        "assigned_user_id": inp.assigned_user_id, "program_id": c.get("related_program_id"),
        "category": "Reels", "priority": inp.priority if inp.priority in ("Low", "Medium", "High", "Urgent") else "Medium",
        "status": "Assigned" if inp.assigned_user_id else "Draft",
        "start_date": now_utc().isoformat(), "deadline": inp.deadline,
        "created_by": user["id"], "deleted_at": None, "created_at": now_utc(), "updated_at": now_utc(),
    }
    await db.tasks.insert_one(task_doc)
    cta = c.get("cta") or {}
    strategy = c.get("strategy") or {}
    await db.briefs.update_one({"task_id": task_id}, {"$set": {
        "task_id": task_id, "objective": strategy.get("main_message", ""),
        "target_audience": strategy.get("target", ""), "platform": c.get("platform", "Instagram"),
        "format": "Reels", "hook": c.get("hook", ""), "main_content": script_text,
        "cta": cta.get("text", ""), "reference": "", "caption": c.get("caption", ""),
        "updated_at": now_utc(),
    }}, upsert=True)
    # Auto checklist from shot list (first 8)
    for shot in (c.get("shot_list") or [])[:10]:
        await db.checklist_items.insert_one({
            "id": new_id("chk_"), "task_id": task_id, "item": f"Ambil shot: {shot}",
            "completed": False, "completed_at": None, "deleted_at": None, "created_at": now_utc(),
        })
    await db.content_items.update_one({"id": cid}, {"$set": {
        "related_task_id": task_id, "status": "In Production", "updated_at": now_utc()}})
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return {"task": await enrich_task(task, with_details=True), "content_item_id": cid}


@api.get("/ai/programs-context")
async def ai_programs_for_context(user: dict = Depends(require_roles(*AI_ROLES))):
    progs = await db.programs.find({"deleted_at": None}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [{"id": p["id"], "name": p["name"], "category": p.get("category"), "status": p.get("status")} for p in progs]





@api.get("/")
async def root():
    return {"message": "Baitul Maal Al-Falah API", "status": "ok"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------
# Startup: indexes + seed
# --------------------------------------------------------------------------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await seed_data()


async def seed_data():
    if await db.users.find_one({"email": "manager@alfalah.id"}):
        return
    logger.info("Seeding sample data (fictional/demo)...")

    manager_id = "user_manager0001"
    content_id = "user_content001"
    cs_id = "user_cs00000001"
    users = [
        {"id": manager_id, "name": "Ahmad Fauzi", "email": "manager@alfalah.id",
         "password_hash": hash_password("manager123"), "role": "manager", "avatar": None,
         "deleted_at": None, "created_at": now_utc(), "updated_at": now_utc()},
        {"id": content_id, "name": "Siti Nurhaliza", "email": "content@alfalah.id",
         "password_hash": hash_password("content123"), "role": "content", "avatar": None,
         "deleted_at": None, "created_at": now_utc(), "updated_at": now_utc()},
        {"id": cs_id, "name": "Budi Santoso", "email": "cs@alfalah.id",
         "password_hash": hash_password("cs123456"), "role": "fundraising", "avatar": None,
         "deleted_at": None, "created_at": now_utc(), "updated_at": now_utc()},
    ]
    await db.users.insert_many(users)

    progs = [
        {"id": "prog_makan01", "name": "Program Makan Gratis", "category": "Sosial",
         "description": "Menyediakan makan gratis untuk jamaah dan dhuafa setiap hari Jumat.",
         "target": 30000000, "status": "Active", "pic_id": cs_id},
        {"id": "prog_tehjahe1", "name": "Teh Jahe 24 Jam", "category": "Sosial",
         "description": "Teh jahe hangat gratis 24 jam untuk musafir dan jamaah masjid.",
         "target": 10000000, "status": "Active", "pic_id": cs_id},
        {"id": "prog_infaqbrs", "name": "Gerakan Infaq Beras", "category": "Zakat",
         "description": "Pengumpulan dan distribusi beras untuk keluarga kurang mampu.",
         "target": 50000000, "status": "Active", "pic_id": manager_id},
        {"id": "prog_kajian01", "name": "Kajian Pejuang Nafkah", "category": "Dakwah",
         "description": "Kajian rutin untuk para pekerja dan pencari nafkah.",
         "target": 8000000, "status": "Draft", "pic_id": content_id},
    ]
    for p in progs:
        p.update({"start_date": now_utc().isoformat(), "end_date": None,
                  "deleted_at": None, "created_at": now_utc()})
    await db.programs.insert_many(progs)

    donors = [
        {"id": "donor_0001", "name": "Hj. Aminah", "phone": "081234567001", "notes": "Donatur tetap"},
        {"id": "donor_0002", "name": "H. Sulaiman", "phone": "081234567002", "notes": ""},
        {"id": "donor_0003", "name": "Keluarga Bapak Yusuf", "phone": "081234567003", "notes": ""},
        {"id": "donor_0004", "name": "Ibu Fatimah", "phone": "081234567004", "notes": "Wakaf"},
        {"id": "donor_0005", "name": "Hamba Allah", "phone": "", "notes": "Anonim"},
    ]
    for d in donors:
        d.update({"deleted_at": None, "created_at": now_utc()})
    await db.donors.insert_many(donors)

    def days_ago(n):
        return (now_utc() - timedelta(days=n)).isoformat()

    donations = [
        {"id": "don_0001", "donor_id": "donor_0001", "program_id": "prog_makan01", "date": days_ago(0),
         "type": "Sedekah", "amount": 2000000, "payment_method": "Transfer", "payment_status": "Paid"},
        {"id": "don_0002", "donor_id": "donor_0002", "program_id": "prog_infaqbrs", "date": days_ago(1),
         "type": "Infaq", "amount": 5000000, "payment_method": "Transfer", "payment_status": "Paid"},
        {"id": "don_0003", "donor_id": "donor_0003", "program_id": "prog_makan01", "date": days_ago(3),
         "type": "Donasi Program", "amount": 1500000, "payment_method": "QRIS", "payment_status": "Paid"},
        {"id": "don_0004", "donor_id": "donor_0004", "program_id": "prog_infaqbrs", "date": days_ago(5),
         "type": "Wakaf", "amount": 10000000, "payment_method": "Transfer", "payment_status": "Paid"},
        {"id": "don_0005", "donor_id": "donor_0005", "program_id": "prog_tehjahe1", "date": days_ago(2),
         "type": "Sedekah", "amount": 500000, "payment_method": "Cash", "payment_status": "Paid"},
        {"id": "don_0006", "donor_id": "donor_0001", "program_id": "prog_tehjahe1", "date": days_ago(0),
         "type": "Infaq", "amount": 750000, "payment_method": "QRIS", "payment_status": "Pending"},
        {"id": "don_0007", "donor_id": "donor_0002", "program_id": "prog_makan01", "date": days_ago(8),
         "type": "Zakat", "amount": 3000000, "payment_method": "Transfer", "payment_status": "Paid"},
    ]
    for d in donations:
        d.update({"notes": "", "pic_id": cs_id, "deleted_at": None, "created_at": now_utc()})
    await db.donations.insert_many(donations)

    expenses = [
        {"id": "exp_0001", "program_id": "prog_makan01", "date": days_ago(1), "category": "Program",
         "description": "Pembelian bahan makanan untuk 200 porsi", "amount": 1800000, "payment_method": "Cash"},
        {"id": "exp_0002", "program_id": "prog_tehjahe1", "date": days_ago(2), "category": "Equipment",
         "description": "Dispenser dan gelas teh jahe", "amount": 650000, "payment_method": "Transfer"},
        {"id": "exp_0003", "program_id": None, "date": days_ago(4), "category": "Operational",
         "description": "Biaya listrik dan air masjid", "amount": 1200000, "payment_method": "Transfer"},
        {"id": "exp_0004", "program_id": "prog_infaqbrs", "date": days_ago(6), "category": "Transportation",
         "description": "Distribusi beras ke 5 titik", "amount": 400000, "payment_method": "Cash"},
    ]
    for e in expenses:
        e.update({"pic_id": manager_id, "notes": "", "receipt": None, "deleted_at": None, "created_at": now_utc()})
    await db.expenses.insert_many(expenses)

    def in_days(n):
        return (now_utc() + timedelta(days=n)).isoformat()

    tasks = [
        {"id": "task_0001", "title": "Reels Program Makan Gratis Jumat",
         "description": "Buat reels dokumentasi kegiatan makan gratis.",
         "assigned_user_id": content_id, "program_id": "prog_makan01", "category": "Reels", "priority": "High",
         "status": "In Progress", "start_date": days_ago(1), "deadline": in_days(1)},
        {"id": "task_0002", "title": "Poster Gerakan Infaq Beras",
         "description": "Desain poster ajakan infaq beras.",
         "assigned_user_id": content_id, "program_id": "prog_infaqbrs", "category": "Poster", "priority": "Urgent",
         "status": "Review", "start_date": days_ago(3), "deadline": days_ago(1)},
        {"id": "task_0003", "title": "Feed Teh Jahe 24 Jam",
         "description": "Konten feed Instagram program teh jahe.",
         "assigned_user_id": content_id, "program_id": "prog_tehjahe1", "category": "Feed", "priority": "Medium",
         "status": "Published", "start_date": days_ago(5), "deadline": days_ago(2)},
        {"id": "task_0004", "title": "Dokumentasi Kajian Pejuang Nafkah",
         "description": "Rekam dan dokumentasikan kajian.",
         "assigned_user_id": content_id, "program_id": "prog_kajian01", "category": "Documentation", "priority": "Low",
         "status": "Assigned", "start_date": in_days(2), "deadline": in_days(5)},
        {"id": "task_0005", "title": "Story ucapan terima kasih donatur",
         "description": "Buat story apresiasi donatur.",
         "assigned_user_id": content_id, "program_id": None, "category": "Story", "priority": "Medium",
         "status": "Draft", "start_date": days_ago(0), "deadline": in_days(0)},
    ]
    for t in tasks:
        t.update({"created_by": manager_id, "deleted_at": None, "created_at": now_utc(), "updated_at": now_utc()})
    await db.tasks.insert_many(tasks)

    await db.briefs.insert_one({
        "task_id": "task_0001", "objective": "Meningkatkan awareness program makan gratis",
        "target_audience": "Jamaah masjid dan masyarakat sekitar", "platform": "Instagram",
        "format": "Reels 30 detik", "hook": "Setiap Jumat, 200 porsi gratis!",
        "main_content": "Dokumentasi persiapan hingga pembagian makanan", "cta": "Yuk ikut berdonasi!",
        "reference": "", "caption": "Alhamdulillah program Makan Gratis Jumat kembali hadir 🍚",
        "updated_at": now_utc(),
    })

    checklist = [
        {"item": "Riset konsep reels", "completed": True},
        {"item": "Ambil footage kegiatan", "completed": True},
        {"item": "Editing video", "completed": False},
        {"item": "Review & approval", "completed": False},
        {"item": "Publish ke Instagram", "completed": False},
    ]
    for c in checklist:
        await db.checklist_items.insert_one({
            "id": new_id("chk_"), "task_id": "task_0001", "item": c["item"],
            "completed": c["completed"], "completed_at": now_utc() if c["completed"] else None,
            "deleted_at": None, "created_at": now_utc(),
        })

    logger.info("Seed complete.")


@app.on_event("shutdown")
async def shutdown():
    client.close()
