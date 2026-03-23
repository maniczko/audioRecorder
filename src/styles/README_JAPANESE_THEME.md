# Japanese Flat Design - Profile Theme

## 📁 Nowe Pliki

1. **`src/styles/japaneseThemes.ts`** - Palety kolorów (8 motywów)
2. **`src/styles/JapaneseFlatDesign.css`** - Style CSS
3. **`src/components/JapaneseThemeSelector.tsx`** - Komponent React

## 🎨 Dostępne Motywy

| Nazwa | Kolor Główny | Inspiracja |
|-------|--------------|------------|
| 🌸 Sakura | Różowy | Kwiat wiśni |
| 🍵 Matcha | Zielony | Herbata matcha |
| 🌊 Indigo | Niebieski | Tradycyjny barwnik |
| 🌑 Sumi | Czarny | Tusz sumi |
| 🍁 Momiji | Czerwony | Liście klonu |
| 🏯 Wabi-Sabi | Brązowy | Niedoskonałe piękno |
| 🎌 Koi | Pomarańczowy | Ryba koi |
| 👘 Miyabi | Fioletowy | Elegancja |

## 🚀 Jak Użyć

### W ProfileTab.tsx

```tsx
import { JapaneseThemeSelector } from './components/JapaneseThemeSelector';
import { japaneseThemes, type JapaneseTheme } from './styles/japaneseThemes';
import './styles/JapaneseFlatDesign.css';

// W stanie komponentu
const [selectedTheme, setSelectedTheme] = useState<Japane seTheme>('sakura');

// W renderowaniu
<Japane seThemeSelector
  currentTheme={selectedTheme}
  onThemeChange={(theme) => {
    setSelectedTheme(theme);
    // Zapisz do localStorage lub API
    localStorage.setItem('profile-theme', theme);
  }}
/>
```

### Zastosowanie Motywu

```tsx
// W useEffect lub przy ładowaniu
useEffect(() => {
  const savedTheme = localStorage.getItem('profile-theme') as Japane seTheme;
  if (savedTheme && japaneseThemes[savedTheme]) {
    setSelectedTheme(savedTheme);
    document.documentElement.className = `theme-${savedTheme}`;
  }
}, []);

// Przy zmianie motywu
const handleThemeChange = (theme: Japane seTheme) => {
  setSelectedTheme(theme);
  document.documentElement.className = `theme-${theme}`;
  localStorage.setItem('profile-theme', theme);
};
```

## 🎯 Flat Design Principles

### Zasady
- ✅ **Brak gradientów** - jednolite kolory
- ✅ **Brak cieni 3D** - płaskie elementy
- ✅ **Minimalizm** - tylko niezbędne elementy
- ✅ **Prosta typografia** - czytelne fonty
- ✅ **Kontrast** - wyraźne rozróżnienie

### CSS Variables
```css
--jp-primary       /* Kolor główny */
--jp-secondary     /* Kolor drugorzędny */
--jp-accent        /* Akcent */
--jp-background    /* Tło */
--jp-surface       /* Powierzchnia */
--jp-text          /* Tekst */
--jp-text-muted    /* Wyciszony tekst */
--jp-border        /* Obramowanie */
```

## 📱 Responsive

Layout jest w pełni responsywny:
- **Desktop**: Grid z kartami motywów
- **Mobile**: Pojedyncza kolumna
- **Tablet**: 2 kolumny

## ♿ Accessibility

- ✅ Keyboard navigation (Tab, Enter, Space)
- ✅ ARIA labels
- ✅ Focus states
- ✅ High contrast options

## 🎨 Przykład Użycia

```tsx
// App.tsx lub main layout
import { japaneseThemes } from './styles/japaneseThemes';
import './styles/JapaneseFlatDesign.css';

function App() {
  return (
    <div className="jp-profile-layout">
      <JapaneseThemeSelector
        currentTheme={currentTheme}
        onThemeChange={handleThemeChange}
      />
    </div>
  );
}
```

## 🔧 Customization

### Dodanie Własnego Motywu

```ts
// src/styles/japaneseThemes.ts
export const japaneseThemes = {
  // ...istniejące motywy
  myCustomTheme: {
    name: '自定义 - Custom',
    description: 'Your custom theme',
    colors: {
      primary: '#YOUR_COLOR',
      // ...reszta kolorów
    },
  },
};
```

### Zmiana Domyślnego Motywu

```ts
// Zmień w japaneseThemes.ts
const defaultTheme: Japane seTheme = 'matcha'; // domyślnie 'sakura'
```

## 📊 Preview

Każdy motyw zawiera podgląd na żywo z:
- Przyciskami
- Polami formularzy
- Toggle cards
- Full color palette

## 🎌 Inspiracje

- **Sakura**: Kwitnąca wiśnia w Kyoto
- **Matcha**: Ceremonia herbaty
- **Indigo**: Tradycyjny barwnik aizome
- **Sumi**: Kaligrafia tuszem
- **Momiji**: Jesienne liście klonu
- **Wabi-Sabi**: Piękno niedoskonałości
- **Koi**: Stawy z rybami koi
- **Miyabi**: Dworska elegancja Heian
