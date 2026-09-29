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

  it('saves variants with custom names and notes, trimming blanks away', () => {
    vm.loadDemo();
    vm.saveVariant(' 封面 ', '给首页用');
    vm.saveVariant('   ', '');
    const [named, unnamed] = vm.getSnapshot().document.variants;
    expect(named.name).toBe('封面');
    expect(named.note).toBe('给首页用');
    expect(unnamed.name).toBeUndefined();
    expect(unnamed.note).toBeUndefined();
    expect(repository.document.variants).toHaveLength(2);
  });

  it('duplicates a variant right after the source with a copy name', () => {
    vm.loadDemo();
    vm.saveVariant('封面', '定稿前');
    vm.saveVariant('备选', '');
    const source = vm.getSnapshot().document.variants[0];
    vm.duplicateVariant(source.id);
    const variants = vm.getSnapshot().document.variants;
    expect(variants).toHaveLength(3);
    expect(variants[0].id).toBe(source.id);
    expect(variants[1].name).toBe('封面 副本');
    expect(variants[1].note).toBe('定稿前');
    expect(variants[1].id).not.toBe(source.id);
    expect(variants[2].name).toBe('备选');
  });

  it('moves variants without disturbing the rest of the order', () => {
    vm.loadDemo();
    vm.saveVariant('一', '');
    vm.saveVariant('二', '');
    vm.saveVariant('三', '');
    const third = vm.getSnapshot().document.variants[2];
    vm.moveVariant(third.id, -1);
    expect(vm.getSnapshot().document.variants.map((variant) => variant.name)).toEqual(['一', '三', '二']);
    vm.moveVariant(third.id, -1);
    expect(vm.getSnapshot().document.variants.map((variant) => variant.name)).toEqual(['三', '一', '二']);
    vm.moveVariant(third.id, -1);
    expect(vm.getSnapshot().document.variants.map((variant) => variant.name)).toEqual(['三', '一', '二']);
    expect(repository.document.variants.map((variant) => variant.name)).toEqual(['三', '一', '二']);
  });

  it('updates name and note, clearing fields left blank', () => {
    vm.loadDemo();
    vm.saveVariant('旧名', '旧备注');
    const id = vm.getSnapshot().document.variants[0].id;
    vm.updateVariantMeta(id, '  ', '新备注');
    const variant = vm.getSnapshot().document.variants[0];
    expect(variant.name).toBeUndefined();
    expect(variant.note).toBe('新备注');
  });

  it('removes a variant and keeps the remaining order', () => {
    vm.loadDemo();
    vm.saveVariant('甲', '');
    vm.saveVariant('乙', '');
    const id = vm.getSnapshot().document.variants[0].id;
    vm.removeVariant(id);
    const variants = vm.getSnapshot().document.variants;
    expect(variants).toHaveLength(1);
    expect(variants[0].name).toBe('乙');
  });

  it('refuses to save or duplicate beyond the cap instead of dropping variants', () => {
    vm.loadDemo();
    for (let index = 0; index < 8; index += 1) vm.saveVariant(`方案${index}`, '');
    vm.saveVariant('溢出', '');
    expect(vm.getSnapshot().document.variants).toHaveLength(8);
    expect(vm.getSnapshot().document.variants.some((variant) => variant.name === '溢出')).toBe(false);
    expect(vm.getSnapshot().notice).toContain('已满');
    vm.duplicateVariant(vm.getSnapshot().document.variants[0].id);
    expect(vm.getSnapshot().document.variants).toHaveLength(8);
  });
});
