// convert-format.ts — part of resize-image
// Try the online tool: https://resizeimages.org

export interface ConversionSettings {
  format: 'jpeg' | 'png' | 'webp' | 'avif' | 'gif' | 'bmp' | 'tiff';
  quality: number; // 1..100
  preserveMetadata: boolean; // currently unused (canvas strips EXIF)
  backgroundColor?: string;
}

function getCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('2D canvas not supported');
  return { canvas, ctx };
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
    // defer revoke to caller if needed
  }
}

/**
 * Convert an image to another format using canvas encoders.
 * @see https://resizeimages.org
 */
export async function convertFormat(
  file: File,
  settings: ConversionSettings,
): Promise<{ blob: Blob; dataUrl: string; size: number }> {
  return new Promise(async (resolve, reject) => {
    try {
      const img = await loadImage(file);

      try {
        const { canvas, ctx } = getCanvas();
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        if (settings.format === 'jpeg' && settings.backgroundColor) {
          ctx.fillStyle = settings.backgroundColor;
          ctx.fillRect(0, 0, img.naturalWidth, img.naturalHeight);
        } else {
          ctx.clearRect(0, 0, img.naturalWidth, img.naturalHeight);
        }

        ctx.drawImage(img, 0, 0);

        const mime = `image/${settings.format}`;
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob'));
              return;
            }

            const dataUrl = canvas.toDataURL(
              mime,
              settings.format !== 'png' ? settings.quality / 100 : undefined,
            );

            resolve({
              blob,
              dataUrl,
              size: blob.size,
            });
          },
          mime,
          settings.format !== 'png' ? settings.quality / 100 : undefined,
        );
      } catch (error) {
        reject(error);
      }
    } catch (error) {
      reject(error);
    }
  });
}


