// src/math_utils.js
import { PROJECT_CONFIG } from './config.js';

const R_EARTH = 6378137;
// Tính tỷ lệ mét/độ chuẩn tại tọa độ dự án
const METERS_PER_DEG_LAT = 111319.49;
const METERS_PER_DEG_LON = (Math.PI / 180) * R_EARTH * Math.cos(PROJECT_CONFIG.center[1] * Math.PI / 180);

export function getSmartCoords(anchor, dx, dy) {
    // 1. Xoay tọa độ mét
    const rad = -PROJECT_CONFIG.rotation * (Math.PI / 180);
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);

    // 2. Quy đổi sang GPS
    return [
        anchor[0] + (rx / METERS_PER_DEG_LON),
        anchor[1] + (ry / METERS_PER_DEG_LAT)
    ];
}