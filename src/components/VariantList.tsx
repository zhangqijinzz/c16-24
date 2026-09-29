import { useState } from 'react';
import { variantDisplayName, variantNumber } from '../domain';
import type { CropVariant, ImageAsset } from '../model';

interface VariantListProps {
  variants: CropVariant[];
  image: ImageAsset;
  current: CropVariant;
  onSave: () => void;
  onSelect: (id: string) => void;
  onUpdate: (id: string, changes: { name?: string; note?: string }) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
}

export function VariantList({ variants, image, current, onSave, onSelect, onUpdate, onDuplicate, onMove }: VariantListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <section className="variants-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">SAVED FRAMES</p>
          <h3>裁切方案 <span>{variants.length}</span></h3>
        </div>
        <button className="save-button" onClick={onSave}>保存当前</button>
      </div>
      {variants.length === 0 ? (
        <div className="variant-empty">
          <span>◇</span>
          <p>还没有保存的方案</p>
          <small>调整画框后保存，比较不同构图取舍。</small>
        </div>
      ) : (
        <div className="variant-list">
          {variants.map((variant, index) => {
            const number = variantNumber(index);
            const name = variantDisplayName(variant, index, variants);
            const isEditing = editingId === variant.id;
            const isSelected = current.x === variant.x && current.y === variant.y && current.width === variant.width;
            return (
              <div className={`variant-card ${isSelected ? 'selected' : ''}`} key={variant.id}>
                <button type="button" className="variant-card-main" onClick={() => onSelect(variant.id)}>
                  <span className="variant-thumb">
                    <img src={image.src} alt="" style={{ objectPosition: `${variant.x * 100}% ${variant.y * 100}%` }} />
                    <span className="variant-num">{number}</span>
                  </span>
                  <span className="variant-info">
                    <strong>{name}</strong>
                    {!isEditing && variant.note ? <small className="variant-note">{variant.note}</small> : null}
                    <small className="variant-meta">{variant.ratio === 'free' ? '自由裁切' : variant.ratio} · {Math.round(variant.width * 100)}%</small>
                  </span>
                </button>
                {isEditing ? (
                  <div className="variant-editor" onClick={(event) => event.stopPropagation()}>
                    <input
                      className="variant-name-input"
                      value={variant.name ?? ''}
                      placeholder={`方案 ${number}（自定义名称）`}
                      onChange={(event) => onUpdate(variant.id, { name: event.target.value })}
                    />
                    <input
                      className="variant-note-input"
                      value={variant.note ?? ''}
                      placeholder="加一句备注…"
                      onChange={(event) => onUpdate(variant.id, { note: event.target.value })}
                    />
                    <button className="variant-done" onClick={() => setEditingId(null)}>完成</button>
                  </div>
                ) : (
                  <div className="variant-actions">
                    <button type="button" title="复制方案" onClick={(event) => { event.stopPropagation(); onDuplicate(variant.id); }}>⧉</button>
                    <button type="button" title="上移" disabled={index === 0} onClick={(event) => { event.stopPropagation(); onMove(variant.id, 'up'); }}>↑</button>
                    <button type="button" title="下移" disabled={index === variants.length - 1} onClick={(event) => { event.stopPropagation(); onMove(variant.id, 'down'); }}>↓</button>
                    <button type="button" title="编辑名称和备注" onClick={(event) => { event.stopPropagation(); setEditingId(variant.id); }}>✎</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="variant-tip">
        <span>✦</span>
        <p>建议保存至少 3 个版本：<br />保守、平衡、实验性。</p>
      </div>
    </section>
  );
}
