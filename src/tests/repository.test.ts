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

  it('loads legacy variants without name/note, keeping their order and crop', () => {
    const storage = new MemoryStorage();
    const legacy = {
      version: 1,
      image: null,
      guides: { thirds: true, center: false, diagonal: false, golden: false },
      subject: null,
      crop: { id: 'current', x: 0, y: 0, width: 1, height: 1, ratio: 'free' },
      variants: [
        { id: 'a', x: 0.1, y: 0.2, width: 0.5, height: 0.5, ratio: 'free' },
        { id: 'b', x: 0.2, y: 0.3, width: 0.4, height: 0.4, ratio: '1:1' },
      ],
    };
    storage.value = JSON.stringify(legacy);
    const document = new LocalFrameRepository(storage).load();
    expect(document.variants).toHaveLength(2);
    expect(document.variants.map((item) => item.id)).toEqual(['a', 'b']);
    expect(document.variants[0].name).toBe('');
    expect(document.variants[1].x).toBe(0.2);
  });

  it('treats variants missing crop fields as damaged data', () => {
    const storage = new MemoryStorage();
    storage.value = JSON.stringify({
      version: 1,
      image: null,
      guides: { thirds: true, center: false, diagonal: false, golden: false },
      subject: null,
      crop: { id: 'current', x: 0, y: 0, width: 1, height: 1, ratio: 'free' },
      variants: [{ id: 'a', name: '封面' }],
    });
    const document = new LocalFrameRepository(storage).load();
    expect(document.variants).toEqual([]);
  });
});
