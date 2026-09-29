import { useState, useSyncExternalStore } from 'react';
import { cropForRatio, makeVariant, moveCrop, nextVariantId, resizeCrop, variantDisplayName } from './domain';
import { EMPTY_DOCUMENT, type FrameDocument, type GuideKey, type Ratio, type ViewState } from './model';
import type { FrameRepository } from './repository';
import type { ImageService } from './service';

type Listener = () => void;

export class FrameSenseViewModel {
  private state: ViewState = { phase: 'loading', document: structuredClone(EMPTY_DOCUMENT), compareOpen: false, notice: '', error: null };
  private readonly listeners = new Set<Listener>();

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

  saveVariant(): void {
    const id = nextVariantId();
    const variant = makeVariant(this.state.document.crop, id);
    const variants = [...this.state.document.variants, variant].slice(-8);
    const document = { ...this.state.document, variants };
    const index = variants.length - 1;
    const name = variantDisplayName(variant, index, variants);
    this.persist(document, `已保存裁切方案「${name}」。`);
  }

  selectVariant(id: string): void {
    const index = this.state.document.variants.findIndex((item) => item.id === id);
    if (index === -1) return;
    const variant = this.state.document.variants[index];
    const name = variantDisplayName(variant, index, this.state.document.variants);
    this.persist({ ...this.state.document, crop: { ...variant, id: 'current' } }, `已切换到方案「${name}」。`);
  }

  /** 编辑方案的自定义名称与备注；留空名称时界面兜底显示编号。 */
  updateVariant(id: string, changes: { name?: string; note?: string }): void {
    const variants = this.state.document.variants.map((item) => (item.id === id ? { ...item, ...changes } : item));
    this.persist({ ...this.state.document, variants }, '方案信息已更新。');
  }

  /** 从已有方案复制一份（含裁切参数、名称与备注），插到原方案之后并选中，便于继续调整。 */
  duplicateVariant(id: string): void {
    const index = this.state.document.variants.findIndex((item) => item.id === id);
    if (index === -1) return;
    if (this.state.document.variants.length >= 8) {
      this.patch({ notice: '最多保存 8 个方案，无法继续复制。' });
      return;
    }
    const source = this.state.document.variants[index];
    const copy = { ...source, id: nextVariantId() };
    const variants = [...this.state.document.variants];
    variants.splice(index + 1, 0, copy);
    this.persist({ ...this.state.document, variants, crop: { ...copy, id: 'current' } }, '已复制方案，可在副本上继续调整。');
  }

  /** 调整方案先后顺序（上移 / 下移），顺序同时作用于卡片与对比视图。 */
  moveVariant(id: string, direction: 'up' | 'down'): void {
    const variants = [...this.state.document.variants];
    const index = variants.findIndex((item) => item.id === id);
    if (index === -1) return;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= variants.length) return;
    [variants[index], variants[target]] = [variants[target], variants[index]];
    this.persist({ ...this.state.document, variants }, '方案顺序已调整。');
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
