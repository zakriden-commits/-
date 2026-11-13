/** Minimal 2D canvas context stub — records nothing, accepts everything. */
export function createCanvas() {
  const noop = () => {};
  const gradient = { addColorStop: noop };
  return {
    canvas: { width: 128, height: 128 },
    save: noop, restore: noop, beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    bezierCurveTo: noop, quadraticCurveTo: noop, arc: noop, ellipse: noop, rect: noop,
    roundRect: noop, clip: noop, fill: noop, stroke: noop, fillRect: noop, strokeRect: noop,
    clearRect: noop, fillText: noop, strokeText: noop, translate: noop, rotate: noop, scale: noop,
    setTransform: noop, drawImage: noop, createRadialGradient: () => gradient,
    createLinearGradient: () => gradient, createPattern: () => null,
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: noop, measureText: () => ({ width: 10 }), setLineDash: noop,
    globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '10px sans-serif',
    textAlign: 'left', textBaseline: 'alphabetic', shadowBlur: 0, shadowColor: '#000',
  };
}
