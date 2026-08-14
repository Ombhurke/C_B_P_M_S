-- Seed data for testing and initial deployment
INSERT INTO shops (id, name, email, phone, address, base_bw_rate, base_color_rate, duplex_discount, currency, is_active)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 'QuickPrint Express - Hub 1', 'counter1@quickprint.io', '+91 98765 43210', 'University North Gate, Block A', 2.00, 10.00, 0.50, 'INR', TRUE),
    ('a0000000-0000-0000-0000-000000000002', 'City Copy & Print Center', 'citycopy@printcenter.com', '+91 91234 56789', 'Main Market Commercial Plaza #4', 3.00, 12.00, 1.00, 'INR', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO printers (id, shop_id, device_name, driver_name, is_color_supported, is_duplex_supported, max_paper_size, status)
VALUES 
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'HP LaserJet Pro M404dn (B&W High Speed)', 'HP LaserJet Pro M404 PCL6', FALSE, TRUE, 'A4', 'online'),
    ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Canon imageRUNNER C3226 (Color & Duplex)', 'Canon Generic Plus UFR II', TRUE, TRUE, 'A3', 'online'),
    ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'Epson EcoTank L6490', 'EPSON L6490 Series', TRUE, TRUE, 'A4', 'online')
ON CONFLICT (id) DO NOTHING;
