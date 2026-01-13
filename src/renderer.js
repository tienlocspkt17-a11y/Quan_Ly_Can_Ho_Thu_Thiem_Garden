// src/renderer.js

export function createGraphic(GraphicClass, data) {
    // data bao gồm: rings, height, symbolColor, attributes, popupTemplate

    return new GraphicClass({
        geometry: {
            type: "polygon",
            rings: data.rings,
            hasZ: true
        },
        symbol: {
            type: "polygon-3d",
            symbolLayers: [{
                type: "extrude",
                size: data.height, // Chiều cao khối
                material: { 
                    // [FIX LỖI MẤT MÀU]: Nhận màu trực tiếp từ main.js
                    color: data.symbolColor || [200, 200, 200] 
                },
                edges: {
                    type: "solid",
                    color: [50, 50, 50, 0.3],
                    size: 0.5
                }
            }]
        },
        attributes: data.attributes,
        
        // [FIX LỖI UNDEFINED]: Nhận template chứa ảnh từ main.js
        popupTemplate: data.popupTemplate
    });
}