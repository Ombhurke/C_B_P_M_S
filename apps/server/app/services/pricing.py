import math
from decimal import Decimal, ROUND_HALF_UP
from fastapi import HTTPException


def calculate_cost(shop, page_count, copy_count, is_color, duplex_mode, layout_nup, paper_type="normal"):
    if not 1 <= page_count <= 1000 or not 1 <= copy_count <= 50:
        raise HTTPException(422, "Invalid page count or copies")
    supported_layouts = shop.get("supported_layouts") or [1, 2, 4, 8]
    if layout_nup not in supported_layouts:
        raise HTTPException(422, f"Invalid layout {layout_nup}-up; shop supports {supported_layouts}")
    if duplex_mode not in ("simplex", "duplex_long", "duplex_short"):
        raise HTTPException(422, "Invalid duplex mode")
    if duplex_mode != "simplex" and not shop.get("supports_duplex", True):
        raise HTTPException(422, "Double-sided printing is not supported by this shop")
    if is_color and not shop.get("supports_color", True):
        raise HTTPException(422, "Color printing is not supported by this shop")
    if not is_color and not shop.get("supports_bw", True):
        raise HTTPException(422, "B&W printing is not supported by this shop")

    if not any((not is_color or p["is_color_supported"]) and
               (duplex_mode == "simplex" or p["is_duplex_supported"])
               for p in shop.get("printers", [])):
        raise HTTPException(422, "No registered printer supports these options")

    # Group pages into sides based on N-up (2-4-8 pages per sheet have no extra cost)
    sides = math.ceil(page_count / layout_nup)
    sheets = math.ceil(sides / 2) if duplex_mode != "simplex" else sides

    paper_rates = shop.get("paper_rates")
    paper_config = None
    if paper_rates and paper_type in paper_rates:
        paper_config = paper_rates[paper_type]
    elif paper_type == "bond":
        paper_config = {"bw_single": 3.0, "bw_duplex": 5.0, "color_single": 12.0, "color_duplex": 22.0}

    if paper_config:
        if is_color:
            simplex_rate = Decimal(str(paper_config.get("color_single", paper_config.get("color_simplex_rate", shop.get("base_color_rate", 10.0)))))
            duplex_sheet_rate = Decimal(str(paper_config.get("color_duplex", paper_config.get("color_duplex_rate", simplex_rate * 2))))
        else:
            simplex_rate = Decimal(str(paper_config.get("bw_single", paper_config.get("bw_simplex_rate", shop.get("base_bw_rate", 2.0)))))
            default_duplex = simplex_rate * 2 - Decimal(str(shop.get("duplex_discount", 1.0)))
            duplex_sheet_rate = Decimal(str(paper_config.get("bw_duplex", paper_config.get("bw_duplex_rate", default_duplex))))

        if duplex_mode == "simplex":
            cost = sides * copy_count * simplex_rate
            discount = Decimal(0)
            rate_per_page = simplex_rate
        else:
            duplex_sheets = sides // 2
            odd_sides = sides % 2
            cost = copy_count * (duplex_sheets * duplex_sheet_rate + odd_sides * simplex_rate)
            undiscounted = sides * copy_count * simplex_rate
            discount = max(Decimal(0), undiscounted - cost)
            rate_per_page = simplex_rate
    else:
        rate = Decimal(str(shop["base_color_rate"] if is_color else shop["base_bw_rate"]))
        discount = (Decimal(str(shop["duplex_discount"])) * (sides // 2) * copy_count
                    if duplex_mode != "simplex" else Decimal(0))
        cost = max(Decimal(0), sides * copy_count * rate - discount)
        rate_per_page = rate

    return {"page_count": page_count, "copy_count": copy_count, "is_color": is_color,
            "duplex_mode": duplex_mode, "layout_nup": layout_nup, "paper_type": paper_type,
            "sheets_per_copy": sheets, "total_sheets": sheets * copy_count,
            "rate_per_page": float(rate_per_page), "discount": float(discount.quantize(Decimal('.01'))),
            "total_cost": float(cost.quantize(Decimal('.01'), rounding=ROUND_HALF_UP)),
            "currency": shop["currency"]}
