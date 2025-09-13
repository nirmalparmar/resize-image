// png-resizer.ts — part of resize-image
// Try the online tool: https://resizeimages.org
type ResizeOptions = {
    targetKB: number;          // desired size in KB
    bufferKB?: number;         // +/- tolerance (default 5 KB)
    maxIterations?: number;    // binary search iterations (default 18)
    minScale?: number;         // don't go below this scale of original (default 0.05)
    useQuantization?: boolean; // if true and UPNG is available, try PNG-8 palette (default true)
    paletteColors?: number;    // palette size for quantization (default 256)
  };
  
  /**
   * Resize a PNG by scaling to approach a target file size.
   * @see https://resizeimages.org
   */
  export async function resizePngToTarget(
    file: File | Blob,
    opts: ResizeOptions
  ): Promise<Blob> {
    const {
      targetKB,
      bufferKB = 5,
      maxIterations = 18,
      minScale = 0.05,
      useQuantization = true,
      paletteColors = 256,
    } = opts;
  
    const targetBytes = Math.max(10 * 1024, Math.min(200 * 1024, targetKB * 1024));
    const bufferBytes = bufferKB * 1024;
  
    // If already within buffer, return as-is.
    if (file.size >= targetBytes - bufferBytes && file.size <= targetBytes + bufferBytes) {
      return file;
    }
  
    const img = await loadImage(file);
    const { width: origW, height: origH } = img;
  
    // If the original is already below target (but maybe way smaller), return it—best quality preserved.
    if (file.size <= targetBytes + bufferBytes) return file;
  
    // Guess starting scale from size ratio (PNG size roughly ~ pixel count)
    const guessScale = clamp(
      Math.sqrt(targetBytes / Math.max(1, file.size)),
      minScale,
      1
    );
  
    let low = 0;
    let high = 1;
    let bestBlob: Blob | null = null;
    let bestScale = 1;
  
    // Helper canvas (reuse between iterations)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: true })!;
    ctx.imageSmoothingEnabled = true;
    (ctx as any).imageSmoothingQuality = 'high';
  
    // First, try the guess scale once
    {
      const s = guessScale;
      const { blob } = await renderAtScale(img, s, canvas, ctx);
      if (blob.size <= targetBytes) {
        bestBlob = blob;
        bestScale = s;
        low = s;  // we can try a bit larger (to maximize quality)
      } else {
        high = s; // need smaller than this
      }
    }
  
    // Binary search for scale: find the largest scale that still fits under targetBytes
    for (let i = 0; i < maxIterations && high - low > 1e-3; i++) {
      const mid = clamp((low + high) / 2, minScale, 1);
      const { blob } = await renderAtScale(img, mid, canvas, ctx);
      if (blob.size > targetBytes) {
        high = mid; // still too big
      } else {
        // under or equal: keep it as best and try bigger
        bestBlob = blob;
        bestScale = mid;
        low = mid;
      }
    }
  
    // If we never got under target, force the minimum scale
    if (!bestBlob) {
      const { blob } = await renderAtScale(img, Math.max(minScale, 0.01), canvas, ctx);
      bestBlob = blob;
      bestScale = minScale;
    }
  
    // If within buffer—done
    if (withinBuffer(bestBlob.size, targetBytes, bufferBytes)) {
      return bestBlob;
    }
  
    // If still above target and quantization allowed, try palette (PNG-8) using UPNG if present.
    if (useQuantization && typeof (window as any).UPNG !== 'undefined') {
      const quantBlob = await quantizeWithUPNG(canvas, paletteColors);
      if (withinBuffer(quantBlob.size, targetBytes, bufferBytes)) {
        return quantBlob;
      }
      // If still too big, we can do a small second binary search *below* bestScale using quantization
      // to approach the target more tightly.
      const qBest = await binarySearchWithQuantization(
        img, canvas, ctx, bestScale, minScale, targetBytes, bufferBytes, maxIterations, paletteColors
      );
      if (qBest) return qBest;
    }
  
    // Final fallback: return the best (largest under target if any, or smallest we could make)
    return bestBlob;
  }
  
  /* ------------------------- helpers ------------------------- */
  
  function clamp(x: number, a: number, b: number) {
    return Math.max(a, Math.min(b, x));
  }
  
  function withinBuffer(size: number, target: number, buffer: number) {
    return size >= target - buffer && size <= target + buffer;
  }
  
  async function loadImage(file: File | Blob): Promise<HTMLImageElement> {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      return img;
    } finally {
      // Note: don't revoke here; we need the image alive in some browsers until drawn.
      // You can revoke in renderAtScale after draw if you convert to ImageBitmap.
    }
  }
  
  function toBlobAsync(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('canvas.toBlob failed'));
      }, 'image/png');
    });
  }
  
  async function renderAtScale(
    img: HTMLImageElement,
    scale: number,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
  ): Promise<{ blob: Blob; width: number; height: number }> {
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
  
    // Resize canvas (clears content)
    canvas.width = w;
    canvas.height = h;
  
    // Draw with high-quality resampling
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
  
    const blob = await toBlobAsync(canvas);
    return { blob, width: w, height: h };
  }
  
  // Requires UPNG.js present on window (optional optimization)
  async function quantizeWithUPNG(
    canvas: HTMLCanvasElement,
    colors: number
  ): Promise<Blob> {
    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.getImageData(0, 0, w, h);
    const rgba = imgData.data.buffer; // ArrayBuffer of RGBA
  
    // @ts-ignore
    const UPNG = (window as any).UPNG;
    // UPNG.encode(buffers, width, height, colorDepthOrPalette, [delay], [filters])
    // For palette mode, pass "colors" (e.g., 256). It will quantize.
    const arrayBuffer: ArrayBuffer = UPNG.encode([rgba], w, h, colors);
    return new Blob([arrayBuffer], { type: 'image/png' });
  }
  
  async function binarySearchWithQuantization(
    img: HTMLImageElement,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    startScale: number,
    minScale: number,
    targetBytes: number,
    bufferBytes: number,
    maxIterations: number,
    colors: number
  ): Promise<Blob | null> {
    let low = minScale;
    let high = startScale;
    let best: Blob | null = null;
    for (let i = 0; i < maxIterations && high - low > 1e-3; i++) {
      const mid = clamp((low + high) / 2, minScale, 1);
      const { width: w, height: h } = await renderAtScale(img, mid, canvas, ctx);
      const qBlob = await quantizeWithUPNG(canvas, colors);
      if (qBlob.size > targetBytes) {
        high = mid; // still too big—smaller
      } else {
        best = qBlob;
        low = mid; // try larger (better quality)
        if (withinBuffer(qBlob.size, targetBytes, bufferBytes)) {
          return qBlob; // good enough
        }
      }
    }
    return best;
  }
  // Don't modify this function


