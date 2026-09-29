import { describe, expect, it } from 'vitest';
import { cropForRatio, migrateDocument, moveCrop, resizeCrop, variantDisplayName, variantNumber } from '../domain';
import { DEFAULT_CROP, type CropVariant, type FrameDocument } from '../model';

const makeVariant = (overrides: Partial<CropVariant> = {}): CropVariant => ({
  id: 'v1',
  x: 0,
  y: 0,
  width: 0.5,
  height: 0.5,
  ratio: 'free',
  ...overrides,
});

describe('crop domain rules', () => {
  it('fits a 1:1 crop inside a wide image and centers it', () => {
    const crop = cropForRatio('1:1', 1.5, DEFAULT_CROP);
    expect(crop.width).toBeCloseTo(2 / 3);
    expect(crop.height).toBe(1);
    expect(crop.x).toBeCloseTo(1 / 6);
  });

  it('clamps movement to the image boundary', () => {
    const crop = moveCrop({ ...DEFAULT_CROP, width: 0.5, height: 0.5 }, 0.9, -0.9);
    expect(crop.x).toBe(0.5);
    expect(crop.y).toBe(0);
  });

  it('keeps a selected ratio while resizing', () => {
    const crop = resizeCrop({ ...DEFAULT_CROP, ratio: '16:9', width: 0.5, height: 0.28125 }, 0.8, 0.8);
    expect(crop.width).toBe(0.8);
    expect(crop.height).toBeCloseTo(0.45);
  });
});

describe('variant numbering and display name', () => {
  it('numbers variants by position, zero-padded', () => {
    expect(variantNumber(0)).toBe('01');
    expect(variantNumber(9)).toBe('10');
  });

  it('falls back to positional name when the name is empty', () => {
    const variants = [makeVariant({ id: 'a', name: '' }), makeVariant({ id: 'b' })];
    expect(variantDisplayName(variants[0], 0, variants)).toBe('方案 01');
    expect(variantDisplayName(variants[1], 1, variants)).toBe('方案 02');
  });

  it('uses the custom name when provided', () => {
    const variants = [makeVariant({ id: 'a', name: '封面' })];
    expect(variantDisplayName(variants[0], 0, variants)).toBe('封面');
  });

  it('disambiguates duplicate names with an occurrence suffix', () => {
    const variants = [
      makeVariant({ id: 'a', name: '封面' }),
      makeVariant({ id: 'b', name: '备选' }),
      makeVariant({ id: 'c', name: '封面' }),
    ];
    expect(variantDisplayName(variants[0], 0, variants)).toBe('封面');
    expect(variantDisplayName(variants[1], 1, variants)).toBe('备选');
    expect(variantDisplayName(variants[2], 2, variants)).toBe('封面 2');
  });

  it('treats whitespace-only names as empty', () => {
    const variants = [makeVariant({ id: 'a', name: '   ' })];
    expect(variantDisplayName(variants[0], 0, variants)).toBe('方案 01');
  });
});

describe('migrateDocument', () => {
  it('fills missing id/name/note for legacy variants while keeping order and crop', () => {
    const legacy: FrameDocument = {
      version: 1,
      image: null,
      guides: { thirds: true, center: false, diagonal: false, golden: false },
      subject: null,
      crop: { ...DEFAULT_CROP },
      variants: [
        { id: 'a', x: 0.1, y: 0.2, width: 0.5, height: 0.5, ratio: 'free' },
        { id: 'b', x: 0.2, y: 0.3, width: 0.4, height: 0.4, ratio: '1:1' },
      ],
    };
    const migrated = migrateDocument(legacy);
    expect(migrated.variants).toHaveLength(2);
    expect(migrated.variants[0].name).toBe('');
    expect(migrated.variants[0].note).toBe('');
    expect(migrated.variants[1].x).toBe(0.2);
    expect(migrated.variants[1].ratio).toBe('1:1');
  });

  it('keeps an existing name intact', () => {
    const legacy: FrameDocument = {
      version: 1,
      image: null,
      guides: { thirds: true, center: false, diagonal: false, golden: false },
      subject: null,
      crop: { ...DEFAULT_CROP },
      variants: [{ id: 'a', x: 0.1, y: 0.2, width: 0.5, height: 0.5, ratio: 'free', name: '封面', note: '暖调' }],
    };
    const migrated = migrateDocument(legacy);
    expect(migrated.variants[0].name).toBe('封面');
    expect(migrated.variants[0].note).toBe('暖调');
  });
});
