export type ImageMimeType =
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'image/avif'
  | 'image/gif';

export interface ResizeOptions {
  width?: number;
  height?: number;
  maxWidth?: number;
  maxHeight?: number;
  mimeType?: ImageMimeType;
  quality?: number; // 0..1 for lossy formats
  background?: string; // fill color when letterboxing
  downscaleOnly?: boolean; // don't upscale beyond source
}

export interface ResizeOutput {
  blob: Blob;
  width: number;
  height: number;
}

