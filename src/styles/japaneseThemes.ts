/**
 * Japanese-inspired Flat Design Color Palettes
 * Traditional and modern Japanese colors for UI themes
 */

export const japaneseThemes = {
  // 🌸 Sakura - Cherry Blossom (Spring)
  sakura: {
    name: '桜 - Sakura',
    description: 'Delicate cherry blossom colors',
    colors: {
      primary: '#F8B4D9', // Sakura pink
      primaryDark: '#E88BB8', // Darker pink
      secondary: '#FFD7E8', // Light pink
      accent: '#7FBF7F', // Fresh green leaves
      background: '#FFFBFE', // Almost white with pink tint
      surface: '#FFFFFF', // Pure white
      text: '#4A4A4A', // Soft charcoal
      textMuted: '#8B8B8B', // Light gray
      border: '#F0E6EA', // Very light pink-gray
      error: '#D46A6A', // Red camellia
      success: '#7FBF7F', // Bamboo green
      warning: '#F4B942', // Daikon flower
    },
  },

  // 🍵 Matcha - Green Tea (Zen)
  matcha: {
    name: '抹茶 - Matcha',
    description: 'Calming green tea tones',
    colors: {
      primary: '#7CB342', // Matcha green
      primaryDark: '#558B2F', // Dark green
      secondary: '#DCEDC8', // Light green
      accent: '#FFB74D', // Persimmon
      background: '#F9FBF7', // Very light green-white
      surface: '#FFFFFF',
      text: '#3D4035', // Dark green-gray
      textMuted: '#7D8075',
      border: '#E8ECE5',
      error: '#E57373',
      success: '#81C784',
      warning: '#FFB74D',
    },
  },

  // 🌊 Indigo - Aizome (Traditional)
  indigo: {
    name: '藍 - Aizome',
    description: 'Traditional indigo dye colors',
    colors: {
      primary: '#3F51B5', // Indigo
      primaryDark: '#303F9F', // Dark indigo
      secondary: '#9FA8DA', // Light indigo
      accent: '#FF7043', // Koi fish orange
      background: '#F5F7FA', // Cool white
      surface: '#FFFFFF',
      text: '#2C3E50', // Dark blue-gray
      textMuted: '#6C7A89',
      border: '#E1E8F0',
      error: '#E74C3C',
      success: '#27AE60',
      warning: '#F39C12',
    },
  },

  // 🌑 Sumi - Charcoal (Minimalist)
  sumi: {
    name: '墨 - Sumi',
    description: 'Japanese charcoal ink',
    colors: {
      primary: '#2C2C2C', // Sumi ink
      primaryDark: '#1A1A1A', // Darkest
      secondary: '#5A5A5A', // Medium gray
      accent: '#C41E3A', // Japanese red
      background: '#FAFAFA', // Paper white
      surface: '#FFFFFF',
      text: '#1A1A1A', // Nearly black
      textMuted: '#666666',
      border: '#E0E0E0',
      error: '#C41E3A',
      success: '#4A7C59',
      warning: '#D4A017',
    },
  },

  // 🍁 Momiji - Maple (Autumn)
  momiji: {
    name: '紅葉 - Momiji',
    description: 'Autumn maple leaves',
    colors: {
      primary: '#D84315', // Maple red
      primaryDark: '#BF360C', // Dark red
      secondary: '#FFAB91', // Light orange
      accent: '#FFD54F', // Ginkgo yellow
      background: '#FEF9F7', // Warm white
      surface: '#FFFFFF',
      text: '#3E2723', // Dark brown
      textMuted: '#795548',
      border: '#F5E6E0',
      error: '#C62828',
      success: '#558B2F',
      warning: '#F57F17',
    },
  },

  // 🌊 Wabi-Sabi (Imperfect Beauty)
  wabiSabi: {
    name: '侘寂 - Wabi-Sabi',
    description: 'Finding beauty in imperfection',
    colors: {
      primary: '#8D6E63', // Weathered wood
      primaryDark: '#6D4C41', // Dark wood
      secondary: '#D7CCC8', // Light beige
      accent: '#78909C', // Oxidized copper
      background: '#F5F0EB', // Unbleached paper
      surface: '#FAF8F5',
      text: '#4E342E', // Dark earth
      textMuted: '#8D6E63',
      border: '#E6DED8',
      error: '#A1887F',
      success: '#90A4AE',
      warning: '#BCAAA4',
    },
  },

  // 🎌 Koi (Elegant)
  koi: {
    name: '鯉 - Koi',
    description: 'Elegant koi pond colors',
    colors: {
      primary: '#FF7043', // Koi orange
      primaryDark: '#E64A19', // Dark orange
      secondary: '#FFCCBC', // Light orange
      accent: '#4DB6AC', // Pond teal
      background: '#E8F5F4', // Water tint
      surface: '#FFFFFF',
      text: '#263238', // Dark slate
      textMuted: '#546E7A',
      border: '#B2DFDB',
      error: '#E53935',
      success: '#43A047',
      warning: '#FB8C00',
    },
  },

  // 🏯 Miyabi (Elegant Refinement)
  miyabi: {
    name: '雅 - Miyabi',
    description: 'Refined elegance',
    colors: {
      primary: '#9C27B0', // Imperial purple
      primaryDark: '#7B1FA2', // Dark purple
      secondary: '#CE93D8', // Light purple
      accent: '#FFD700', // Gold
      background: '#FDF7FF', // Lavender white
      surface: '#FFFFFF',
      text: '#4A148C', // Deep purple
      textMuted: '#7B1FA2',
      border: '#E1BEE7',
      error: '#D32F2F',
      success: '#388E3C',
      warning: '#FFA000',
    },
  },
};

export type JapaneseTheme = keyof typeof japaneseThemes;
export type ThemeColors = typeof japaneseThemes.sakura.colors;
