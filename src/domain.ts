import type { CropVariant, FrameDocument, Ratio } from './model';

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

export function normalizeCrop(crop: CropVariant): CropVariant {
  const width = clamp(crop.width, 0.12, 1);
  const height = clamp(crop.height, 0.12, 1);
  return {
    ...crop,
    x: clamp(crop.x, 0, 1 - width),
    y: clamp(crop.y, 0, 1 - height),
    width,
    height,
  };
}

export function cropForRatio(ratio: Ratio, imageRatio: number, current: CropVariant): CropVariant {
  if (ratio === 'free') return { ...current, ratio };
  const [w, h] = ratio.split(':').map(Number);
  const target = w / h;
  let width = 1;
  let height = 1;
  if (target > imageRatio) height = Math.min(1, imageRatio / target);
  else width = Math.min(1, target / imageRatio);
  return normalizeCrop({
    ...current,
    ratio,
    width,
    height,
    x: (1 - width) / 2,
    y: (1 - height) / 2,
  });
}

export function moveCrop(crop: CropVariant, dx: number, dy: number): CropVariant {
  return normalizeCrop({ ...crop, x: crop.x + dx, y: crop.y + dy });
}

export function resizeCrop(crop: CropVariant, width: number, height: number): CropVariant {
  const nextWidth = width;
  let nextHeight = height;
  if (crop.ratio !== 'free') {
    const [w, h] = crop.ratio.split(':').map(Number);
    nextHeight = nextWidth / (w / h);
  }
  return normalizeCrop({ ...crop, width: nextWidth, height: nextHeight });
}

export function makeVariant(crop: CropVariant, id: string): CropVariant {
  return { ...normalizeCrop(crop), id };
}

export function variantLabels(variants: CropVariant[]): string[] {
  const seen = new Map<string, number>();
  return variants.map((variant, index) => {
    const name = variant.name?.trim() ?? '';
    if (name === '') return `方案 ${String(index + 1).padStart(2, '0')}`;
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    return count === 1 ? name : `${name}（${count}）`;
  });
}

export function normalizeVariant(value: unknown, index: number): CropVariant | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<CropVariant>;
  const numbers = [candidate.x, candidate.y, candidate.width, candidate.height];
  if (!numbers.every((item) => typeof item === 'number' && Number.isFinite(item))) return null;
  const [x, y, width, height] = numbers as [number, number, number, number];
  const id = typeof candidate.id === 'string' && candidate.id !== '' ? candidate.id : `variant-legacy-${index}`;
  return normalizeCrop({
    id,
    x,
    y,
    width,
    height,
    ratio: typeof candidate.ratio === 'string' ? candidate.ratio : 'free',
    ...(typeof candidate.name === 'string' ? { name: candidate.name } : {}),
    ...(typeof candidate.note === 'string' ? { note: candidate.note } : {}),
  });
}

export function normalizeDocument(document: FrameDocument): FrameDocument {
  const variants = document.variants
    .map((variant, index) => normalizeVariant(variant, index))
    .filter((variant): variant is CropVariant => variant !== null);
  return { ...document, variants };
}

export function isFrameDocument(value: unknown): value is FrameDocument {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FrameDocument>;
  return candidate.version === 1 && typeof candidate.guides === 'object' && candidate.crop !== undefined && Array.isArray(candidate.variants);
}
