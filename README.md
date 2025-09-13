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
import { resizeToDimensions, resizePngToTarget, convertFormat } from '@nirmalparmar/resize-image';

const fileInput = document.querySelector('input[type=file]')!;
fileInput.onchange = async () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  const out = await resizeToDimensions(file, {
    maxWidth: 1024,
    maxHeight: 1024,
    mimeType: 'image/jpeg',
    quality: 0.9,
    downscaleOnly: true,
  });

  // Do something with out.blob
  const url = URL.createObjectURL(out.blob);
  const img = new Image();
  img.src = url;
  document.body.appendChild(img);
};
```

## API

```ts
type ResizeOptions = {
  width?: number;
  height?: number;
  maxWidth?: number;
  maxHeight?: number;
  mimeType?: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/avif' | 'image/gif';
  quality?: number; // 0..1
  background?: string;
  downscaleOnly?: boolean;
};

type ResizeOutput = {
  blob: Blob;
  width: number;
  height: number;
};
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
