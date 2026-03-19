import React from "react";
import "./skeleton.css";

export function SkeletonBanner({ height = 120, className = "" }) {
  return <div className={`skeleton skeleton-banner ${className}`} style={{ height }} />;
}

export function SkeletonCard({ lines = 3, className = "" }) {
  return (
    <div className={`skeleton-card ${className}`}>
      <div className="skeleton skeleton-title" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton skeleton-text" style={{ width: `${85 - i * 15}%` }} />
      ))}
    </div>
  );
}

export function SkeletonList({ items = 5, lines = 2, className = "" }) {
  return (
    <div className={`skeleton-list ${className}`}>
      {Array.from({ length: items }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </div>
  );
}
