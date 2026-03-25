/**
 * Japanese Flat Design - Profile Theme Selector Component
 * Allows users to select from 8 Japanese-inspired color themes
 */

import React, { useState } from 'react';
import { japaneseThemes, type JapaneseTheme } from '../styles/japaneseThemes';
import '../styles/JapaneseFlatDesign.css';

interface JapaneseThemeSelectorProps {
  currentTheme: JapaneseTheme;
  onThemeChange: (theme: JapaneseTheme) => void;
}

export const JapaneseThemeSelector: React.FC<JapaneseThemeSelectorProps> = ({
  currentTheme,
  onThemeChange,
}) => {
  const [previewTheme, setPreviewTheme] = useState<JapaneseTheme | null>(null);

  const handlePreview = (theme: JapaneseTheme) => {
    setPreviewTheme(theme);
  };

  const handleReset = () => {
    setPreviewTheme(null);
  };

  const activeTheme = previewTheme || currentTheme;
  const colors = japaneseThemes[activeTheme].colors;

  return (
    <div className="jp-profile-layout">
      <div className="jp-profile-container">
        {/* Header */}
        <header className="jp-profile-header">
          <h1 className="jp-profile-title">🎨 Wybierz Motyw</h1>
          <p className="jp-profile-subtitle">
            Nowoczesny Flat Design inspirowany japońską estetyką
          </p>
        </header>

        {/* Theme Grid */}
        <div className="jp-theme-grid">
          {(Object.keys(japaneseThemes) as JapaneseTheme[]).map((theme) => {
            const themeData = japaneseThemes[theme];
            const isActive = activeTheme === theme;

            return (
              <div
                key={theme}
                className={`jp-theme-card ${isActive ? 'active' : ''}`}
                onClick={() => onThemeChange(theme)}
                onMouseEnter={() => handlePreview(theme)}
                onMouseLeave={handleReset}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onThemeChange(theme);
                  }
                }}
              >
                {/* Color Preview */}
                <div className="jp-theme-preview">
                  <div
                    className="jp-theme-color"
                    style={{ backgroundColor: themeData.colors.primary }}
                    title="Primary"
                  />
                  <div
                    className="jp-theme-color"
                    style={{ backgroundColor: themeData.colors.secondary }}
                    title="Secondary"
                  />
                  <div
                    className="jp-theme-color"
                    style={{ backgroundColor: themeData.colors.accent }}
                    title="Accent"
                  />
                  <div
                    className="jp-theme-color"
                    style={{ backgroundColor: themeData.colors.background }}
                    title="Background"
                  />
                  <div
                    className="jp-theme-color"
                    style={{ backgroundColor: themeData.colors.text }}
                    title="Text"
                  />
                </div>

                {/* Theme Info */}
                <div className="jp-theme-info">
                  <div className="jp-theme-name">{themeData.name}</div>
                  <div className="jp-theme-desc">{themeData.description}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Preview */}
        <div className="jp-section jp-animate-in">
          <div className="jp-section-header">
            <div className="jp-section-icon">👁️</div>
            <h2 className="jp-section-title">Podgląd na żywo</h2>
          </div>

          {/* Preview Elements */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ color: colors.text, marginBottom: '16px' }}>Przykładowe Elementy</h3>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <button
                className="jp-button jp-button-primary"
                style={{
                  backgroundColor: colors.primary,
                }}
              >
                Przycisk Główny
              </button>
              <button
                className="jp-button jp-button-secondary"
                style={{
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                }}
              >
                Przycisk Drugorzędny
              </button>
              <button className="jp-button jp-button-ghost">Przycisk Ghost</button>
            </div>

            {/* Form */}
            <div style={{ maxWidth: '400px', marginBottom: '24px' }}>
              <label className="jp-form-label">Przykładowe Pole</label>
              <input
                type="text"
                className="jp-form-input"
                placeholder="Wpisz tekst..."
                style={{
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text,
                }}
              />
            </div>

            {/* Toggle Cards */}
            <div className="jp-toggle-grid">
              <div
                className="jp-toggle-card active"
                style={{
                  backgroundColor: colors.secondary,
                  borderColor: colors.primary,
                }}
              >
                <label className="jp-toggle-label">
                  <input
                    type="checkbox"
                    className="jp-toggle-checkbox"
                    defaultChecked
                    style={{ accentColor: colors.primary }}
                  />
                  <div className="jp-toggle-text">
                    <strong>Opcja 1</strong>
                    <span>Aktywna opcja</span>
                  </div>
                </label>
              </div>
              <div
                className="jp-toggle-card"
                style={{
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                }}
              >
                <label className="jp-toggle-label">
                  <input
                    type="checkbox"
                    className="jp-toggle-checkbox"
                    style={{ accentColor: colors.primary }}
                  />
                  <div className="jp-toggle-text">
                    <strong>Opcja 2</strong>
                    <span>Nieaktywna opcja</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Color Palette */}
          <div>
            <h3 style={{ color: colors.text, marginBottom: '16px' }}>Paleta Kolorów</h3>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {Object.entries(colors).map(([name, value]) => (
                <div key={name} style={{ textAlign: 'center' }}>
                  <div
                    className="jp-color-swatch"
                    style={{ backgroundColor: value }}
                    title={name}
                  />
                  <div
                    style={{
                      fontSize: '11px',
                      color: colors.textMuted,
                      marginTop: '4px',
                      textTransform: 'capitalize',
                    }}
                  >
                    {name.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Current Selection */}
        <div className="jp-section jp-animate-in">
          <div className="jp-section-header">
            <div className="jp-section-icon">✓</div>
            <h2 className="jp-section-title">Aktualny Wybór</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: japaneseThemes[currentTheme].colors.primary,
              }}
            />
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: colors.text }}>
                {japaneseThemes[currentTheme].name}
              </div>
              <div style={{ color: colors.textMuted }}>
                {japaneseThemes[currentTheme].description}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div
          style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '32px' }}
        >
          <button className="jp-button jp-button-ghost" onClick={() => setPreviewTheme(null)}>
            Anuluj
          </button>
          <button className="jp-button jp-button-secondary" onClick={handleReset}>
            Resetuj Podgląd
          </button>
          <button
            className="jp-button jp-button-primary"
            style={{ backgroundColor: colors.primary }}
            onClick={() => {
              // Theme is already applied via onThemeChange
              console.log('Theme saved:', currentTheme);
            }}
          >
            Zapisz Motyw
          </button>
        </div>
      </div>
    </div>
  );
};

export default JapaneseThemeSelector;
