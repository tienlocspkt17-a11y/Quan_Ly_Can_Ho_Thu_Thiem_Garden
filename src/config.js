// src/config.js

// Cấu hình chung của dự án
export const PROJECT_CONFIG = {
    center: [106.78918, 10.80712], // Tâm dự án (Block A)
    rotation: 22,                  // Góc xoay
    shophouse_price: 15000000,     // Giá Shophouse mặc định
    rooftop_height: 1.0,           // Độ dày sàn sân thượng
    
    // Cầu nối: Tăng chiều dài (l) lên 13.0m để nối được Block B (đã bị đẩy ra xa)
    bridge: { w: 3.0, l: 13.0, x: 8.25, y: 6.5 } 
};

// Thông số chi tiết từng căn hộ (Diện tích, Phòng ngủ, Giá)
export const SPECS = {
    // Block A
    "A.01": { area: 63.87, beds: 2, price: 7500000 },
    "A.02": { area: 63.87, beds: 2, price: 7500000 },
    "A.03": { area: 61.50, beds: 2, price: 7500000 },
    "A.04": { area: 52.19, beds: 2, price: 7500000 },
    "A.05": { area: 48.93, beds: 1, price: 6500000 },
    "A.06": { area: 48.93, beds: 1, price: 6500000 },
    "A.07": { area: 64.04, beds: 2, price: 7500000 },
    "A.08": { area: 85.69, beds: 3, price: 9000000 }, // Căn 3PN lớn cạnh sảnh
    "A.09": { area: 52.19, beds: 2, price: 7500000 },
    "A.10": { area: 52.19, beds: 2, price: 7500000 },
    "A.11": { area: 63.87, beds: 2, price: 7500000 },
    "A.12": { area: 61.50, beds: 2, price: 7500000 },
    "A.12A":{ area: 63.87, beds: 2, price: 7500000 },
    "A.14": { area: 63.87, beds: 2, price: 7500000 },

    // Block B
    "B.01": { area: 63.87, beds: 2, price: 7500000 },
    "B.02": { area: 63.87, beds: 2, price: 7500000 },
    "B.03": { area: 52.19, beds: 2, price: 7500000 },
    "B.04": { area: 61.50, beds: 2, price: 7500000 },
    "B.05": { area: 64.04, beds: 2, price: 7500000 },
    "B.06": { area: 55.11, beds: 2, price: 7500000 },
    "B.07": { area: 61.50, beds: 2, price: 7500000 },
    "B.08": { area: 52.19, beds: 2, price: 7500000 },
    "B.09": { area: 61.50, beds: 2, price: 7500000 },
    "B.10": { area: 52.19, beds: 2, price: 7500000 },
    "B.11": { area: 63.87, beds: 2, price: 7500000 }
};

// LAYOUT BLOCK A (Đã cập nhật vị trí Rác sát A.05)
export const LAYOUT_A = [
    // Hành lang giữa
    { c: "HL",    t: "Corridor", x: -1.25, y: -24, w: 2.5, h: 56 },

    // --- CỘT TRÁI ---
    { c: "A.12A", t: "Apartment",x: -9.25, y: 24,  w: 8, h: 8 },
    { c: "A.11",  t: "Apartment",x: -9.25, y: 16,  w: 8, h: 8 },
    { c: "A.09",  t: "Apartment",x: -9.25, y: 8,   w: 8, h: 8 },
    { c: "A.07",  t: "Apartment",x: -9.25, y: 0,   w: 8, h: 8 },
    
    // A.05 (y=-8, h=8) -> Đáy tại -8
    { c: "A.05",  t: "Apartment",x: -9.25, y: -8,  w: 8, h: 8 },
    
    // Rác (y=-11, h=3) -> Đỉnh tại -8, Đáy tại -11 -> Khớp khít A.05
    { c: "Rác",   t: "Trash",    x: -9.25, y: -11, w: 8, h: 3 },
    
    // A.03 (y=-19, h=8) -> Đỉnh tại -11 -> Khớp khít Rác
    { c: "A.03",  t: "Apartment",x: -9.25, y: -19, w: 8, h: 8 },
    { c: "A.01",  t: "Apartment",x: -9.25, y: -27, w: 8, h: 8 },

    // --- CỘT PHẢI ---
    { c: "A.14",  t: "Apartment",x: 1.25,  y: 24,  w: 8, h: 8 },
    { c: "A.12",  t: "Apartment",x: 1.25,  y: 16,  w: 8, h: 8 },
    { c: "A.10",  t: "Apartment",x: 1.25,  y: 8,   w: 8, h: 8 },
    { c: "Sảnh",  t: "Lobby",    x: 1.25,  y: 0,   w: 8, h: 8 },
    
    // A.08 nhô ra bên phải Sảnh
    { c: "A.08",  t: "Apartment",x: 9.25,  y: 0,   w: 8, h: 8 },
    
    { c: "A.06",  t: "Apartment",x: 1.25,  y: -8,  w: 8, h: 8 },
    { c: "A.04",  t: "Apartment",x: 1.25,  y: -16, w: 8, h: 8 },
    { c: "A.02",  t: "Apartment",x: 1.25,  y: -24, w: 8, h: 8 }
];

// LAYOUT BLOCK B (3 Lớp: Gió cạnh B.10, B.05 đối diện Sảnh)
export const LAYOUT_B = [
    // HÀNH LANG CHÍNH
    { c: "HL_Main", t: "Corridor", x: 0,  y: 0,    w: 24, h: 2.5 },

    // === LANE 1: HÀNG DƯỚI CÙNG (Y = -8) ===
    { c: "B.02",  t: "Apartment",x: 0,  y: -8,   w: 8, h: 8 },
    { c: "B.04",  t: "Apartment",x: 8,  y: -8,   w: 8, h: 8 },
    { c: "B.06",  t: "Apartment",x: 16, y: -8,   w: 8, h: 8 }, // Dưới Sảnh

    // === LANE 2: HÀNG GIỮA (Y = 2.5) ===
    { c: "B.01",  t: "Apartment",x: 0,  y: 2.5,  w: 8, h: 8 },
    { c: "B.03",  t: "Apartment",x: 8,  y: 2.5,  w: 8, h: 8 },
    
    // Sảnh (Cùng cột X=16)
    { c: "Sảnh",  t: "Lobby",    x: 16, y: 2.5,  w: 8, h: 8 },
    
    // Rác (Kẹp giữa Sảnh và B08)
    { c: "Rác",   t: "Trash",    x: 24, y: 2.5,  w: 3, h: 8 },
    
    // B08 và B10
    { c: "B.08",  t: "Apartment",x: 27, y: 2.5,  w: 8, h: 8 },
    { c: "B.10",  t: "Apartment",x: 35, y: 2.5,  w: 8, h: 8 },
    
    // GIÓ: Cạnh B.10, cao bằng căn hộ (h=8)
    { c: "Gió",   t: "Wind",     x: 43, y: 2.5,  w: 4, h: 8 },

    // === LANE 3: HÀNG TRÊN CÙNG (Y = 14) ===
    // HÀNH LANG PHỤ
    { c: "HL_Sub", t: "Corridor", x: 16, y: 10.5, w: 32, h: 3.5 },

    // B.05 Đối diện Sảnh (Cùng X=16)
    { c: "B.05",  t: "Apartment",x: 16, y: 14,   w: 8, h: 8 },
    
    // Các căn còn lại nối đuôi
    { c: "B.07",  t: "Apartment",x: 24, y: 14,   w: 8, h: 8 },
    { c: "B.09",  t: "Apartment",x: 32, y: 14,   w: 8, h: 8 },
    { c: "B.11",  t: "Apartment",x: 40, y: 14,   w: 8, h: 8 }
];