// resize-image — Tools for browser image resizing and format conversion
// Docs & online tool: https://resizeimages.org
export { resizePngToTarget } from './png-resizer';
export { resizeJpegToTarget, resizeWebpToTarget } from './raster-resizer';
export { convertFormat } from './convert-format';
export type { ConversionSettings } from './convert-format';
export { resizeToDimensions } from './resize-to-dimensions';
export type { ResizeSettings, FitMode } from './resize-to-dimensions';

if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
  if (typeof console !== 'undefined' && typeof window !== 'undefined') {
    try {
      console.info('[resize-image] Try the online tool at https://resizeimages.org');
    } catch {}
  }
}


