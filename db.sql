-- ================================================================
-- 1. BẢNG TÒA NHÀ (Gốc)
CREATE TABLE buildings (
    building_id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    total_floors INTEGER DEFAULT 18
);

-- 2. BẢNG TẦNG
CREATE TABLE floors (
    floor_id SERIAL PRIMARY KEY,
    building_id INTEGER REFERENCES buildings(building_id),
    floor_name VARCHAR(50),
    floor_number INTEGER,
    base_elevation DOUBLE PRECISION,
    ceiling_height DOUBLE PRECISION DEFAULT 3.2
);

-- 3. BẢNG TIỆN ÍCH (Amenities)
CREATE TABLE amenities (
    amenity_id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    elevation DOUBLE PRECISION,
    building_id INTEGER REFERENCES buildings(building_id)
);

-- 4. BẢNG KHU VỰC ĐỖ XE (Parking Zones)
CREATE TABLE parking_zones (
    zone_id SERIAL PRIMARY KEY,
    zone_name VARCHAR(50),
    capacity INTEGER,
    current_count INTEGER DEFAULT 0,
    building_id INTEGER REFERENCES buildings(building_id)
);

-- 5. BẢNG Ô ĐỖ XE (Parking Slots)
CREATE TABLE parking_slots (
    slot_id SERIAL PRIMARY KEY,
    slot_code VARCHAR(20),
    status INTEGER DEFAULT 0, -- 0: Trống, 1: Có xe
    zone_id INTEGER REFERENCES parking_zones(zone_id)
);

-- 6. BẢNG CĂN HỘ (Apartments) - Quan trọng nhất
CREATE TABLE apartments (
    apt_id SERIAL PRIMARY KEY,
    floor_id INTEGER REFERENCES floors(floor_id),
    apt_code VARCHAR(20) UNIQUE, -- Mã căn hộ (A.05.01)
    area DOUBLE PRECISION,
    type VARCHAR(20),
    price NUMERIC(15, 2),
    status INTEGER DEFAULT 0,    -- 0: Trống, 1: Đã thuê
    beds INTEGER,
    direction VARCHAR(50),
    image_url TEXT,
    extrude_h DOUBLE PRECISION DEFAULT 3.2,
    block_name VARCHAR(5),       -- 'A' hoặc 'B'
    floor INTEGER                -- Số tầng (để lọc nhanh)
);

-- 7. BẢNG NỘI THẤT (Furniture)
CREATE TABLE furniture (
    item_id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    condition VARCHAR(50),
    apt_id INTEGER REFERENCES apartments(apt_id)
);

-- 8. BẢNG CƯ DÂN (Residents)
CREATE TABLE residents (
    res_id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    identity_card VARCHAR(20),
    email VARCHAR(100)
);

-- 9. BẢNG TÀI KHOẢN (Accounts)
CREATE TABLE accounts (
    account_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(50) NOT NULL,
    role VARCHAR(20),
    res_id INTEGER REFERENCES residents(res_id)
);

-- 10. BẢNG HỢP ĐỒNG (Contracts)
CREATE TABLE contracts (
    contract_id SERIAL PRIMARY KEY,
    apt_id INTEGER REFERENCES apartments(apt_id),
    res_id INTEGER REFERENCES residents(res_id),
    start_date DATE,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'Active'
);

-- 11. BẢNG TƯ VẤN (Consultations)
CREATE TABLE consultations (
    consul_id SERIAL PRIMARY KEY,
    customer_name VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    apt_id INTEGER REFERENCES apartments(apt_id), -- Đã thêm FK để đảm bảo logic
    note TEXT,
    status VARCHAR(20) DEFAULT 'New',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. BẢNG YÊU CẦU (Requests)
CREATE TABLE requests (
    request_id SERIAL PRIMARY KEY,
    apt_id INTEGER REFERENCES apartments(apt_id),
    content TEXT,
    status VARCHAR(50) DEFAULT 'New',
    item_id INTEGER
);

-- 13. BẢNG DỊCH VỤ (Services)
CREATE TABLE services (
    service_id SERIAL PRIMARY KEY,
    name VARCHAR(50),
    unit_price NUMERIC(10, 2)
);

-- 14. BẢNG HÓA ĐƠN (Invoices)
CREATE TABLE invoices (
    invoice_id SERIAL PRIMARY KEY,
    contract_id INTEGER REFERENCES contracts(contract_id),
    month VARCHAR(10),
    total_amount NUMERIC(15, 2),
    is_paid BOOLEAN DEFAULT false
);

-- 15. BẢNG CHI TIẾT HÓA ĐƠN (Invoice Details)
CREATE TABLE invoice_details (
    detail_id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(invoice_id),
    service_id INTEGER REFERENCES services(service_id),
    usage_amount DOUBLE PRECISION,
    sub_total NUMERIC(15, 2)
);

-- 16. BẢNG PHƯƠNG TIỆN (Vehicles)
CREATE TABLE vehicles (
    vehicle_id SERIAL PRIMARY KEY,
    license_plate VARCHAR(20),
    type VARCHAR(20),
    apt_id INTEGER REFERENCES apartments(apt_id),
    slot_id INTEGER REFERENCES parking_slots(slot_id),
    status VARCHAR(20) DEFAULT 'Pending'
);
-- ================================================================
-- BƯỚC 3: NẠP DỮ LIỆU MẪU (SEEDING)
-- ================================================================

-- 1. Tạo Tòa nhà
INSERT INTO buildings (name) VALUES ('Block A'), ('Block B');

-- 2. Tạo Tầng & Căn hộ
DO $$
DECLARE 
    b INT; f INT; floor_id_new INT; floor_name_text VARCHAR;
    i INT; status_val INT; block_char VARCHAR;
BEGIN
    FOR b IN 1..2 LOOP 
        block_char := CASE WHEN b=1 THEN 'A' ELSE 'B' END;
        
        FOR f IN 1..18 LOOP
            IF f <> 13 THEN
                -- Tạo Tầng
                floor_name_text := CASE WHEN f=1 THEN 'Trệt' ELSE 'Tầng ' || f END;
                INSERT INTO floors (building_id, floor_name, floor_number, base_elevation) 
                VALUES (b, floor_name_text, f, (f-1)*3.2)
                RETURNING floor_id INTO floor_id_new;

                -- Tạo Căn hộ
                FOR i IN 1..8 LOOP
                    status_val := floor(random()*2); 
                    
                    INSERT INTO apartments (floor_id, apt_code, area, type, price, status, beds, direction, image_url, block_name)
                    VALUES (
                        floor_id_new,
                        CONCAT(block_char, '.', f, '.', LPAD(i::text, 2, '0')), -- VD: A.5.01
                        60.0, 'Apartment', 7000000, status_val, 2, 'Đông Nam', './images/can-ho-2pn.jpg', block_char
                    );
                END LOOP;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- 3. Tạo Dữ liệu Đăng nhập (QUAN TRỌNG)
-- Admin
INSERT INTO accounts (username, password, role) VALUES ('admin', '123', 'admin');

-- Cư dân mẫu: Nguyễn Văn A
INSERT INTO residents (full_name, phone, identity_card, email) 
VALUES ('Nguyễn Văn A', '0909000111', '079123456789', 'a@gmail.com');

INSERT INTO accounts (username, password, role, res_id) 
VALUES ('cudana', '123', 'resident', 1);

-- Link cư dân với căn A.5.01
INSERT INTO contracts (apt_id, res_id, start_date, end_date, status)
VALUES (
    (SELECT apt_id FROM apartments WHERE apt_code='A.5.01'),
    1, '2024-01-01', '2025-01-01', 'Active'
);
-- Set căn A.5.01 thành Đã thuê
UPDATE apartments SET status = 1 WHERE apt_code='A.5.01';

-- Hóa đơn mẫu
INSERT INTO invoices (contract_id, month, total_amount, is_paid)
VALUES (1, '05/2024', 1500000, FALSE);

-- Kiểm tra kết quả
SELECT * FROM accounts;