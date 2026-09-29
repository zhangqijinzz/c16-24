import { describe, expect, it } from 'vitest';
import { cropForRatio, moveCrop, normalizeDocument, resizeCrop, variantLabels } from '../domain';
import { DEFAULT_CROP, EMPTY_DOCUMENT, type FrameDocument } from '../model';

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

const baseVariant = { x: 0, y: 0, width: 0.5, height: 0.5, ratio: 'free' };

describe('variantLabels', () => {
  it('falls back to position numbers for unnamed variants', () => {
    const labels = variantLabels([{ ...baseVariant, id: 'a' }, { ...baseVariant, id: 'b' }]);
    expect(labels).toEqual(['方案 01', '方案 02']);
  });

  it('uses the trimmed custom name when present', () => {
    expect(variantLabels([{ ...baseVariant, id: 'a', name: '  封面  ' }])).toEqual(['封面']);
  });

  it('treats whitespace-only names as empty', () => {
    expect(variantLabels([{ ...baseVariant, id: 'a', name: '   ' }])).toEqual(['方案 01']);
  });

  it('disambiguates duplicate names by occurrence order', () => {
    const labels = variantLabels([
      { ...baseVariant, id: 'a', name: '封面' },
      { ...baseVariant, id: 'b' },
      { ...baseVariant, id: 'c', name: '封面' },
      { ...baseVariant, id: 'd', name: '封面' },
    ]);
    expect(labels).toEqual(['封面', '方案 02', '封面（2）', '封面（3）']);
  });
});

describe('normalizeDocument', () => {
  it('keeps legacy variants without names in their original order', () => {
    const legacy: FrameDocument = {
      ...structuredClone(EMPTY_DOCUMENT),
      variants: [
        { id: 'first', x: 0, y: 0, width: 0.5, height: 0.5, ratio: '1:1' },
        { id: 'second', x: 0.2, y: 0.1, width: 0.4, height: 0.4, ratio: 'free' },
      ],
    };
    const document = normalizeDocument(legacy);
    expect(document.variants.map((variant) => variant.id)).toEqual(['first', 'second']);
    expect(document.variants[0].name).toBeUndefined();
    expect(variantLabels(document.variants)).toEqual(['方案 01', '方案 02']);
  });

  it('drops only truly damaged entries and keeps the rest in order', () => {
    const legacy = {
      ...structuredClone(EMPTY_DOCUMENT),
      variants: [
        { id: 'ok', x: 0, y: 0, width: 0.5, height: 0.5, ratio: 'free' },
        null,
        { id: 'broken' },
        { id: 'ok2', x: 0.1, y: 0.1, width: 0.3, height: 0.3, ratio: '16:9' },
      ],
    } as unknown as FrameDocument;
    const document = normalizeDocument(legacy);
    expect(document.variants.map((variant) => variant.id)).toEqual(['ok', 'ok2']);
  });

  it('clamps out-of-range geometry and fills in missing ids', () => {
    const legacy = {
      ...structuredClone(EMPTY_DOCUMENT),
      variants: [{ x: 5, y: -1, width: 2, height: 0.5, ratio: 'free' }],
    } as unknown as FrameDocument;
    const [variant] = normalizeDocument(legacy).variants;
    expect(variant.id).toBe('variant-legacy-0');
    expect(variant.width).toBe(1);
    expect(variant.x).toBe(0);
    expect(variant.y).toBe(0);
  });
});
