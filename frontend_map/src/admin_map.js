import { PROJECT_CONFIG, LAYOUT_A, LAYOUT_B } from './config.js';
import { getSmartCoords } from './math_utils.js';
import { createGraphic } from './renderer.js';

require([
    "esri/Map", 
    "esri/views/SceneView",
    "esri/layers/GraphicsLayer",
    "esri/Graphic",
    "esri/geometry/Mesh",
    "esri/geometry/Point"
], function(
    ArcGISMap, 
    SceneView, 
    GraphicsLayer, 
    Graphic, 
    Mesh, 
    Point
) {

    // --- A. KHỞI TẠO MAP ---
    const map = new ArcGISMap({ 
        basemap: "gray-vector", 
        ground: "world-elevation" 
    });
    
    const view = new SceneView({
        container: "adminViewDiv",
        map: map,
        camera: { position: [106.78918, 10.80500, 150], heading: 0, tilt: 75 },
        environment: { lighting: { type: "virtual" } },
        popup: {
            defaultPopupTemplateEnabled: false,
            dockEnabled: true,
            dockOptions: { buttonEnabled: false, breakpoint: false }
        }
    });

    const logicLayer = new GraphicsLayer({ title: "Admin Logic" });
    map.add(logicLayer);

    // --- B. LOAD MÔ HÌNH NỀN ---
    const originPoint = new Point({
        longitude: PROJECT_CONFIG.center[0], latitude: PROJECT_CONFIG.center[1], z: 0
    });
    Mesh.createFromGLTF(originPoint, "./models/tong_quan_can_ho.glb")
        .then(function(geometry) {
            geometry.rotate(0, 0, -PROJECT_CONFIG.rotation);
            geometry.scale(1.0, { origin: originPoint });
            const glbGraphic = new Graphic({
                geometry: geometry,
                symbol: { type: "mesh-3d", symbolLayers: [{ type: "fill" }] }
            });
            map.add(new GraphicsLayer({ graphics: [glbGraphic] }));
        }).catch(e => console.warn("Lỗi GLB:", e));


    // =========================================================
    // HÀM CHUẨN HOÁ: ÉP MỌI THỨ VỀ DẠNG A.05.01
    // =========================================================
    function standardizeCode(code) {
        if (!code) return "";
        try {
            const parts = code.split('.');
            if (parts.length === 3) {
                let block = parts[0];
                let floor = parseInt(parts[1]);
                let unit = parts[2];
                let floorStr = floor < 10 ? `0${floor}` : `${floor}`;
                return `${block}.${floorStr}.${unit}`;
            }
        } catch (e) { return code; }
        return code;
    }

    // --- C. HÀM TẢI DỮ LIỆU & VẼ LẠI (QUAN TRỌNG) ---
    let dbDataMap = {}; 

    // Hàm này sẽ được gọi lần đầu VÀ gọi lại mỗi khi update xong
    function reloadAdminMapData() {
        console.log("🔄 Đang làm mới dữ liệu bản đồ...");
        fetch(`http://localhost:3000/api/admin/map-apartments?t=${Date.now()}`)
            .then(res => res.json())
            .then(data => {
                // 1. Reset dữ liệu cũ
                dbDataMap = {};
                
                // 2. Cập nhật dữ liệu mới
                data.forEach(item => {
                    const stdKey = standardizeCode(item.apt_code);
                    dbDataMap[stdKey] = item;
                });

                // 3. Xóa hình cũ và vẽ lại
                logicLayer.removeAll();
                startRenderingAdmin();
                console.log("✅ Đã cập nhật màu sắc bản đồ!");
            })
            .catch(err => console.error("Lỗi API Admin:", err));
    }

    // Gọi lần đầu tiên khi chạy trang
    reloadAdminMapData();

    // [PUBLIC HÀM RA NGOÀI] Để file admin.html gọi được
    window.refresh3DMap = reloadAdminMapData;


    // --- D. LOGIC VẼ ---
    function spawnUnitAdmin(anchorPoint, item, floorDisplay, z, h, type, blockName) {
        try {
            const c1 = getSmartCoords(anchorPoint, item.x, item.y);
            const c2 = getSmartCoords(anchorPoint, item.x + item.w, item.y);
            const c3 = getSmartCoords(anchorPoint, item.x + item.w, item.y + item.h);
            const c4 = getSmartCoords(anchorPoint, item.x, item.y + item.h);
            const rings = [[...c1, z], [...c2, z], [...c3, z], [...c4, z], [...c1, z]];

            // Tạo Mã Chuẩn (A.05.01)
            let suffix = item.c.split('.')[1] || item.c; 
            let fStr = floorDisplay.toString();
            if (type === "Apartment" && !isNaN(fStr)) {
                let fInt = parseInt(fStr);
                fStr = fInt < 10 ? `0${fInt}` : `${fInt}`;
            }
            let finalCode = (type === "Apartment") ? `${blockName}.${fStr}.${suffix}` : item.c;

            // Tra cứu
            const dbItem = dbDataMap[finalCode];
            
            // Logic màu sắc
            let color = [200, 200, 200];
            let statusText = type;
            let issueContent = ""; 

            if (type === "Apartment") {
                if (dbItem) {
                    if (dbItem.has_issue) {
                        color = [220, 53, 69]; // 🔴 ĐỎ
                        statusText = "⚠️ ĐANG CÓ SỰ CỐ";
                        issueContent = dbItem.issue_list 
                            ? `<hr><b>Danh sách sự cố:</b><br><div style="color:red">${dbItem.issue_list}</div>`
                            : `<hr><div style="color:red">Có yêu cầu xử lý</div>`;
                    } else if (dbItem.status === 1) {
                        color = [25, 135, 84]; // 🟢 XANH
                        statusText = "Đang ở";
                    } else {
                        color = [108, 117, 125]; // ⚪ XÁM
                        statusText = "Trống";
                    }
                } else {
                    statusText = "Chưa cập nhật";
                    color = [108, 117, 125];
                }
            } else if (type === "Shophouse") {
                color = [241, 196, 15]; 
            } else if (type === "Parking") {
                color = [52, 152, 219]; 
            }

            // Vẽ Graphic
            const graphic = createGraphic(Graphic, {
                rings: rings,
                height: h,
                symbolColor: color,
                attributes: { Code: finalCode, Status: statusText, Type: type },
                popupTemplate: {
                    title: "{Type} - {Code}",
                    content: `
                    <b>Trạng thái:</b> {Status}
                    ${issueContent}
                    <hr>
                    <button class="btn btn-sm btn-info text-white" onclick="window.showAptHistory('{Code}')">
                        🕒 Xem Lịch sử Căn hộ
                    </button>
                `
                }
            });
            logicLayer.add(graphic);

        } catch (e) { console.warn("Lỗi vẽ Admin:", item.c); }
    } 

    function startRenderingAdmin() {
        const anchorA = PROJECT_CONFIG.center;
        LAYOUT_A.forEach(item => spawnUnitAdmin(anchorA, item, "Trệt", 0, 7.0, "Shophouse", "A"));
        LAYOUT_A.forEach(item => spawnUnitAdmin(anchorA, item, "P.02", 7.0, 3.5, "Parking", "A"));
        LAYOUT_A.forEach(item => spawnUnitAdmin(anchorA, item, "P.03", 10.5, 3.5, "Parking", "A"));
        for (let f = 1; f <= 18; f++) {
            if (f === 13) continue;
            let idx = (f > 13) ? f - 2 : f - 1;
            let z = 14.0 + (idx * 3.2);
            LAYOUT_A.forEach(item => spawnUnitAdmin(anchorA, item, f, z, 3.2, item.t, "A"));
        }
        
        const anchorB = getSmartCoords(anchorA, 20.25, 4.0);
        LAYOUT_B.forEach(item => spawnUnitAdmin(anchorB, item, "Trệt", 0, 7.0, "Shophouse", "B"));
        LAYOUT_B.forEach(item => spawnUnitAdmin(anchorB, item, "P.02", 7.0, 3.5, "Parking", "B"));
        LAYOUT_B.forEach(item => spawnUnitAdmin(anchorB, item, "P.03", 10.5, 3.5, "Parking", "B"));
        for (let f = 1; f <= 18; f++) {
            if (f === 13) continue;
            let idx = (f > 13) ? f - 2 : f - 1;
            let z = 14.0 + (idx * 3.2);
            LAYOUT_B.forEach(item => spawnUnitAdmin(anchorB, item, f, z, 3.2, item.t, "B"));
        }
    }

    // HÀM BAY ĐẾN CĂN HỘ
    window.flyToApartment = function(aptCode) {
        console.log("✈️ Admin tìm:", aptCode);
        if (!logicLayer || logicLayer.graphics.length === 0) {
            alert("⏳ Đang tải bản đồ..."); return;
        }
        const stdCode = standardizeCode(aptCode);
        const g = logicLayer.graphics.find(g => g.attributes.Code === stdCode);

        if (g) {
            view.goTo({ target: g, tilt: 75, zoom: 20 }, { duration: 1500 });
            view.openPopup({ features: [g], location: g.geometry.centroid });
        } else {
            alert(`⚠️ Không tìm thấy vị trí: ${stdCode}`);
        }
    };
});