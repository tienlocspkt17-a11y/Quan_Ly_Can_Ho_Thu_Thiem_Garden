// src/main.js - Phiên bản Final: Tích hợp Sales & Admin

import { PROJECT_CONFIG, SPECS, LAYOUT_A, LAYOUT_B } from './config.js';
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
    Map, SceneView, GraphicsLayer, Graphic, Mesh, Point
) {

    // --- 1. KHỞI TẠO BẢN ĐỒ ---
    const map = new Map({ basemap: "gray-vector", ground: "world-elevation" });
    
    const view = new SceneView({
        container: "viewDiv",
        map: map,
        camera: { position: [106.78918, 10.80500, 150], heading: 0, tilt: 75 },
        environment: {
            atmosphereEnabled: true,
            lighting: { directShadowsEnabled: true, date: new Date("July 21, 2024 14:00:00") }
        },
        ui: { components: ["attribution", "navigation-toggle", "compass", "zoom"] }
    });

    const logicLayer = new GraphicsLayer({ title: "Logic Core" });
    const skinLayer = new GraphicsLayer({ title: "Exterior Skin" });
    map.addMany([logicLayer, skinLayer]);

    // Load Model vỏ ngoài (Skin)
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
        }).catch(e => console.warn("Lỗi tải Model GLB:", e));


    // =========================================================================
    // 2. KẾT NỐI SERVER BACKEND
    // =========================================================================
    
    let dbDataMap = {}; 
    let isDataLoaded = false;

    async function initApp() {
        try {
            console.log("🌐 Đang kết nối đến Server...");
            // Thêm ?t=... để tránh cache trình duyệt
            const response = await fetch(`http://localhost:3000/api/apartments?t=${new Date().getTime()}`);
            if (!response.ok) throw new Error("Lỗi mạng hoặc Server chưa chạy");
            const data = await response.json();
            console.log(`✅ Đã tải thành công ${data.length} căn hộ!`);

            data.forEach(item => { 
                // Ưu tiên dùng apt_code, nếu không có thì dùng code
                const code = item.apt_code || item.code;
                dbDataMap[code] = item; 
            });
            isDataLoaded = true;

        } catch (error) {
            console.error("❌ KHÔNG KẾT NỐI ĐƯỢC SERVER:", error);
        } finally {
            startRendering3D();
        }
    }
    initApp();

    // =========================================================================
    // 3. LOGIC VẼ 3D
    // =========================================================================

    function spawnUnit(anchorPoint, item, floorDisplay, z, h, type, blockName) {
        try {
            // A. Tạo hình khối
            const c1 = getSmartCoords(anchorPoint, item.x, item.y);
            const c2 = getSmartCoords(anchorPoint, item.x + item.w, item.y);
            const c3 = getSmartCoords(anchorPoint, item.x + item.w, item.y + item.h);
            const c4 = getSmartCoords(anchorPoint, item.x, item.y + item.h);
            const rings = [[...c1, z], [...c2, z], [...c3, z], [...c4, z], [...c1, z]];

            // B. Chuẩn hóa dữ liệu
            let suffix = item.c.split('.')[1] || item.c; 

            let fStr = floorDisplay.toString();
            // Chỉ thêm số 0 nếu là Căn hộ và tầng < 10 (và không phải chữ như 'Trệt')
            if (type === "Apartment" && !isNaN(fStr) && parseInt(fStr) < 10) {
                fStr = '0' + parseInt(fStr);
            }

            // Tạo mã finalCode (Lúc này sẽ là A.05.01 thay vì A.5.01)
            let finalCode = (type === "Apartment") ? `${blockName}.${fStr}.${suffix}` : item.c;

            let dbItem = dbDataMap[finalCode];
            
            // Khởi tạo giá trị mặc định
            let status = 0; 
            let priceText = "Liên hệ"; 
            let rawPrice = 0;
            let area = 0; 
            let beds = 0;
            let direction = "Đang cập nhật"; 
            let imgUrl = "./images/can-ho-2pn.jpg";
            let aptId = null; // [MỚI] ID căn hộ trong DB

            if (dbItem) {
                status = dbItem.status;
                rawPrice = parseInt(dbItem.rent_price || dbItem.price); // Fix tên cột
                priceText = (rawPrice / 1000000).toLocaleString('vi-VN') + " Triệu/tháng";
                area = dbItem.area;
                beds = dbItem.beds; // DB cột là beds
                direction = dbItem.direction;
                aptId = dbItem.apt_id; // [QUAN TRỌNG] Lấy ID để chốt đơn
                
                if (dbItem.image_url) imgUrl = dbItem.image_url;
            } else {
                if (type === "Shophouse") {
                    rawPrice = PROJECT_CONFIG.shophouse_price;
                    priceText = (rawPrice / 1000000).toLocaleString('vi-VN') + " Tỷ";
                }
            }

            // C. Màu sắc
            let color = [189, 195, 199];
            if (type === "Apartment") {
                if (status === 1) color = [231, 76, 60];  // Đỏ (Đã thuê)
                else color = [46, 204, 113];             // Xanh (Trống)
            } else if (type === "Shophouse") color = [241, 196, 15]; 
            else if (type === "Lobby") color = [52, 152, 219];

            const attr = {
                Code: finalCode, Type: type,
                Floor: floorDisplay.toString(),
                Status: status === 0 ? "Còn trống" : "Đã thuê",
                StatusColor: status === 0 ? "green" : "red",
                Price: priceText, Area: area, Direction: direction, Img: imgUrl, Beds: beds,
                rawStatus: status, rawPrice: rawPrice, block: blockName,
                AptId: aptId // [QUAN TRỌNG] Đưa ID vào thuộc tính Graphic
            };

            // TẠO POPUP NHỎ (Khi click vào 3D)
            const smallPopupTemplate = {
                title: "Căn hộ {Code}",
                content: function(feature) {
                    const a = feature.graphic.attributes;
                    const div = document.createElement("div");
                    div.innerHTML = `
                        <table class="table table-sm table-borderless" style="margin-bottom:5px;">
                            <tr><td><strong>Trạng thái:</strong></td><td style="color:${a.StatusColor}; font-weight:bold">${a.Status}</td></tr>
                            <tr><td><strong>Giá:</strong></td><td style="color:#e67e22; font-weight:bold">${a.Price}</td></tr>
                            <tr><td><strong>Diện tích:</strong></td><td>${a.Area} m²</td></tr>
                        </table>
                        <button class="btn btn-primary btn-sm w-100 mt-2 btn-view-full">
                            <i class="flaticon-house"></i> Xem chi tiết
                        </button>
                    `;
                    
                    const btn = div.querySelector(".btn-view-full");
                    btn.onclick = function() {
                        window.showModalDetails(feature.graphic); 
                    };

                    return div;
                }
            };

            // D. Thêm vào Layer
            logicLayer.add(createGraphic(Graphic, {
                rings: rings,
                height: h,
                symbolColor: color,
                attributes: attr,
                popupTemplate: (type === "Apartment" || type === "Shophouse") ? smallPopupTemplate : null
            }));

        } catch (e) { console.warn("Render error:", item.c); }
    }

    function buildBlock(anchor, layout, blockName) {
        layout.forEach(item => spawnUnit(anchor, item, "Trệt", 0, 7.0, "Shophouse", blockName));
        layout.forEach(item => spawnUnit(anchor, item, "P.02", 7.0, 3.5, "Parking", blockName));
        layout.forEach(item => spawnUnit(anchor, item, "P.03", 10.5, 3.5, "Parking", blockName));
        
        const startZ = 14.0;
        for (let f = 1; f <= 18; f++) {
            if (f === 13) continue;
            let idx = (f > 13) ? f - 2 : f - 1;
            let z = startZ + (idx * 3.2);
            layout.forEach(item => spawnUnit(anchor, item, f, z, 3.2, item.t, blockName));
        }
    }

    function startRendering3D() {
        logicLayer.removeAll();
        const anchorA = PROJECT_CONFIG.center;
        buildBlock(anchorA, LAYOUT_A, "A");
        const anchorB = getSmartCoords(anchorA, 20.25, 4.0);
        buildBlock(anchorB, LAYOUT_B, "B");
        
        // Cầu nối
        const { w, l, x, y } = PROJECT_CONFIG.bridge;
        let zBridge = 14.0 + (10 * 3.2);
        spawnUnit(anchorA, {x:x, y:y, w:l, h:w, c:"Cầu"}, 11, zBridge, 3.0, "Bridge", "Main");

        view.when(() => {
            setTimeout(() => {
                window.allGraphics = logicLayer.graphics.clone();
            }, 1000);
        });
    }

    // =========================================================================
    // 4. SỰ KIỆN & TƯƠNG TÁC
    // =========================================================================

    // B. Hàm Lọc (Filter) - Đồng bộ với UI mới
// =========================================================================
    // HÀM LỌC NÂNG CẤP (Ẩn rác + Zoom 3D + Đủ nút)
    // =========================================================================
 // =========================================================================
    // HÀM LỌC & HIỂN THỊ KẾT QUẢ (CÓ ZOOM 3D + NÚT CHI TIẾT)
    // =========================================================================
    window.applyFilter = function() {
        if (!window.allGraphics) return;

        // 1. Lấy giá trị từ bộ lọc
        const blockVal = document.getElementById("selBlock").value;
        const floorVal = document.getElementById("selFloor").value;
        const statusVal = document.getElementById("selStatus").value;
        const typeVal = document.getElementById("selType").value;

        const resultList = document.getElementById("resultList");
        const resCount = document.getElementById("resCount");

        // 2. Logic Lọc trên 3D (Ẩn các phần thừa, chỉ hiện căn hộ khớp lệnh)
        logicLayer.removeAll(); 

        const filtered = window.allGraphics.filter(graphic => {
            const attr = graphic.attributes;
            if (!attr) return false;

            // Chỉ hiển thị Căn hộ (Ẩn Hành lang, Cầu...)
            if (attr.Type !== "Apartment") return false;

            if (blockVal !== "All" && attr.block !== blockVal) return false;
            if (floorVal !== "All" && attr.Floor !== floorVal) return false;
            
            // Lọc theo Trạng thái
            if (statusVal !== "All" && parseInt(statusVal) !== attr.rawStatus) return false;
            
            // Lọc theo Số phòng ngủ (Beds)
            if (typeVal !== "All" && attr.Beds !== parseInt(typeVal)) return false;

            return true;
        });

        // Vẽ lại 3D
        logicLayer.addMany(filtered);

        // 3. Hiển thị danh sách kết quả ra HTML
        if (resultList && resCount) {
             resCount.innerText = `Tìm thấy ${filtered.length} căn hộ`;
             resultList.innerHTML = "";
             
             if (filtered.length === 0) {
                 resultList.innerHTML = `<div class="col-12 text-center py-5"><h5>Không tìm thấy căn hộ phù hợp.</h5></div>`;
             } else {
                 filtered.forEach(g => {
                     const attr = g.attributes;
                     // Xử lý ảnh
                     const imgSrc = (attr.Img && attr.Img.startsWith(".")) ? attr.Img : "images/img_1.jpg"; 
                     
                     const col = document.createElement("div");
                     col.className = "col-md-4 mb-4"; 
                     
                     // HTML THẺ KẾT QUẢ (Có onClick để Zoom)
                     col.innerHTML = `
                        <div class="card h-100 shadow-sm border-0 property-card">
                            <div class="position-relative pointer-zoom" style="cursor:pointer">
                                <img src="${imgSrc}" class="card-img-top" style="height:200px; object-fit:cover;" alt="...">
                                <span class="badge position-absolute top-0 end-0 m-2 ${attr.rawStatus === 0 ? 'bg-success' : 'bg-secondary'}">
                                    ${attr.Status}
                                </span>
                            </div>
                            
                            <div class="card-body">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <h5 class="card-title text-primary fw-bold mb-0 pointer-zoom" style="cursor:pointer">
                                        ${attr.Code}
                                    </h5>
                                    <small class="text-muted"><i class="flaticon-building"></i> Tầng ${attr.Floor}</small>
                                </div>
                                
                                <p class="card-text small text-muted mb-2">
                                    <i class="flaticon-house"></i> ${attr.Area}m² &nbsp;|&nbsp; 
                                    <i class="icon-bed"></i> ${attr.Beds} PN <br>
                                    Hướng: ${attr.Direction}
                                </p>
                                
                                <h5 class="text-danger fw-bold mb-3">
                                    ${attr.Price}
                                </h5>

                                <div class="d-grid gap-2">
                                    <div class="btn-group">
                                        <button class="btn btn-outline-primary btn-sm btn-detail">
                                            <i class="icon-eye"></i> Chi tiết
                                        </button>
                                        <button class="btn btn-outline-secondary btn-sm btn-zoom">
                                            <i class="flaticon-3d-cube"></i> Vị trí
                                        </button>
                                    </div>
                                    <button class="btn btn-success btn-sm fw-bold btn-consult">
                                        📞 TƯ VẤN / THUÊ
                                    </button>
                                </div>
                            </div>
                        </div>
                     `;
                     
                     // GẮN SỰ KIỆN CLICK (Rất quan trọng)
                     
                     // 1. Nút Zoom & Click Ảnh
                     const zoomFn = () => {
                         document.getElementById("viewDiv").scrollIntoView({ behavior: 'smooth' });
                         view.goTo({ target: g.geometry, tilt: 75, zoom: 20 }, { duration: 1500 });
                         view.popup.open({ features: [g], location: g.geometry.centroid });
                     };
                     col.querySelectorAll(".pointer-zoom, .btn-zoom").forEach(el => el.onclick = zoomFn);

                     // 2. Nút Chi tiết (Mở Modal to)
                     col.querySelector(".btn-detail").onclick = function() {
                         window.showModalDetails(g);
                     };

                     // 3. Nút Tư vấn
                     col.querySelector(".btn-consult").onclick = function() {
                         if (attr.AptId) window.openConsultModal(attr.AptId, attr.Code);
                         else alert("Đang cập nhật dữ liệu.");
                     };

                     resultList.appendChild(col);
                 });
             }
        }
    };


    // C. HÀM HIỂN THỊ MODAL CHI TIẾT (KẾT NỐI VỚI INDEX.HTML)
    window.showModalDetails = function(graphic) {
        const a = graphic.attributes;
        
        document.getElementById("modalTitle").innerText = `Chi tiết Căn hộ ${a.Code}`;
        document.getElementById("modalPrice").innerText = a.Price;
        document.getElementById("modalCode").innerText = `Mã căn: ${a.Code} (Block ${a.block})`;
        document.getElementById("modalArea").innerText = a.Area;
        document.getElementById("modalBeds").innerText = a.Beds;
        document.getElementById("modalDirection").innerText = a.Direction;
        
        const statusEl = document.getElementById("modalStatus");
        statusEl.innerText = a.Status;
        statusEl.className = a.rawStatus === 0 ? "text-success font-weight-bold" : "text-danger font-weight-bold";
        
        // Ảnh
        const imgSrc = (a.Img && a.Img.startsWith(".")) ? a.Img : "images/img_1.jpg";
        document.getElementById("modalCarouselInner").innerHTML = `
            <div class="carousel-item active">
                <img src="${imgSrc}" class="d-block w-100" style="height:350px; object-fit:cover" alt="...">
            </div>
        `;

        // [QUAN TRỌNG] Gắn sự kiện cho nút "LIÊN HỆ THUÊ NGAY" trong Modal
        // Nút này có ID là 'btnContactFromModal' (như đã sửa ở index.html)
        const btnContact = document.getElementById("btnContactFromModal");
        if(btnContact) {
            btnContact.onclick = function() {
                // Kiểm tra xem ID căn hộ có tồn tại không
                if (a.AptId) {
                    // Gọi hàm mở form Tư vấn (được định nghĩa bên index.html)
                    window.openConsultModal(a.AptId, a.Code);
                } else {
                    alert("⚠️ Căn hộ này chưa có dữ liệu ID để tư vấn (Code: " + a.Code + ")");
                }
            };
        }

        // Nút Zoom 3D (nếu có)
        const btn3D = document.getElementById("btnZoom3DFromModal");
        if(btn3D) {
            btn3D.onclick = () => {
                view.goTo({ target: graphic.geometry, tilt: 75, zoom: 20 }, { duration: 1500 });
            };
        }

        const myModal = new bootstrap.Modal(document.getElementById('apartmentModal'));
        myModal.show();
    };

});