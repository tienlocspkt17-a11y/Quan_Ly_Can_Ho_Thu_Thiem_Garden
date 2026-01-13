// src/math_utils.js
import { PROJECT_CONFIG } from './config.js';

export function getSmartCoords(origin, relativeX, relativeY) {
    const R = 6378137; // Bán kính trái đất
    
    // Xử lý đầu vào linh hoạt (Array hoặc Object)
    const lon = Array.isArray(origin) ? origin[0] : origin.longitude;
    const lat = Array.isArray(origin) ? origin[1] : origin.latitude;

    // Lấy góc xoay
    const rotation = PROJECT_CONFIG.rotation || 0;
    const rotRad = rotation * Math.PI / 180;

    // 1. Xoay trục tọa độ
    const dx = relativeX * Math.cos(rotRad) - relativeY * Math.sin(rotRad);
    const dy = relativeX * Math.sin(rotRad) + relativeY * Math.cos(rotRad);

    // 2. Chuyển đổi mét sang độ GPS
    const dLat = (dy / R) * (180 / Math.PI);
    const dLon = (dx / (R * Math.cos(Math.PI * lat / 180))) * (180 / Math.PI);

    // 3. Trả về mảng [longitude, latitude]
    return [lon + dLon, lat + dLat];
}