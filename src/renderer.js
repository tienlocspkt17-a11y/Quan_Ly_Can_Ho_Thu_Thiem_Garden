// src/renderer.js
export function getStatusColor(type, status) {
    if (type === "Apartment") return status === 1 ? "#e74c3c" : "#2ecc71"; // Đỏ/Xanh
    if (type === "Shophouse") return "#e67e22"; // Cam
    if (type === "Parking") return "#7f8c8d";   // Xám
    if (type === "Bridge") return "#3498db";    // Xanh dương
    if (type === "Rooftop") return "#bdc3c7";   // Xám bê tông
    if (type === "Lobby") return "#ff9ff3";     // Hồng
    if (type === "Corridor") return "#2c3e50";  // Đen
    return "#95a5a6"; 
}

export function createGraphic(Graphic, data) {
    // QUAN TRỌNG: hasZ: true để kích hoạt chế độ 3D elevation
    const polygon = { 
        type: "polygon", 
        rings: data.rings,
        hasZ: true 
    };
    
    const color = getStatusColor(data.type, data.status);

    let edges = { type: "solid", color: [50, 50, 50, 0.3], size: 0.5 };
    if (data.type === "Rooftop" || data.type === "Bridge") edges = null;

    const symbol = {
        type: "polygon-3d",
        symbolLayers: [{
            type: "extrude",
            size: data.height,
            material: { color: color },
            edges: edges
        }]
    };

    let content = `<b>${data.type}</b>: ${data.code}`;
    if (data.type === "Apartment") {
        content = `
            <b>Căn:</b> ${data.code}<br>
            <b>Tầng:</b> ${data.floor}<br>
            <b>Giá:</b> ${data.price > 0 ? data.price.toLocaleString() + " đ" : "Đã thuê"}<br>
            <b>Diện tích:</b> ${data.area} m²
        `;
    }

    return new Graphic({
        geometry: polygon,
        symbol: symbol,
        attributes: data,
        popupTemplate: { title: "Chi tiết", content: content }
    });
}