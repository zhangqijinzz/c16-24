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

let variantSequence = 0;

/** 生成会话内唯一的方案 id，避免同毫秒保存/复制产生重复 id。 */
export function nextVariantId(): string {
  variantSequence += 1;
  return `variant-${Date.now()}-${variantSequence}`;
}

/** 方案编号：由所在数组位置实时推导，不随数据存储，保证各处一致。 */
export function variantNumber(index: number): string {
  return String(index + 1).padStart(2, '0');
}

/** 去除首尾空白后的名称；空串表示未命名。 */
export function variantNameOf(variant: CropVariant): string {
  return (variant.name ?? '').trim();
}

/**
 * 方案在界面上的主显示名：
 * - 名称留空 → 兜底为「方案 NN」（NN 为位置编号）
 * - 名称与其他方案重复 → 追加出现序号消歧，如「封面」「封面 2」
 */
export function variantDisplayName(variant: CropVariant, index: number, variants: readonly CropVariant[]): string {
  const number = variantNumber(index);
  const name = variantNameOf(variant);
  if (!name) return `方案 ${number}`;
  const duplicated = variants.filter((item) => variantNameOf(item) === name).length > 1;
  if (!duplicated) return name;
  const occurrence = variants.slice(0, index + 1).filter((item) => variantNameOf(item) === name).length;
  return occurrence === 1 ? name : `${name} ${occurrence}`;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isCropShape(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const crop = value as Record<string, unknown>;
  return isNumber(crop.x) && isNumber(crop.y) && isNumber(crop.width) && isNumber(crop.height) && typeof crop.ratio === 'string';
}

/** 校验单条方案的核心裁切字段；id / name / note 缺失时由迁移补全，不视为损坏。 */
function isVariantShape(value: unknown): boolean {
  return isCropShape(value);
}

export function isFrameDocument(value: unknown): value is FrameDocument {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FrameDocument>;
  if (candidate.version !== 1) return false;
  if (!candidate.guides || typeof candidate.guides !== 'object') return false;
  if (!isCropShape(candidate.crop)) return false;
  if (!Array.isArray(candidate.variants)) return false;
  return candidate.variants.every(isVariantShape);
}

/**
 * 迁移旧数据：补齐缺失的 id / name / note，保留原有顺序与全部裁切参数。
 * 旧版本方案没有 name 字段，打开后名称兜底显示、顺序不变。
 */
export function migrateDocument(document: FrameDocument): FrameDocument {
  return {
    ...document,
    variants: document.variants.map((variant, index) => ({
      ...variant,
      id: variant.id || `variant-legacy-${index}`,
      name: variant.name ?? '',
      note: variant.note ?? '',
    })),
  };
}
