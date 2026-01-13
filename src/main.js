// src/main.js
import { PROJECT_CONFIG, SPECS, LAYOUT_A, LAYOUT_B } from './config.js';
import { getSmartCoords } from './math_utils.js';
import { createGraphic } from './renderer.js';

require([
    "esri/Map",
    "esri/views/SceneView",
    "esri/layers/GraphicsLayer",
    "esri/Graphic",
    "esri/widgets/Slice",
    "esri/geometry/Mesh",
    "esri/geometry/Point"
], function(
    Map, SceneView, GraphicsLayer, Graphic, Slice, Mesh, Point
) {
    // --- 1. SETUP MAP ---
    const map = new Map({ basemap: "gray-vector", ground: "world-elevation" });
    map.ground.opacity = 1; 

    const view = new SceneView({
        container: "viewDiv",
        map: map,
        camera: { position: [106.78918, 10.80500, 150], heading: 0, tilt: 75 },
        environment: {
            atmosphereEnabled: true,
            lighting: { directShadowsEnabled: true, date: new Date("July 21, 2024 14:00:00") }
        }
    });

    const logicLayer = new GraphicsLayer({ title: "Logic Core" });
    const skinLayer = new GraphicsLayer({ title: "Exterior Skin" });
    map.addMany([logicLayer, skinLayer]);

    // --- 2. LOAD GLB ---
    const originPoint = new Point({
        longitude: PROJECT_CONFIG.center[0],
        latitude: PROJECT_CONFIG.center[1],
        z: 0
    });

    Mesh.createFromGLTF(originPoint, "./models/tong_quan_can_ho.glb")
        .then(function(geometry) {
            geometry.rotate(0, 0, -PROJECT_CONFIG.rotation); 
            geometry.scale(1.0, { origin: originPoint }); 
            skinLayer.add(new Graphic({
                geometry: geometry,
                symbol: { type: "mesh-3d", symbolLayers: [{ type: "fill" }] }
            }));
        })
        .catch(e => console.warn("Lỗi GLB:", e));

    // --- 3. SLICE TOOL ---
    const sliceWidget = new Slice({ view: view });
    sliceWidget.viewModel.excludedLayers.add(logicLayer);
    view.ui.add(sliceWidget, { position: "top-right" });


    // --- 4. HÀM XỬ LÝ LOGIC CĂN HỘ ---
    function spawnUnit(anchorPoint, item, floorDisplay, z, h, type, blockName) {
        try {
            // A. TÍNH TOÁN HÌNH HỌC (Gọi math_utils)
            // anchorPoint có thể là mảng [lon, lat]
            const c1 = getSmartCoords(anchorPoint, item.x, item.y);
            const c2 = getSmartCoords(anchorPoint, item.x + item.w, item.y);
            const c3 = getSmartCoords(anchorPoint, item.x + item.w, item.y + item.h);
            const c4 = getSmartCoords(anchorPoint, item.x, item.y + item.h);

            const rings = [[...c1, z], [...c2, z], [...c3, z], [...c4, z], [...c1, z]];

            // B. XỬ LÝ DỮ LIỆU & TRẠNG THÁI
            let status = 0; 
            let priceText = "Liên hệ"; 
            let rawPrice = 0;
            let area = 0; 
            let beds = 0;
            let direction = "Đang cập nhật"; 
            let imgUrl = "images/can-ho-2pn.jpg";

            // Lấy dữ liệu từ Config
if (type === "Apartment" && SPECS[item.c]) {
                const s = SPECS[item.c];
                area = s.area;
                beds = s.beds;
                rawPrice = s.price;
                direction = s.direction || direction;
            
                if (s.img) imgUrl = s.img; 
                
                status = Math.random() < 0.3 ? 1 : 0; 
                priceText = status === 1 ? "Đã có chủ" : rawPrice.toLocaleString('vi-VN') + " VNĐ";
            } else if (type === "Shophouse") {
                rawPrice = PROJECT_CONFIG.shophouse_price;
                priceText = rawPrice.toLocaleString('vi-VN');
            }

            // C. QUYẾT ĐỊNH MÀU SẮC (Truyền sang renderer)
            let color = [149, 165, 166]; // Mặc định xám (Kỹ thuật/Rác)
            if (type === "Apartment") color = (status === 0) ? [46, 204, 113] : [231, 76, 60]; // Xanh/Đỏ
            else if (type === "Shophouse") color = [241, 196, 15]; // Vàng
            else if (type === "Lobby") color = [52, 152, 219]; // Xanh dương
            else if (type === "Corridor") color = [236, 240, 241]; // Trắng mờ

            // D. TẠO POPUP CARD
            let suffix = item.c.split('.')[1] || item.c;
            let finalCode = (type === "Apartment") ? `${blockName}.${floorDisplay}.${suffix}` : item.c;

            const attr = {
                Code: finalCode, Type: type,
                Status: status === 0 ? "Còn trống" : "Đã thuê",
                StatusColor: status === 0 ? "green" : "red",
                Price: priceText, Area: area, Direction: direction, Img: imgUrl, Beds: beds,
                rawStatus: status, rawPrice: rawPrice, block: blockName
            };

            const popupTemplate = {
                title: "Căn hộ {Code}",
                content: `
                    <div style="font-family: sans-serif;">
                        <div style="width: 100%; height: 150px; margin-bottom: 10px;">
                            <img src="{Img}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;" alt="Ảnh căn hộ">
                        </div>
                        <table style="width: 100%; margin-bottom: 10px;">
                            <tr><td style="color:#7f8c8d">Trạng thái:</td><td style="font-weight:bold; color:{StatusColor}">{Status}</td></tr>
                            <tr><td style="color:#7f8c8d">Giá thuê:</td><td style="font-weight:bold; color:#e67e22">{Price}</td></tr>
                            <tr><td style="color:#7f8c8d">Diện tích:</td><td>{Area} m² ({Beds} PN)</td></tr>
                            <tr><td style="color:#7f8c8d">Hướng:</td><td>{Direction}</td></tr>
                        </table>
                        <button style="width:100%; padding:8px; background:#3498db; color:white; border:none; cursor:pointer; border-radius:4px;" onclick="alert('Đã gửi yêu cầu xem nhà!')">ĐĂNG KÝ XEM NHÀ</button>
                    </div>
                `
            };

            // E. GỌI RENDERER (Quan trọng: Truyền symbolColor và popupTemplate)
            logicLayer.add(createGraphic(Graphic, {
                rings: rings,
                height: h,
                symbolColor: color, // Màu do main tính toán
                attributes: attr,
                popupTemplate: popupTemplate // Popup do main thiết kế
            }));

        } catch (e) { console.warn("Lỗi:", item.c, e); }
    }


    // --- 5. BUILDINGS ---
    function buildBlock(anchor, layout, blockName) {
        // Khối đế
        layout.forEach(item => spawnUnit(anchor, item, "Trệt", 0, 7.0, "Shophouse", blockName));
        layout.forEach(item => spawnUnit(anchor, item, "P.02", 7.0, 3.5, "Parking", blockName));
        layout.forEach(item => spawnUnit(anchor, item, "P.03", 10.5, 3.5, "Parking", blockName));
        
        // Khối căn hộ
        const startZ = 14.0;
        for (let f = 1; f <= 18; f++) {
            if (f === 13) continue;
            let idx = (f > 13) ? f - 2 : f - 1;
            let z = startZ + (idx * 3.2);
            layout.forEach(item => spawnUnit(anchor, item, f, z, 3.2, item.t, blockName));
        }
        
        // Sân thượng
        let roofZ = startZ + (17 * 3.2);
        layout.forEach(item => spawnUnit(anchor, item, "Thượng", roofZ, PROJECT_CONFIG.rooftop_height, "Rooftop", blockName));
    }

    // --- 6. RUN ---
    const anchorA = PROJECT_CONFIG.center;
    buildBlock(anchorA, LAYOUT_A, "A");

    // Block B Offset
    const anchorB = getSmartCoords(anchorA, 20.25, 4.0);
    buildBlock(anchorB, LAYOUT_B, "B");
    
    // Cầu nối
    const { w, l, x, y } = PROJECT_CONFIG.bridge;
    let zBridge11 = 14.0 + (10 * 3.2);
    spawnUnit(anchorA, {x:x, y:y, w:l, h:w, c:"Cầu"}, 11, zBridge11, 3.0, "Bridge", "Main");


    // --- 7. FILTER ---
    let allGraphics = [];
    view.when(() => {
        setTimeout(() => {
            allGraphics = logicLayer.graphics.clone();
            console.log(`Loaded ${allGraphics.length} units.`);
        }, 1500);
    });

    function applyFilter() {
        const blockVal = document.getElementById("selBlock").value;
        const statusVal = document.getElementById("selStatus").value;
        const priceVal = document.getElementById("selPrice").value;

        logicLayer.removeAll();

        const filtered = allGraphics.filter(graphic => {
            const attr = graphic.attributes;
            if (!attr) return false;

            if (blockVal !== "All" && attr.block !== blockVal) return false;
            if (statusVal !== "All" && attr.Type === "Apartment" && parseInt(statusVal) !== attr.rawStatus) return false;
            if (priceVal !== "All" && attr.rawPrice !== parseInt(priceVal)) return false;

            return true;
        });

        logicLayer.addMany(filtered);
    }

    ["selBlock", "selStatus", "selPrice"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("change", applyFilter);
    });
    document.getElementById("btnFilter").addEventListener("click", applyFilter);
});