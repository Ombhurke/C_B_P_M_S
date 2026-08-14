from fastapi import APIRouter, HTTPException
from typing import List, Dict
from app.models.schemas import ShopSchema, ShopUpdateRequest, PrinterSchema

router = APIRouter(prefix="/shops", tags=["Shops"])

# In-memory mock database for multi-tenant shop profiles and printers
SHOPS_DB: Dict[str, dict] = {
    "shop-demo-1": {
        "id": "shop-demo-1",
        "name": "QuickPrint Express - Hub 1",
        "email": "counter1@quickprint.io",
        "phone": "+91 98765 43210",
        "address": "University North Gate, Block A",
        "base_bw_rate": 2.00,
        "base_color_rate": 10.00,
        "duplex_discount": 0.50,
        "currency": "INR",
        "is_active": True,
        "printers": [
            {
                "id": "printer-1",
                "shop_id": "shop-demo-1",
                "device_name": "HP LaserJet Pro M404dn (B&W High Speed)",
                "driver_name": "HP LaserJet Pro M404 PCL6",
                "is_color_supported": False,
                "is_duplex_supported": True,
                "max_paper_size": "A4",
                "status": "online"
            },
            {
                "id": "printer-2",
                "shop_id": "shop-demo-1",
                "device_name": "Canon imageRUNNER C3226 (Color & Duplex)",
                "driver_name": "Canon Generic Plus UFR II",
                "is_color_supported": True,
                "is_duplex_supported": True,
                "max_paper_size": "A3",
                "status": "online"
            }
        ]
    },
    "shop-demo-2": {
        "id": "shop-demo-2",
        "name": "City Copy & Print Center",
        "email": "citycopy@printcenter.com",
        "phone": "+91 91234 56789",
        "address": "Main Market Commercial Plaza #4",
        "base_bw_rate": 3.00,
        "base_color_rate": 12.00,
        "duplex_discount": 1.00,
        "currency": "INR",
        "is_active": True,
        "printers": [
            {
                "id": "printer-3",
                "shop_id": "shop-demo-2",
                "device_name": "Epson EcoTank L6490",
                "driver_name": "EPSON L6490 Series",
                "is_color_supported": True,
                "is_duplex_supported": True,
                "max_paper_size": "A4",
                "status": "online"
            }
        ]
    }
}


@router.get("", response_model=List[ShopSchema])
async def list_shops():
    return list(SHOPS_DB.values())


@router.get("/{shop_id}", response_model=ShopSchema)
async def get_shop(shop_id: str):
    shop = SHOPS_DB.get(shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail=f"Shop '{shop_id}' not found")
    return shop


@router.patch("/{shop_id}", response_model=ShopSchema)
async def update_shop_rates(shop_id: str, payload: ShopUpdateRequest):
    shop = SHOPS_DB.get(shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail=f"Shop '{shop_id}' not found")
    
    if payload.name is not None:
        shop["name"] = payload.name
    if payload.base_bw_rate is not None:
        shop["base_bw_rate"] = payload.base_bw_rate
    if payload.base_color_rate is not None:
        shop["base_color_rate"] = payload.base_color_rate
    if payload.duplex_discount is not None:
        shop["duplex_discount"] = payload.duplex_discount
        
    return shop


@router.get("/{shop_id}/printers", response_model=List[PrinterSchema])
async def list_shop_printers(shop_id: str):
    shop = SHOPS_DB.get(shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail=f"Shop '{shop_id}' not found")
    return shop.get("printers", [])
