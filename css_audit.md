# Audyt CSS, Styli i Layoutu

### 1. Style inline (style={{...}}) (Rozbijają zunifikowany design system)
Znaleziono 201 wystąpień. Głównie w:
- StudioMeetingView.tsx: 61 wystąpień
- RecordingsTab.tsx: 49 wystąpień
- ProfileTab.tsx: 35 wystąpień
- TranscriptPanel.tsx: 11 wystąpień
- PeopleTab.tsx: 9 wystąpień
- UnifiedPlayer.tsx: 9 wystąpień
- TaskKanbanView.tsx: 6 wystąpień
- KpiDashboard.tsx: 3 wystąpień
- CalendarTab.tsx: 2 wystąpień
- Skeleton.tsx: 2 wystąpień

### 2. Harcoded Kolory (Brak użycia zmiennych z index.css zapobiega poprawnej obsłudze motywów np. dark/light mode)
Znaleziono 765 wystąpień. Głównie w:
- tasks.css: 249 wystąpień
- StudioMeetingViewStyles.css: 146 wystąpień
- studio.css: 91 wystąpień
- App.css: 35 wystąpień
- UnifiedPlayerStyles.css: 33 wystąpień
- AiTaskSuggestionsPanelStyles.css: 30 wystąpień
- TranscriptPanelStyles.css: 19 wystąpień
- export.tsx: 17 wystąpień
- RecordingsTab.tsx: 15 wystąpień
- TaskScheduleViewStyles.css: 14 wystąpień

### 3. Wartości w Pikselach (px) (Problemy ze skalowaniem / typografią i brak responsywnych zmiennych np. --space-X / --radius-X)
Znaleziono 2339 instancji twardego bindowania pikseli w layoutach (margin, padding, height, width, font-size, gap). Najczęstsze pliki:
- tasks.css: 493 wystąpień
- StudioMeetingViewStyles.css: 362 wystąpień
- studio.css: 214 wystąpień
- App.css: 191 wystąpień
- NotesTabStyles.css: 100 wystąpień
- UnifiedPlayerStyles.css: 88 wystąpień
- calendar.css: 85 wystąpień
- ProfileTabStyles.css: 67 wystąpień
- TranscriptPanelStyles.css: 63 wystąpień
- TaskDetailsPanelStyles.css: 60 wystąpień

### 4. Użycie !important (Znacznie utrudnia kaskadowość CSS we fragmentach komponentów)
Znaleziono 13 wystąpień (najczęściej oznaka błędów w architekturze BEM lub designu).
- App.css: 5 wystąpień
- studio.css: 3 wystąpień
- AiTaskSuggestionsPanelStyles.css: 2 wystąpień
- NotesTabStyles.css: 1 wystąpień
- layout.css: 1 wystąpień
- tasks.css: 1 wystąpień

### Rekomendowany Action Plan:
1. Zastąpić style={{}} w StudioMeetingView i widokach na klasy z LayoutPrimitives lub nowe precyzyjne moduły CSS (część już została usunięta w poprzednim etapie, ale nadal pozostało sporo inline).
2. Kolory (szczególnie backgroundy i bordery w layoutach nagrań) przepisać na globalne tokeny ar(--bg-panel-X) oraz akcenty na ar(--accent) i ar(--brand-primary).
3. Skonfigurować zunifikowane skalowanie (np. zamienić order-radius: 4px na order-radius: var(--radius-sm) oraz gap/padding: 8px na ar(--space-2) itp.
4. Audyty dot. !important wskazują na przysłanianie modułów (często wygenerowanych przez starsze widoki/kalendarz).
