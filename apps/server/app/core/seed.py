DEMO_SHOPS = {
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

