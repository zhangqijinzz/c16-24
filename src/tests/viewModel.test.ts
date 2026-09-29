import { beforeEach, describe, expect, it } from 'vitest';
import { FrameSenseViewModel } from '../viewModel';
import { EMPTY_DOCUMENT, type FrameDocument, type ImageAsset } from '../model';
import type { FrameRepository } from '../repository';
import type { ImageService } from '../service';

class MemoryRepository implements FrameRepository {
  document: FrameDocument = structuredClone(EMPTY_DOCUMENT);
  fail = false;
  load() { return structuredClone(this.document); }
  save(document: FrameDocument) { if (this.fail) throw new Error('no storage'); this.document = structuredClone(document); }
}

class FakeImageService implements ImageService {
  asset: ImageAsset = { src: 'data:image/svg+xml,test', width: 1200, height: 800, name: 'test.svg' };
  readFile() { return Promise.resolve(this.asset); }
  demo() { return this.asset; }
}

describe('FrameSenseViewModel', () => {
  let repository: MemoryRepository;
  let vm: FrameSenseViewModel;
  beforeEach(() => { repository = new MemoryRepository(); vm = new FrameSenseViewModel(repository, new FakeImageService()); });

  it('initializes empty and loads a demo image', async () => {
    await vm.initialize();
    expect(vm.getSnapshot().phase).toBe('ready');
    vm.loadDemo();
    expect(vm.getSnapshot().document.image?.name).toBe('test.svg');
    expect(repository.document.image).not.toBeNull();
  });

  it('updates guides, subject, ratio, and variants', () => {
    vm.loadDemo();
    vm.toggleGuide('center');
    vm.markSubject(0.2, 0.8);
    vm.setRatio('1:1');
    vm.saveVariant();
    expect(vm.getSnapshot().document.guides.center).toBe(true);
    expect(vm.getSnapshot().document.subject).toEqual({ x: 0.2, y: 0.8 });
    expect(vm.getSnapshot().document.crop.ratio).toBe('1:1');
    expect(vm.getSnapshot().document.variants).toHaveLength(1);
  });

  it('keeps edits in memory and reports persistence failure', () => {
    repository.fail = true;
    vm.loadDemo();
    expect(vm.getSnapshot().phase).toBe('error');
    expect(vm.getSnapshot().document.image).not.toBeNull();
    expect(vm.getSnapshot().error).toContain('本地保存失败');
  });

  it('updates a variant name and note', () => {
    vm.loadDemo();
    vm.saveVariant();
    const id = vm.getSnapshot().document.variants[0].id;
    vm.updateVariant(id, { name: '封面', note: '暖色调' });
    const variant = vm.getSnapshot().document.variants[0];
    expect(variant.name).toBe('封面');
    expect(variant.note).toBe('暖色调');
  });

  it('duplicates a variant right after the source with a new id', () => {
    vm.loadDemo();
    vm.saveVariant();
    const id = vm.getSnapshot().document.variants[0].id;
    vm.updateVariant(id, { name: '封面', note: '备用' });
    vm.duplicateVariant(id);
    const variants = vm.getSnapshot().document.variants;
    expect(variants).toHaveLength(2);
    expect(variants[0].id).toBe(id);
    expect(variants[1].id).not.toBe(id);
    expect(variants[1].name).toBe('封面');
    expect(variants[1].note).toBe('备用');
    expect(variants[1].x).toBe(variants[0].x);
  });

  it('moves a variant up and down', () => {
    vm.loadDemo();
    vm.saveVariant();
    vm.saveVariant();
    vm.saveVariant();
    const [a, b, c] = vm.getSnapshot().document.variants;
    vm.moveVariant(b.id, 'up');
    expect(vm.getSnapshot().document.variants.map((item) => item.id)).toEqual([b.id, a.id, c.id]);
    vm.moveVariant(b.id, 'down');
    expect(vm.getSnapshot().document.variants.map((item) => item.id)).toEqual([a.id, b.id, c.id]);
  });

  it('does not move the first item up or the last item down', () => {
    vm.loadDemo();
    vm.saveVariant();
    vm.saveVariant();
    const [a, b] = vm.getSnapshot().document.variants;
    vm.moveVariant(a.id, 'up');
    expect(vm.getSnapshot().document.variants.map((item) => item.id)).toEqual([a.id, b.id]);
    vm.moveVariant(b.id, 'down');
    expect(vm.getSnapshot().document.variants.map((item) => item.id)).toEqual([a.id, b.id]);
  });
});
