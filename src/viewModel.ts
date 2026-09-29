import { useState, useSyncExternalStore } from 'react';
import { cropForRatio, makeVariant, moveCrop, resizeCrop, variantLabels } from './domain';
import { EMPTY_DOCUMENT, MAX_VARIANTS, type CropVariant, type FrameDocument, type GuideKey, type Ratio, type ViewState } from './model';
import type { FrameRepository } from './repository';
import type { ImageService } from './service';

type Listener = () => void;

export class FrameSenseViewModel {
  private state: ViewState = { phase: 'loading', document: structuredClone(EMPTY_DOCUMENT), compareOpen: false, notice: '', error: null };
  private readonly listeners = new Set<Listener>();
  private idSequence = 0;

  constructor(private readonly repository: FrameRepository, private readonly imageService: ImageService) {}

  getSnapshot = (): ViewState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private patch(next: Partial<ViewState>): void {
    this.state = { ...this.state, ...next };
    this.listeners.forEach((listener) => listener());
  }

  private persist(document: FrameDocument, notice: string): void {
    this.patch({ document, phase: 'editing', notice, error: null });
    try {
      this.repository.save(document);
    } catch {
      this.patch({ phase: 'error', error: '本地保存失败，但当前编辑仍保留在页面中。请检查浏览器存储权限。' });
    }
  }

  async initialize(): Promise<void> {
    this.patch({ phase: 'loading', notice: '正在恢复上次工作状态…', error: null });
    try {
      const document = this.repository.load();
      this.patch({ document, phase: document.image ? 'editing' : 'ready', notice: document.image ? '已恢复上次工作状态' : '欢迎来到 FrameSense，先载入示例或导入图片。' });
    } catch {
      this.patch({ phase: 'error', notice: '未能读取历史状态，可继续新建工作。', error: '本地数据读取失败。' });
    }
  }

  async importImage(file: File): Promise<void> {
    this.patch({ phase: 'loading', notice: '正在载入图片…', error: null });
    try {
      const image = await this.imageService.readFile(file);
      const document: FrameDocument = { ...structuredClone(EMPTY_DOCUMENT), image };
      this.persist(document, '图片已载入，可以开始构图。');
    } catch (error) {
      this.patch({ phase: 'error', error: error instanceof Error ? error.message : '图片载入失败。' });
    }
  }

  loadDemo(): void {
    this.persist({ ...structuredClone(EMPTY_DOCUMENT), image: this.imageService.demo() }, '示例图片已载入。');
  }

  toggleGuide(guide: GuideKey): void {
    const document = { ...this.state.document, guides: { ...this.state.document.guides, [guide]: !this.state.document.guides[guide] } };
    this.persist(document, '辅助层已更新。');
  }

  setRatio(ratio: Ratio): void {
    const image = this.state.document.image;
    if (!image) return;
    const crop = cropForRatio(ratio, image.width / image.height, this.state.document.crop);
    this.persist({ ...this.state.document, crop }, `${ratio === 'free' ? '自由' : ratio} 裁切已应用。`);
  }

  moveCrop(dx: number, dy: number): void {
    this.persist({ ...this.state.document, crop: moveCrop(this.state.document.crop, dx, dy) }, '裁切位置已调整。');
  }

  resizeCrop(width: number, height: number): void {
    this.persist({ ...this.state.document, crop: resizeCrop(this.state.document.crop, width, height) }, '裁切范围已调整。');
  }

  markSubject(x: number, y: number): void {
    this.persist({ ...this.state.document, subject: { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) } }, '主体标记已更新。');
  }

  private nextVariantId(): string {
    this.idSequence += 1;
    return `variant-${Date.now()}-${this.idSequence}`;
  }

  saveVariant(name = '', note = ''): void {
    const { variants } = this.state.document;
    if (variants.length >= MAX_VARIANTS) {
      this.patch({ notice: `方案已满 ${MAX_VARIANTS} 个，请先删除不再需要的方案。` });
      return;
    }
    const variant = makeVariant(this.state.document.crop, this.nextVariantId());
    const trimmedName = name.trim();
    const trimmedNote = note.trim();
    if (trimmedName) variant.name = trimmedName;
    else delete variant.name;
    if (trimmedNote) variant.note = trimmedNote;
    else delete variant.note;
    const next = [...variants, variant];
    const document = { ...this.state.document, variants: next };
    this.persist(document, `已保存「${variantLabels(next)[next.length - 1]}」。`);
  }

  selectVariant(id: string): void {
    const index = this.state.document.variants.findIndex((item) => item.id === id);
    if (index < 0) return;
    const variant = this.state.document.variants[index];
    const label = variantLabels(this.state.document.variants)[index];
    this.persist({ ...this.state.document, crop: { ...variant, id: 'current' } }, `已切换到「${label}」。`);
  }

  updateVariantMeta(id: string, name: string, note: string): void {
    if (!this.state.document.variants.some((variant) => variant.id === id)) return;
    const variants = this.state.document.variants.map((variant) => {
      if (variant.id !== id) return variant;
      const next: CropVariant = { ...variant };
      const trimmedName = name.trim();
      const trimmedNote = note.trim();
      if (trimmedName) next.name = trimmedName;
      else delete next.name;
      if (trimmedNote) next.note = trimmedNote;
      else delete next.note;
      return next;
    });
    this.persist({ ...this.state.document, variants }, '方案信息已更新。');
  }

  duplicateVariant(id: string): void {
    const { variants } = this.state.document;
    const index = variants.findIndex((variant) => variant.id === id);
    if (index < 0) return;
    if (variants.length >= MAX_VARIANTS) {
      this.patch({ notice: `方案已满 ${MAX_VARIANTS} 个，请先删除不再需要的方案。` });
      return;
    }
    const source = variants[index];
    const copy: CropVariant = { ...source, id: this.nextVariantId() };
    const sourceName = source.name?.trim() ?? '';
    if (sourceName) copy.name = `${sourceName} 副本`;
    else delete copy.name;
    const next = [...variants.slice(0, index + 1), copy, ...variants.slice(index + 1)];
    const label = variantLabels(variants)[index];
    this.persist({ ...this.state.document, variants: next }, `已复制「${label}」，副本排在原方案之后。`);
  }

  moveVariant(id: string, delta: number): void {
    const variants = [...this.state.document.variants];
    const index = variants.findIndex((variant) => variant.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= variants.length) return;
    const [moved] = variants.splice(index, 1);
    variants.splice(target, 0, moved);
    const label = variantLabels(variants)[target];
    this.persist({ ...this.state.document, variants }, `「${label}」已移到第 ${target + 1} 位。`);
  }

  removeVariant(id: string): void {
    const { variants } = this.state.document;
    const index = variants.findIndex((variant) => variant.id === id);
    if (index < 0) return;
    const label = variantLabels(variants)[index];
    const next = variants.filter((variant) => variant.id !== id);
    this.persist({ ...this.state.document, variants: next }, `已删除「${label}」。`);
  }

  toggleCompare(): void {
    this.patch({ compareOpen: !this.state.compareOpen });
  }
}

export function useFrameSenseViewModel(repository: FrameRepository, imageService: ImageService): [FrameSenseViewModel, ViewState] {
  const [viewModel] = useState(() => new FrameSenseViewModel(repository, imageService));
  const state = useSyncExternalStore(viewModel.subscribe, viewModel.getSnapshot, viewModel.getSnapshot);
  return [viewModel, state];
}
