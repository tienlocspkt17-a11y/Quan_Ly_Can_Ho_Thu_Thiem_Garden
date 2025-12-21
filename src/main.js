// src/main.js
import { PROJECT_CONFIG, SPECS, LAYOUT_A, LAYOUT_B } from './config.js';
import { getSmartCoords } from './math_utils.js';
import { createGraphic } from './renderer.js';

require([
    "esri/Map", "esri/views/SceneView", "esri/layers/GraphicsLayer", "esri/Graphic"
], function(Map, SceneView, GraphicsLayer, Graphic) {

    // 1. Tạo Map & View
    const map = new Map({ 
        basemap: "gray-vector", 
        ground: "world-elevation" 
    });

    // Mặt đất bình thường (không cần trong suốt nữa vì hầm đã nằm nổi)
    map.ground.opacity = 1; 

    const view = new SceneView({
        container: "viewDiv",
        map: map,
        camera: { position: [106.78918, 10.80500, 150], heading: 0, tilt: 75 },
        environment: {
            atmosphereEnabled: false,
            starsEnabled: false
        }
    });

    const graphicsLayer = new GraphicsLayer();
    map.add(graphicsLayer);

    // 2. Hàm vẽ khối cơ bản
    function spawnUnit(anchor, item, floorDisplay, z, h, type, blockName) {
        try {
            // Tính toán 4 điểm chân của khối
            const c1 = getSmartCoords(anchor, item.x, item.y);
            const c2 = getSmartCoords(anchor, item.x + item.w, item.y);
            const c3 = getSmartCoords(anchor, item.x + item.w, item.y + item.h);
            const c4 = getSmartCoords(anchor, item.x, item.y + item.h);

            // Gán độ cao Z vào tọa độ
            const p1 = [c1[0], c1[1], z];
            const p2 = [c2[0], c2[1], z];
            const p3 = [c3[0], c3[1], z];
            const p4 = [c4[0], c4[1], z];
            const rings = [p1, p2, p3, p4, p1];

            // Tự động tạo tên căn hộ (VD: A.01 + Tầng 5 -> A5.01)
            let finalCode = item.c;
            let suffix = item.c.split('.')[1] || item.c;
            
            if (type === "Apartment") {
                if (!isNaN(parseFloat(floorDisplay)) || floorDisplay.includes("A")) {
                     finalCode = `${blockName}${floorDisplay}.${suffix}`;
                }
            }
            
            // Xử lý giá tiền & trạng thái
            let status = 0; let price = 0; let area = 0;
            if (type === "Apartment" && SPECS[item.c]) {
                price = SPECS[item.c].price;
                area = SPECS[item.c].area;
                status = Math.random() < 0.3 ? 1 : 0; // Random trạng thái đã thuê
                if (status === 1) price = 0;
            } else if (type === "Shophouse") {
                price = PROJECT_CONFIG.shophouse_price;
            }

            const data = {
                id: `${blockName}_${floorDisplay}_${item.c}`,
                code: finalCode,
                floor: floorDisplay,
                type: type,
                status: status,
                price: price,
                area: area,
                height: h,
                rings: rings
            };
            graphicsLayer.add(createGraphic(Graphic, data));
        } catch (e) { 
            console.warn("Error drawing:", item.c, e); 
        }
    }

    // 3. Hàm xây dựng toàn bộ tòa nhà
    function buildBlock(anchor, layout, blockName) {
        // --- KHỐI ĐẾ (3 TẦNG) ---
        
        // Tầng 1: Shophouse (Cao 7m)
        layout.forEach(item => spawnUnit(anchor, item, "Trệt", 0, 7.0, "Shophouse", blockName));

        // Tầng 2: P.02 - Bãi xe nổi (Cao 3.5m, nằm trên Shophouse)
        layout.forEach(item => spawnUnit(anchor, item, "P.02", 7.0, 3.5, "Parking", blockName));
        
        // Tầng 3: P.03 - Bãi xe nổi (Cao 3.5m, nằm trên P.02)
        layout.forEach(item => spawnUnit(anchor, item, "P.03", 10.5, 3.5, "Parking", blockName));


        // --- KHỐI CĂN HỘ (TẦNG 4 TRỞ LÊN) ---
        // Bắt đầu từ độ cao 14m (7 + 3.5 + 3.5)
        const startZ = 14.0; 

        for (let f = 1; f <= 18; f++) {
            if (f === 13) continue; // Kiêng số 13
            let idx = (f > 13) ? f - 2 : f - 1;
            let z = startZ + (idx * 3.2);

            layout.forEach(item => {
                spawnUnit(anchor, item, f, z, 3.2, item.t, blockName);
            });
        }

        // --- SÂN THƯỢNG ---
        let roofZ = startZ + (17 * 3.2);
        layout.forEach(item => spawnUnit(anchor, item, "Thượng", roofZ, PROJECT_CONFIG.rooftop_height, "Rooftop", blockName));
    }

    // 4. Chạy Logic Xây Dựng
    const anchorA = PROJECT_CONFIG.center;
    buildBlock(anchorA, LAYOUT_A, "A");

    // Xây dựng Block B
    // Dời Block B sang phải (X = 20.25) để tạo khoảng cách 3m với A.08 (X max = 17.25)
    const anchorB = getSmartCoords(anchorA, 20.25, 4.0);
    buildBlock(anchorB, LAYOUT_B, "B");

    // 5. Cầu nối (Cập nhật độ cao theo Shophouse mới)
    const { w, l, x, y } = PROJECT_CONFIG.bridge;
    // Căn hộ bắt đầu từ 14m. Cầu ở tầng 11
    let zBridge11 = 14.0 + (10 * 3.2);
    spawnUnit(anchorA, {x:x, y:y, w:l, h:w, c:"Cầu"}, 11, zBridge11, 3.0, "Bridge", "Main");
    
    let zBridgeTop = 14.0 + (17 * 3.2);
    spawnUnit(anchorA, {x:x, y:y, w:l, h:w, c:"Cầu Thượng"}, "Thượng", zBridgeTop, PROJECT_CONFIG.rooftop_height, "Bridge", "Main");
    
    console.log("Dự án đã cập nhật hoàn tất: 3 Tầng đế, Cách 3m, Block A/B chuẩn!");
});