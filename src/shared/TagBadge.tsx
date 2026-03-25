import React from 'react';
import './TagBadge.css';

export const TAG_COLORS = [
  '#ef4444', // red
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
  '#84cc16', // lime
  '#64748b', // slate
];

export function getTagColor(tagName) {
  if (!tagName) return TAG_COLORS[10];
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

export default function TagBadge({ tag, onRemove = undefined, className = '' }) {
  const color = getTagColor(tag);
  
  return (
    <span className={`tag-badge ${onRemove ? 'with-remove' : ''} ${className}`}>
      <span className="tag-badge-dot" style={{ backgroundColor: color }} />
      <span className="tag-badge-label">{tag}</span>
      {onRemove && (
        <button
          type="button"
          className="tag-badge-remove"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onRemove();
          }}
          title="Usuń tag"
        >
          ×
        </button>
      )}
    </span>
  );
}
