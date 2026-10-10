from fastapi import APIRouter, Depends, HTTPException
from app.core.auth import current_user, require_shop, password_hash
from app.core.database import db
from app.core.config import settings
from app.core.audit import record_audit
from datetime import datetime, timezone
import uuid
import time
from app.models.schemas import (
    ShopSchema, ShopUpdateRequest, PrinterSchema, PrinterCreateRequest, PrinterUpdateRequest,
    StationSchema, StationCreateRequest, StationUpdateRequest,
    TeamMemberSchema, TeamInviteRequest, TeamMemberUpdateRequest,
    ShopProfileUpdateRequest, JobRejectRequest
)
from app.services.websocket_hub import ws_hub

router = APIRouter(prefix="/shops", tags=["Shops"])


def shop_record(shop_id):
    with db.transaction(readonly=True) as records:
        shop = records.get("shops", shop_id)
    if not shop or not shop["is_active"] or (settings.ENVIRONMENT != "test" and shop_id.startswith("shop-demo-")):
        raise HTTPException(404, "Shop not found")
    return shop


@router.get("", response_model=list[ShopSchema])
def list_shops():
    with db.transaction(readonly=True) as records:
        return [s for s in records.list("shops") if s["is_active"]
                and (settings.ENVIRONMENT == "test" or not s["id"].startswith("shop-demo-"))]


@router.get("/{shop_id}", response_model=ShopSchema)
def get_shop(shop_id: str):
    return shop_record(shop_id)


@router.patch("/{shop_id}", response_model=ShopSchema)
async def update_shop_rates(shop_id: str, payload: ShopUpdateRequest, user=Depends(current_user)):
    require_shop(user, shop_id, admin=True)
    with db.transaction() as records:
        shop = records.get("shops", shop_id)
        if not shop:
            raise HTTPException(404, "Shop not found")
        shop.update(payload.model_dump(exclude_none=True))
        records.put("shops", shop_id, shop)
        record_audit(records, "shop.rates_updated", actor=user["username"], target=shop_id,
                     metadata={"shop_id": shop_id})
    await ws_hub.broadcast_to_shop(shop_id, "SHOP_UPDATED", {})
    return shop


@router.patch("/{shop_id}/profile", response_model=ShopSchema)
async def update_shop_profile(shop_id: str, payload: ShopProfileUpdateRequest, user=Depends(current_user)):
    require_shop(user, shop_id, admin=True)
    with db.transaction() as records:
        shop = records.get("shops", shop_id)
        if not shop:
            raise HTTPException(404, "Shop not found")
        shop.update(payload.model_dump(exclude_none=True))
        records.put("shops", shop_id, shop)
        record_audit(records, "shop.profile_updated", actor=user["username"], target=shop_id)
    await ws_hub.broadcast_to_shop(shop_id, "SHOP_UPDATED", {})
    return shop


# --- Printers Endpoints ---
@router.get("/{shop_id}/printers", response_model=list[PrinterSchema])
def list_shop_printers(shop_id: str):
    return shop_record(shop_id).get("printers", [])


@router.post("/{shop_id}/printers", response_model=PrinterSchema, status_code=201)
async def add_shop_printer(shop_id: str, payload: PrinterCreateRequest, user=Depends(current_user)):
    require_shop(user, shop_id, admin=True)
    printer_id = f"printer-{uuid.uuid4().hex[:8]}"
    new_printer = {"id": printer_id, "shop_id": shop_id, **payload.model_dump(), "status": "online"}
    with db.transaction() as records:
        shop = records.get("shops", shop_id)
        if not shop:
            raise HTTPException(404, "Shop not found")
        printers = shop.get("printers", [])
        printers.append(new_printer)
        shop["printers"] = printers
        records.put("shops", shop_id, shop)
        record_audit(records, "shop.printer_added", actor=user["username"], target=printer_id)
    await ws_hub.broadcast_to_shop(shop_id, "SHOP_UPDATED", {})
    return new_printer


@router.patch("/{shop_id}/printers/{printer_id}", response_model=PrinterSchema)
async def update_shop_printer(shop_id: str, printer_id: str, payload: PrinterUpdateRequest, user=Depends(current_user)):
    require_shop(user, shop_id)
    updated = None
    with db.transaction() as records:
        shop = records.get("shops", shop_id)
        if not shop:
            raise HTTPException(404, "Shop not found")
        printers = shop.get("printers", [])
        for p in printers:
            if p["id"] == printer_id:
                p.update(payload.model_dump(exclude_none=True))
                updated = p
                break
        if not updated:
            raise HTTPException(404, "Printer not found")
        shop["printers"] = printers
        records.put("shops", shop_id, shop)
    await ws_hub.broadcast_to_shop(shop_id, "PRINTER_UPDATED", {"printer_id": printer_id})
    return updated


# --- Stations Endpoints ---
@router.get("/{shop_id}/stations", response_model=list[StationSchema])
def list_shop_stations(shop_id: str, user=Depends(current_user)):
    require_shop(user, shop_id)
    return shop_record(shop_id).get("stations", [])


@router.post("/{shop_id}/stations", response_model=StationSchema, status_code=201)
async def create_shop_station(shop_id: str, payload: StationCreateRequest, user=Depends(current_user)):
    require_shop(user, shop_id, admin=True)
    station_id = f"station-{uuid.uuid4().hex[:8]}"
    new_station = {
        "id": station_id,
        "shop_id": shop_id,
        **payload.model_dump(),
        "status": "online",
        "last_sync": datetime.now(timezone.utc).isoformat()
    }
    with db.transaction() as records:
        shop = records.get("shops", shop_id)
        if not shop:
            raise HTTPException(404, "Shop not found")
        stations = shop.get("stations", [])
        stations.append(new_station)
        shop["stations"] = stations
        records.put("shops", shop_id, shop)
        record_audit(records, "shop.station_paired", actor=user["username"], target=station_id)
    await ws_hub.broadcast_to_shop(shop_id, "STATION_UPDATED", {"station_id": station_id})
    return new_station


@router.patch("/{shop_id}/stations/{station_id}", response_model=StationSchema)
async def update_shop_station(shop_id: str, station_id: str, payload: StationUpdateRequest, user=Depends(current_user)):
    require_shop(user, shop_id)
    updated = None
    with db.transaction() as records:
        shop = records.get("shops", shop_id)
        if not shop:
            raise HTTPException(404, "Shop not found")
        stations = shop.get("stations", [])
        for s in stations:
            if s["id"] == station_id:
                s.update(payload.model_dump(exclude_none=True))
                s["last_sync"] = datetime.now(timezone.utc).isoformat()
                updated = s
                break
        if not updated:
            raise HTTPException(404, "Station not found")
        shop["stations"] = stations
        records.put("shops", shop_id, shop)
    await ws_hub.broadcast_to_shop(shop_id, "STATION_UPDATED", {"station_id": station_id})
    return updated


# --- Team Endpoints ---
@router.get("/{shop_id}/team", response_model=list[TeamMemberSchema])
def list_shop_team(shop_id: str, user=Depends(current_user)):
    require_shop(user, shop_id)
    with db.transaction(readonly=True) as records:
        members = [u for u in records.list("users") if u.get("shop_id") == shop_id and u.get("role") in ("admin", "operator")]
    return [{
        "username": m["username"],
        "shop_id": shop_id,
        "role": m.get("role", "operator"),
        "active": m.get("active", True),
        "last_active": m.get("last_active")
    } for m in sorted(members, key=lambda x: x["username"])]


@router.post("/{shop_id}/team", response_model=TeamMemberSchema, status_code=201)
def invite_shop_team_member(shop_id: str, payload: TeamInviteRequest, user=Depends(current_user)):
    require_shop(user, shop_id, admin=True)
    username = payload.username.strip().lower()
    with db.transaction() as records:
        if records.get("users", username):
            raise HTTPException(409, "User already exists")
        new_user = {
            "username": username,
            "role": payload.role,
            "shop_id": shop_id,
            "active": True,
            "password_hash": password_hash(payload.password),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        records.put("users", username, new_user)
        record_audit(records, "shop.team_member_added", actor=user["username"], target=username)
    return {"username": username, "shop_id": shop_id, "role": payload.role, "active": True}


# --- Operator Job Details & Rejection ---
@router.get("/{shop_id}/jobs/{job_id}")
def get_operator_job_detail(shop_id: str, job_id: str, user=Depends(current_user)):
    require_shop(user, shop_id)
    with db.transaction(readonly=True) as records:
        job = records.get("jobs", job_id)
        if not job or job.get("shop_id") != shop_id:
            raise HTTPException(404, "Job not found in this shop")
    return job


@router.post("/{shop_id}/jobs/{job_id}/reject")
async def reject_job(shop_id: str, job_id: str, payload: JobRejectRequest, user=Depends(current_user)):
    require_shop(user, shop_id)
    with db.transaction() as records:
        job = records.get("jobs", job_id)
        if not job or job.get("shop_id") != shop_id:
            raise HTTPException(404, "Job not found in this shop")
        job["job_status"] = "failed"
        job["rejection_reason"] = payload.reason
        job["rejected_by"] = user["username"]
        job["rejected_at"] = datetime.now(timezone.utc).isoformat()
        records.put("jobs", job_id, job)
        record_audit(records, "job.rejected", actor=user["username"], target=job_id,
                     metadata={"reason": payload.reason})
    await ws_hub.broadcast_to_shop(shop_id, "QUEUE_CHANGED", {"job_id": job_id})
    return {"ok": True, "job_id": job_id, "job_status": "failed", "reason": payload.reason}


@router.get("/{shop_id}/activity")
def get_shop_activity(shop_id: str, user=Depends(current_user)):
    require_shop(user, shop_id)
    with db.transaction(readonly=True) as records:
        events = [event for event in records.list("audit_events")
                  if event.get("metadata", {}).get("shop_id") == shop_id]
    events.sort(key=lambda event: event.get("created_at_epoch", 0), reverse=True)
    return [{"id": event["id"], "action": event["action"], "actor": event.get("actor"),
             "target": event.get("target"),
             "created_at": datetime.fromtimestamp(event["created_at_epoch"], timezone.utc).isoformat(),
             "status": event.get("metadata", {}).get("status")} for event in events[:100]]
