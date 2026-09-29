import { useState } from 'react';
import { variantLabels } from '../domain';
import type { CropVariant, ImageAsset } from '../model';

interface VariantListProps {
  variants: CropVariant[];
  image: ImageAsset;
  current: CropVariant;
  onSave: (name: string, note: string) => void;
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, delta: number) => void;
  onUpdateMeta: (id: string, name: string, note: string) => void;
  onRemove: (id: string) => void;
}

export function VariantList({ variants, image, current, onSave, onSelect, onDuplicate, onMove, onUpdateMeta, onRemove }: VariantListProps) {
  const [draftName, setDraftName] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNote, setEditNote] = useState('');
  const labels = variantLabels(variants);

  const saveCurrent = () => {
    onSave(draftName, draftNote);
    setDraftName('');
    setDraftNote('');
  };

  const startEdit = (variant: CropVariant) => {
    setEditingId(variant.id);
    setEditName(variant.name ?? '');
    setEditNote(variant.note ?? '');
  };

  const commitEdit = () => {
    if (editingId) onUpdateMeta(editingId, editName, editNote);
    setEditingId(null);
  };

  return (
    <section className="variants-panel">
      <div className="panel-heading"><div><p className="eyebrow">SAVED FRAMES</p><h3>裁切方案 <span>{variants.length}</span></h3></div></div>
      <div className="variant-save-form">
        <input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="方案名称（留空用序号）" maxLength={20} />
        <input value={draftNote} onChange={(event) => setDraftNote(event.target.value)} placeholder="简短备注（可留空）" maxLength={40} />
        <button className="save-button" onClick={saveCurrent}>保存当前</button>
      </div>
      {variants.length === 0 ? <div className="variant-empty"><span>◇</span><p>还没有保存的方案</p><small>调整画框后保存，比较不同构图取舍。</small></div> : <div className="variant-list">{variants.map((variant, index) => <article className={`variant-card ${current.x === variant.x && current.y === variant.y && current.width === variant.width ? 'selected' : ''}`} key={variant.id}>
        <button className="variant-main" onClick={() => onSelect(variant.id)}>
          <span className="variant-thumb"><img src={image.src} alt="" style={{ objectPosition: `${variant.x * 100}% ${variant.y * 100}%` }} /></span>
          <span className="variant-info"><strong>{labels[index]}</strong><small>{variant.ratio === 'free' ? '自由裁切' : variant.ratio} · {Math.round(variant.width * 100)}%</small>{variant.note && <small className="variant-note">{variant.note}</small>}</span>
          <em>→</em>
        </button>
        <div className="variant-actions">
          <button aria-label="上移" title="上移" disabled={index === 0} onClick={() => onMove(variant.id, -1)}>↑</button>
          <button aria-label="下移" title="下移" disabled={index === variants.length - 1} onClick={() => onMove(variant.id, 1)}>↓</button>
          <button aria-label="复制一份" title="复制一份" onClick={() => onDuplicate(variant.id)}>⧉</button>
          <button aria-label="编辑名称与备注" title="编辑名称与备注" onClick={() => (editingId === variant.id ? setEditingId(null) : startEdit(variant))}>✎</button>
          <button aria-label="删除" title="删除" onClick={() => onRemove(variant.id)}>×</button>
        </div>
        {editingId === variant.id && <div className="variant-edit">
          <input value={editName} onChange={(event) => setEditName(event.target.value)} placeholder="方案名称（留空用序号）" maxLength={20} />
          <input value={editNote} onChange={(event) => setEditNote(event.target.value)} placeholder="简短备注（可留空）" maxLength={40} />
          <div className="edit-row"><button onClick={commitEdit}>确定</button><button onClick={() => setEditingId(null)}>取消</button></div>
        </div>}
      </article>)}</div>}
      <div className="variant-tip"><span>✦</span><p>建议保存至少 3 个版本：<br />保守、平衡、实验性。</p></div>
    </section>
  );
}
