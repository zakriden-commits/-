import { createCanvas } from '@napi-rs/canvas';

/**
 * Point document.createElement('canvas') at a real raster canvas so the
 * procedural textures produce actual pixels we can sample.
 */
export function installNapiCanvas() {
  const orig = global.document.createElement.bind(global.document);
  global.document.createElement = (tag) => {
    if (String(tag).toLowerCase() === 'canvas') {
      const c = createCanvas(1, 1);
      // THREE reads width/height; napi canvas needs a fixed size up front
      return new Proxy(c, {
        get(target, prop) {
          if (prop === 'width') return target.width;
          if (prop === 'height') return target.height;
          const v = target[prop];
          return typeof v === 'function' ? v.bind(target) : v;
        },
        set(target, prop, value) {
          if (prop === 'width' || prop === 'height') { target[prop] = value; return true; }
          target[prop] = value;
          return true;
        },
      });
    }
    return orig(tag);
  };
}
