import { describe, expect, it } from 'vitest';
import { LocalFrameRepository } from '../repository';
import { EMPTY_DOCUMENT } from '../model';
import type { StorageService } from '../service';

class MemoryStorage implements StorageService {
  value: string | null = null;
  read() { return this.value; }
  write(value: string) { this.value = value; }
}

describe('LocalFrameRepository', () => {
  it('saves and reloads the versioned document', () => {
    const storage = new MemoryStorage();
    const repository = new LocalFrameRepository(storage);
    const document = { ...structuredClone(EMPTY_DOCUMENT), subject: { x: 0.4, y: 0.6 } };
    repository.save(document);
    expect(repository.load().subject).toEqual({ x: 0.4, y: 0.6 });
  });

  it('falls back to a usable empty document for damaged data', () => {
    const storage = new MemoryStorage();
    storage.value = '{ damaged';
    const document = new LocalFrameRepository(storage).load();
    expect(document.version).toBe(1);
    expect(document.image).toBeNull();
    expect(document.variants).toEqual([]);
  });

  it('loads legacy documents whose variants have no names, preserving order', () => {
    const storage = new MemoryStorage();
    storage.value = JSON.stringify({
      ...structuredClone(EMPTY_DOCUMENT),
      variants: [
        { id: 'first', x: 0, y: 0, width: 0.5, height: 0.5, ratio: '1:1' },
        { id: 'second', x: 0.1, y: 0.2, width: 0.4, height: 0.4, ratio: 'free' },
      ],
    });
    const document = new LocalFrameRepository(storage).load();
    expect(document.variants.map((variant) => variant.id)).toEqual(['first', 'second']);
    expect(document.variants[0].name).toBeUndefined();
    expect(document.variants[1].ratio).toBe('free');
  });
});
