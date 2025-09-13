# resize-image

[![Website](https://img.shields.io/badge/Try%20it-online-blue)](https://resizeimages.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Lightweight browser image resize utility with TypeScript types. Build targets ESM and CJS.

> Try it online: [resizeimages.org](https://resizeimages.org)

## Install

```bash
npm install @nirmalparmar/resize-image
```

## Usage

```ts
import {
  resizeToDimensions,
  resizePngToTarget,
  resizeJpegToTarget,
  resizeWebpToTarget,
  convertFormat,
} from '@nirmalparmar/resize-image';

const input = document.querySelector('input[type=file]')!;
input.onchange = async () => {
  const file = input.files?.[0];
  if (!file) return;

  // 1) Resize to exact box using 'fit' (maintain aspect)
  const resized = await resizeToDimensions(
    file,
    {
      width: 1024,
      height: 768,
      fitMode: 'fit',
      format: 'jpeg',
      quality: 90,
    },
    { width: 1920, height: 1080 }, // original dimensions if known (used with percentage mode)
  );

  // 2) Hit a target size for PNG (best-effort)
  const pngUnder200kb = await resizePngToTarget(file, { targetKB: 200 });

  // 3) Hit a target size for JPEG/WEBP (quality+scale search)
  const jpgUnder150kb = await resizeJpegToTarget(file, { targetKB: 150 });
  const webpUnder120kb = await resizeWebpToTarget(file, { targetKB: 120 });

  // 4) Convert format (e.g., to WebP)
  const converted = await convertFormat(file as File, { format: 'webp', quality: 85, preserveMetadata: false });

  // Display example
  const url = URL.createObjectURL(resized.blob);
  const img = new Image();
  img.src = url;
  document.body.appendChild(img);
};
```

## API

### resizeToDimensions(file, settings, originalDimensions)
Resize to target `width`/`height` using fit strategies.

```ts
type FitMode = 'stretch' | 'fit' | 'crop' | 'not-enlarge';

interface ResizeSettings {
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

type Result = { blob: Blob; dataUrl: string; size: number };
```

Notes:
- `fit`: letterbox inside the box, preserves aspect, fills background.
- `crop`: fill the box by cropping overflow.
- `not-enlarge`: never upscale; downscale proportionally if larger.
- `stretch`: draw exactly to `width`×`height` (optionally preserve aspect).

### resizePngToTarget(file, options)
Best-effort PNG resizer to approach a target byte size via scaling (and optional palette quantization when `window.UPNG` is available).

```ts
type ResizeOptions = {
  targetKB: number;
  bufferKB?: number;         // default 5
  maxIterations?: number;    // default 18
  minScale?: number;         // default 0.05
  useQuantization?: boolean; // default true if UPNG present
  paletteColors?: number;    // default 256
};

function resizePngToTarget(file: File | Blob, options: ResizeOptions): Promise<Blob>;
```

### resizeJpegToTarget(file, options)
### resizeWebpToTarget(file, options)
Binary search over quality and scale to fit under a target size.

```ts
type RasterOptions = {
  targetKB: number;
  bufferKB?: number;          // default 5
  minQuality?: number;        // default 0.3
  maxQuality?: number;        // default 0.95
  qualityIterations?: number; // default 12
  minScale?: number;          // default 0.05
  scaleIterations?: number;   // default 12
};

function resizeJpegToTarget(file: File | Blob, options: RasterOptions): Promise<Blob>;
function resizeWebpToTarget(file: File | Blob, options: RasterOptions): Promise<Blob>;
```

### convertFormat(file, settings)
Convert an image to a different format using the browser canvas encoders.

```ts
interface ConversionSettings {
  format: 'jpeg' | 'png' | 'webp' | 'avif' | 'gif' | 'bmp' | 'tiff';
  quality: number; // 1..100
  preserveMetadata: boolean; // canvas strips EXIF; flag included for API symmetry
  backgroundColor?: string;  // used for JPEG background fill
}

function convertFormat(file: File, settings: ConversionSettings): Promise<{
  blob: Blob;
  dataUrl: string;
  size: number;
}>;
```

## Contributing

1. Clone the repo
2. Install deps: `npm install`
3. Dev build: `npm run dev`
4. Run tests: `npm test`

## License

MIT © Contributors

## About

This library powers parts of the web app at [resizeimages.org](https://resizeimages.org), a fast, privacy-first image resizing and conversion tool. If you find this package useful, consider sharing the site.
