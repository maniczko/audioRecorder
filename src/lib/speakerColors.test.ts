/**
 * speakerColors.test.ts
 *
 * Tests for speaker color assignment utilities
 */

import { describe, it, expect } from 'vitest';
import { getSpeakerColor, getSpeakerColorDim } from './speakerColors';

describe('speakerColors', () => {
  describe('getSpeakerColor', () => {
    it('returns consistent color for same speaker ID', () => {
      const color1 = getSpeakerColor('1');
      const color2 = getSpeakerColor('1');

      expect(color1).toBe(color2);
    });

    it('returns different colors for different speaker IDs', () => {
      const color1 = getSpeakerColor('0');
      const color2 = getSpeakerColor('1');

      expect(color1).not.toBe(color2);
    });

    it('handles numeric speaker IDs', () => {
      const color1 = getSpeakerColor(0);
      const color2 = getSpeakerColor(1);

      expect(color1).toBeDefined();
      expect(color2).toBeDefined();
      expect(color1).not.toBe(color2);
    });

    it('handles string numeric IDs', () => {
      const color1 = getSpeakerColor('0');
      const color2 = getSpeakerColor('1');

      expect(color1).toBeDefined();
      expect(color2).toBeDefined();
    });

    it('handles empty string speaker ID', () => {
      const color = getSpeakerColor('');

      expect(color).toBe('var(--accent, #75d6c4)');
    });

    it('handles null speaker ID', () => {
      const color = getSpeakerColor(null as any);

      expect(color).toBe('var(--accent, #75d6c4)');
    });

    it('handles undefined speaker ID', () => {
      const color = getSpeakerColor(undefined as any);

      expect(color).toBe('var(--accent, #75d6c4)');
    });

    it('handles negative speaker ID', () => {
      const color = getSpeakerColor(-1);

      expect(color).toBe('var(--accent, #75d6c4)');
    });

    it('returns valid hex color format', () => {
      const color = getSpeakerColor('1');

      expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('wraps around for large indices', () => {
      const color1 = getSpeakerColor('0');
      const color2 = getSpeakerColor('8'); // 8 % 8 = 0

      expect(color1).toBe(color2);
    });

    it('returns teal for speaker 0', () => {
      const color = getSpeakerColor('0');

      expect(color).toBe('#75d6c4');
    });

    it('returns indigo for speaker 1', () => {
      const color = getSpeakerColor('1');

      expect(color).toBe('#818cf8');
    });

    it('returns orange for speaker 2', () => {
      const color = getSpeakerColor('2');

      expect(color).toBe('#fb923c');
    });

    it('returns pink for speaker 3', () => {
      const color = getSpeakerColor('3');

      expect(color).toBe('#f472b6');
    });
  });

  describe('getSpeakerColorDim', () => {
    it('returns dimmed color for speaker ID', () => {
      const color = getSpeakerColorDim('1');

      expect(color).toBeDefined();
      expect(color).toMatch(/^#[0-9A-F]{6}40$/i);
    });

    it('returns consistent dimmed color for same speaker', () => {
      const color1 = getSpeakerColorDim('1');
      const color2 = getSpeakerColorDim('1');

      expect(color1).toBe(color2);
    });

    it('returns different dimmed colors for different speakers', () => {
      const color1 = getSpeakerColorDim('0');
      const color2 = getSpeakerColorDim('1');

      expect(color1).not.toBe(color2);
    });

    it('handles negative speaker ID', () => {
      const color = getSpeakerColorDim(-1);

      expect(color).toBe('rgba(117,214,196,0.15)');
    });

    it('returns dimmed teal for speaker 0', () => {
      const color = getSpeakerColorDim('0');

      expect(color).toBe('#75d6c440');
    });
  });

  describe('color consistency', () => {
    it('colors are consistent across multiple calls', () => {
      const colors = new Map();

      // Generate colors for multiple speakers
      for (let i = 0; i < 20; i++) {
        const speakerId = `${i}`;
        const color = getSpeakerColor(speakerId);
        colors.set(speakerId, color);
      }

      // Verify consistency
      for (let i = 0; i < 20; i++) {
        const speakerId = `${i}`;
        expect(getSpeakerColor(speakerId)).toBe(colors.get(speakerId));
      }
    });

    it('dimmed colors are consistent across multiple calls', () => {
      const colors = new Map();

      for (let i = 0; i < 10; i++) {
        const speakerId = `${i}`;
        const color = getSpeakerColorDim(speakerId);
        colors.set(speakerId, color);
      }

      for (let i = 0; i < 10; i++) {
        const speakerId = `${i}`;
        expect(getSpeakerColorDim(speakerId)).toBe(colors.get(speakerId));
      }
    });
  });
});
