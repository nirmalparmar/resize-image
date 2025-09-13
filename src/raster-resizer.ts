// raster-resizer.ts — part of resize-image
// Docs & online tool: https://resizeimages.org
type RasterOptions = {
    targetKB: number;          // desired size in KB
    bufferKB?: number;         // +/- tolerance (default 5 KB)
    minQuality?: number;       // 0..1 (default 0.3)
    maxQuality?: number;       // 0..1 (default 0.95)
    qualityIterations?: number;// binary search steps for quality (default 12)
    minScale?: number;         // minimal relative scale vs original (default 0.05)
    scaleIterations?: number;  // binary search steps for scale (default 12)
  };
  
  /**
   * Resize JPEG by searching quality/scale to hit target size.
   * @see https://resizeimages.org
   */
  export async function resizeJpegToTarget(
    file: File | Blob,
    opts: RasterOptions
  ): Promise<Blob> {
    return resizeRasterToTarget(file, "image/jpeg", opts);
  }
  
  /**
   * Resize WebP by searching quality/scale to hit target size.
   * @see https://resizeimages.org
   */
  export async function resizeWebpToTarget(
    file: File | Blob,
    opts: RasterOptions
  ): Promise<Blob> {
    return resizeRasterToTarget(file, "image/webp", opts);
  }
  
  /* ---------------- core implementation ---------------- */
  
  async function resizeRasterToTarget(
    file: File | Blob,
    mime: "image/jpeg" | "image/webp",
    opts: RasterOptions
  ): Promise<Blob> {
    const {
      targetKB,
      bufferKB = 5,
      minQuality = 0.3,
      maxQuality = 0.95,
      qualityIterations = 12,
      minScale = 0.05,
      scaleIterations = 12,
    } = opts;
  
    const targetBytes = Math.max(1, targetKB * 1024);
    const bufferBytes = bufferKB * 1024;
  
    // Quick pass: already inside buffer?
    if (withinBuffer(file.size, targetBytes, bufferBytes)) return file;
  
    // Decode once
    const img = await loadImage(file);
  
    // Phase A: Try to fit by quality only at full resolution (fast path)
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: true })!;
    setupctx(ctx);
  
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
  
    // If browser can't encode requested mime, fall back to JPEG
    const supported = await testMimeSupport(canvas, mime);
    const effMime = supported ? mime : "image/jpeg";
  
    // Try quality-only search at full size
    const qOnly = await fitByQuality(canvas, effMime, targetBytes, bufferBytes, {
      minQ: minQuality,
      maxQ: maxQuality,
      iterations: qualityIterations,
    });
    if (qOnly && withinBuffer(qOnly.size, targetBytes, bufferBytes)) return qOnly;
  
    // Phase B: If still too big, binary search on scale (outer),
    // with an inner search on quality to maximize quality per scale.
    // Goal: find largest scale whose best-quality-under-target fits.
    let low = minScale;
    let high = 1.0;
    let bestBlob: Blob | null = null;
    let bestScale = low;
  
    // Helper to render at a given scale and fit quality
    const tryScale = async (scale: number) => {
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.width = w;
      canvas.height = h;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      return fitByQuality(canvas, effMime, targetBytes, bufferBytes, {
        minQ: minQuality,
        maxQ: maxQuality,
        iterations: qualityIterations,
      });
    };
  
    // If quality-only on full size didn't fit, set high accordingly
    if (!qOnly || qOnly.size > targetBytes + bufferBytes) {
      // shrink until something fits
      const mid0 = Math.max(minScale, Math.sqrt(targetBytes / Math.max(1, file.size)));
      const first = await tryScale(mid0);
      if (first && first.size <= targetBytes + bufferBytes) {
        bestBlob = first;
        bestScale = mid0;
        low = mid0;
      } else {
        high = mid0;
      }
    } else {
      // It fit at full size but maybe outside buffer — still acceptable,
      // but we try to land inside buffer; return immediately to avoid quality loss.
      return qOnly;
    }
  
    for (let i = 0; i < scaleIterations && high - low > 1e-3; i++) {
      const mid = clamp((low + high) / 2, minScale, 1.0);
      const b = await tryScale(mid);
      if (!b) {
        // Could not fit even at minQuality => need smaller
        high = mid;
        continue;
      }
      if (b.size > targetBytes + bufferBytes) {
        // still too big
        high = mid;
      } else {
        // fits under target, keep and try bigger (better quality via more pixels)
        bestBlob = b;
        bestScale = mid;
        if (withinBuffer(b.size, targetBytes, bufferBytes)) return b;
        low = mid;
      }
    }
  
    // Fallback: return best we got (largest that fits under target)
    if (bestBlob) return bestBlob;
  
    // If nothing fit (very tight target), return the smallest possible (minScale at minQuality)
    const w = Math.max(1, Math.round(img.naturalWidth * minScale));
    const h = Math.max(1, Math.round(img.naturalHeight * minScale));
    canvas.width = w; canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const tiny = await toBlobAsync(canvas, effMime, minQuality);
    return tiny ?? file; // last resort
  }
  
  /* ---------------- helpers ---------------- */
  
  function setupctx(ctx: CanvasRenderingContext2D) {
    ctx.imageSmoothingEnabled = true;
    (ctx as any).imageSmoothingQuality = "high";
  }
  
  function clamp(x: number, a: number, b: number) {
    return Math.max(a, Math.min(b, x));
  }
  
  function withinBuffer(size: number, target: number, buffer: number) {
    return size >= target - buffer && size <= target + buffer;
  }
  
  async function loadImage(file: File | Blob): Promise<HTMLImageElement> {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    // URL.revokeObjectURL(url); // optional (some browsers need it later)
    return img;
  }
  
  function toBlobAsync(
    canvas: HTMLCanvasElement,
    mime: string,
    quality?: number
  ): Promise<Blob | null> {
    return new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), mime, quality)
    );
  }
  
  async function testMimeSupport(
    canvas: HTMLCanvasElement,
    mime: string
  ): Promise<boolean> {
    const b = await toBlobAsync(canvas, mime, 0.9);
    return !!b && b.type === mime;
  }
  
  type QualitySearchOpts = { minQ: number; maxQ: number; iterations: number };
  
  async function fitByQuality(
    canvas: HTMLCanvasElement,
    mime: string,
    targetBytes: number,
    bufferBytes: number,
    { minQ, maxQ, iterations }: QualitySearchOpts
  ): Promise<Blob | null> {
    // Try max quality first (best)
    let best: Blob | null = null;
  
    let lo = minQ;
    let hi = maxQ;
  
    // If even min quality is too big, early signal
    const minTry = await toBlobAsync(canvas, mime, lo);
    if (!minTry) return null;
    if (minTry.size > targetBytes + bufferBytes) {
      return null; // cannot fit by quality alone at this scale
    }
    // If min fits, keep as candidate
    best = minTry;
    if (withinBuffer(minTry.size, targetBytes, bufferBytes)) return minTry;
  
    // If max fits, it's strictly better; try to go higher
    const maxTry = await toBlobAsync(canvas, mime, hi);
    if (maxTry && maxTry.size <= targetBytes + bufferBytes) {
      best = maxTry;
      if (withinBuffer(maxTry.size, targetBytes, bufferBytes)) return maxTry;
      lo = (hi + lo) / 2; // search upper half
    }
  
    // Binary search to get as close under target as possible
    for (let i = 0; i < iterations && hi - lo > 1e-3; i++) {
      const mid = clamp((lo + hi) / 2, minQ, maxQ);
      const b = await toBlobAsync(canvas, mime, mid);
      if (!b) break;
  
      if (b.size > targetBytes + bufferBytes) {
        // too big, reduce quality
        hi = mid;
      } else {
        // under or within buffer, keep and try higher quality
        best = b;
        if (withinBuffer(b.size, targetBytes, bufferBytes)) return b;
        lo = mid;
      }
    }
    return best;
  }
  

