// resize-to-dimensions.ts — part of resize-image
// Docs & online tool: https://resizeimages.org

export type FitMode = 'stretch' | 'fit' | 'crop' | 'not-enlarge';

export interface ResizeSettings {
  width: number;
  height: number;
  resizeMode?: 'percentage' | 'preset';
  percentage?: number; // used when resizeMode === 'percentage'
  fitMode?: FitMode; // default 'stretch'
  maintainAspectRatio?: boolean;
  format: 'jpeg' | 'png' | 'webp' | 'avif' | 'gif' | 'bmp' | 'tiff';
  quality: number; // 1..100
  backgroundColor?: string;
}

function getCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('2D canvas not supported');
  return { canvas, ctx };
}

export async function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  // caller may revoke later if desired
  return img;
}

export async function hasTransparency(img: HTMLImageElement): Promise<boolean> {
  try {
    const { canvas, ctx } = getCanvas();
    canvas.width = Math.min(img.naturalWidth, 100);
    canvas.height = Math.min(img.naturalHeight, 100);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function isFormatSupported(format: string): boolean {
  try {
    const { canvas } = getCanvas();
    return canvas.toDataURL(`image/${format}`).startsWith(`data:image/${format}`);
  } catch {
    return false;
  }
}

export function getOptimalFormat(
  originalFormat: string,
  isDownscaling: boolean,
  transparent: boolean,
): 'jpeg' | 'png' | 'webp' | 'avif' {
  if (isDownscaling) {
    if (transparent) return 'png';
    return 'webp';
  }
  if (transparent) return 'png';
  return originalFormat === 'png' ? 'jpeg' : 'webp';
}

/**
 * Resize to specific dimensions with fit/crop strategies.
 * @see https://resizeimages.org
 */
export async function resizeToDimensions(
  file: File,
  settings: ResizeSettings,
  originalDimensions: { width: number; height: number },
): Promise<{ blob: Blob; dataUrl: string; size: number }> {
  return new Promise(async (resolve, reject) => {
    try {
      const img = await loadImage(file);

      try {
        const { canvas, ctx } = getCanvas();
        let targetWidth = settings.width;
        let targetHeight = settings.height;

        // Determine target dimensions based on resizeMode
        if (settings.resizeMode === 'percentage' && settings.percentage) {
          targetWidth = Math.round(originalDimensions.width * (settings.percentage / 100));
          targetHeight = Math.round(originalDimensions.height * (settings.percentage / 100));
        } else if (settings.resizeMode === 'preset') {
          targetWidth = settings.width;
          targetHeight = settings.height;
        }

        // Determine downscaling and transparency
        const isDownscaling = targetWidth < img.naturalWidth && targetHeight < img.naturalHeight;
        const transparent = await hasTransparency(img);

        // Choose best format; fall back if unsupported
        const optimal = getOptimalFormat(settings.format, isDownscaling, transparent);
        const finalFormat = isFormatSupported(optimal) ? optimal : settings.format;

        const fitMode: FitMode = settings.fitMode || 'stretch';

        if (fitMode === 'fit') {
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          ctx.clearRect(0, 0, targetWidth, targetHeight);
          ctx.imageSmoothingEnabled = true;
          (ctx as any).imageSmoothingQuality = isDownscaling ? 'medium' : 'high';

          const bg = settings.backgroundColor || '#ffffff';
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, targetWidth, targetHeight);

          const scale = Math.min(targetWidth / img.naturalWidth, targetHeight / img.naturalHeight);
          const drawW = Math.round(img.naturalWidth * scale);
          const drawH = Math.round(img.naturalHeight * scale);
          const dx = Math.round((targetWidth - drawW) / 2);
          const dy = Math.round((targetHeight - drawH) / 2);
          ctx.drawImage(img, dx, dy, drawW, drawH);
        } else if (fitMode === 'not-enlarge') {
          ctx.imageSmoothingEnabled = true;
          (ctx as any).imageSmoothingQuality = isDownscaling ? 'medium' : 'high';

          const scaleFit = Math.min(targetWidth / img.naturalWidth, targetHeight / img.naturalHeight);
          if (scaleFit >= 1) {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          } else {
            const drawW = Math.round(img.naturalWidth * scaleFit);
            const drawH = Math.round(img.naturalHeight * scaleFit);
            canvas.width = drawW;
            canvas.height = drawH;
            ctx.clearRect(0, 0, drawW, drawH);
            ctx.drawImage(img, 0, 0, drawW, drawH);
          }
        } else if (fitMode === 'crop') {
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          ctx.clearRect(0, 0, targetWidth, targetHeight);
          ctx.imageSmoothingEnabled = true;
          (ctx as any).imageSmoothingQuality = isDownscaling ? 'medium' : 'high';

          const scale = Math.max(targetWidth / img.naturalWidth, targetHeight / img.naturalHeight);
          const drawW = Math.round(img.naturalWidth * scale);
          const drawH = Math.round(img.naturalHeight * scale);
          const dx = Math.round((targetWidth - drawW) / 2);
          const dy = Math.round((targetHeight - drawH) / 2);
          ctx.drawImage(img, dx, dy, drawW, drawH);
        } else {
          // stretch (default)
          if (settings.maintainAspectRatio) {
            const aspectRatio = originalDimensions.width / originalDimensions.height;
            if (targetWidth / targetHeight > aspectRatio) {
              targetWidth = Math.round(targetHeight * aspectRatio);
            } else {
              targetHeight = Math.round(targetWidth / aspectRatio);
            }
          }
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          ctx.clearRect(0, 0, targetWidth, targetHeight);
          ctx.imageSmoothingEnabled = true;
          (ctx as any).imageSmoothingQuality = isDownscaling ? 'medium' : 'high';
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        }

        // Determine quality param
        let quality: number | undefined = settings.quality / 100;
        if (finalFormat === 'png') {
          quality = undefined;
        } else if (isDownscaling && (finalFormat === 'webp' || finalFormat === 'avif')) {
          quality = Math.max(0.7, settings.quality / 100);
        }

        const mime = `image/${finalFormat}`;
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob'));
              return;
            }

            const dataUrl = canvas.toDataURL(mime, quality);
            resolve({ blob, dataUrl, size: blob.size });
          },
          mime,
          quality,
        );
      } catch (error) {
        reject(error);
      }
    } catch (error) {
      reject(error);
    }
  });
}


