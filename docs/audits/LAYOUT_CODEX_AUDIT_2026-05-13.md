# Audyt Layoutu i Konfiguracji Codex VoiceLog OS

Data: 2026-05-13  
Zakres: read-only audit UI/layoutu, visual QA, a11y, CSS lint, Playwright coverage oraz konfiguracji agentow/Codex.  
Srodowisko audytu: frontend `http://127.0.0.1:3002`, API `http://127.0.0.1:4001`, Windows, Node `v24.14.0`, pnpm `9.12.1`.

## Decyzja

**Ocena laczna: 5.5/10.**  
**Layout/product UX: 6.2/10.**  
**Tooling/config readiness: 4.5/10.**  
**Rekomendacja: NO-GO dla publicznego visual-quality signoff.** Produkt moze wejsc najwyzej w kontrolowana wewnetrzna bete layoutowa po oznaczeniu znanych ryzyk, ale nie powinien byc uznany za premium/public-ready dopoki P0/P1 ponizej nie sa zamkniete.

Najwazniejszy wniosek: core desktop jest w wielu miejscach uzywalny i nie wykazuje globalnego poziomego overflow, ale realny browser potwierdzil regresje responsive, clipping w Tasks/Profile, mojibake w UI oraz nieskalibrowane bramki release. Obecne visual checks sa falszywie zielone albo zbyt waskie.

## Scoring

| Kategoria | Ocena | Uzasadnienie |
|---|---:|---|
| Layout/UX | 6/10 | Desktop shell, Studio, Calendar, Recordings i People sa ogolnie czytelne, ale Tasks/Profile maja clipping i brak pelnej pewnosci dla modali/states. |
| Responsive behavior | 4/10 | Tablet/mobile shell nie przeszedl stabilnie nawigacji, drawer jest wizualnie slaby, mobile header generuje problemy szerokosci. |
| Accessibility | 7/10 | `audit:a11y:ci` ma 0 errors, ale pozostaja warning/info i brakuje pelnej real-browser matrycy focus states. |
| Visual QA tooling | 2/10 | `test:visual:check` skipuje caly suite, a lokalny `layout-visual` pada na baseline auth. |
| Design-system consistency | 5/10 | Widac proby skali spacingu i komponentow, ale CSS lint ma 6436 naruszen i duplikacje/rozjazdy responsive. |
| Codex config | 5/10 | `AGENTS.md` istnieje i jest centralny, ale brak repo `.codex/`, a docs agenta maja drift wobec aktualnego runtime i procesow. |
| Agent safety | 4/10 | `.qwen/settings.json` dopuszcza ryzykowne komendy typu `rm`, `del`, `git checkout`, `git push`, `git commit`. |
| Docs/config drift | 4/10 | Node audytu to v24 zamiast wymaganego Node 22; AGENTS ma stale Known Issues; Lighthouse nadal ma hardcoded `localhost:3000`. |

## Dowody

| Check | Wynik |
|---|---|
| Frontend health | `GET http://127.0.0.1:3002` zwrocil `200 text/html`. |
| Backend health | `GET http://127.0.0.1:4001/health` zwrocil `ok`, `db: ok`, `supabaseRemote: false`. |
| Runtime | `node --version` = `v24.14.0`; repo oczekuje Node 22.x, wiec wyniki nie sa w 100% release-authoritative. |
| `pnpm run audit:a11y:ci` | Exit `0`; 0 errors, 1 warning, 1 info. Raport: `reports/a11y-audit-2026-05-13T18-34-52-102Z.json`. |
| `pnpm exec stylelint "src/**/*.{css,scss}"` | Exit `2`; 53 pliki z problemami, 6436 warningow/bledow. |
| `pnpm run test:visual:check` | Exit `0`, ale 14 testow skipped przez globalny `test.skip`. |
| `layout-visual.spec.js` | Exit `1`; 2/2 auth snapshoty niezgodne z baseline. |
| Screenshot/DOM matrix | 45 scenariuszy, 48 PNG, 18 nieudanych krokow mobile/tablet, 0 global horizontal overflow, 5 widokow z mojibake, 34 text-overflow items, 83 offscreen items, 3 unlabeled icon buttons, 21 small buttons. |

Artefakty:

- Screenshot index: `reports/layout-audit/2026-05-13/SCREENSHOT_INDEX.md`
- DOM/results JSON: `reports/layout-audit/2026-05-13/layout-audit-results.json`
- Screenshoty: `reports/layout-audit/2026-05-13/screenshots/`

## P0

### P0-1: Visual QA gate jest falszywie zielony

- Ekran/obszar: release visual regression.
- Viewport: wszystkie, bo check jest globalnie pomijany.
- Reprodukcja: `pnpm run test:visual:check`.
- Dowod: `tests/e2e/visual-regression.spec.ts:17` ma globalny `test.skip`; wynik komendy to `14 skipped`. Jednoczesnie `pnpm exec playwright test tests/e2e/layout-visual.spec.js --project=chromium` pada na 2 snapshotach auth.
- Wplyw: release moze przejsc mimo braku realnej kontroli visual regression.
- Rekomendacja: usunac globalny skip albo wyjac ten skrypt z release gates; zbudowac stabilna matryce screenshotow `1440/1280/1024/768/390`; baseline aktualizowac dopiero po potwierdzeniu layoutu.

### P0-2: Mobile/tablet shell nie jest stabilnie audytowalny i uzywalny

- Ekran/obszar: shell/sidebar/header/navigation, Profile, notifications.
- Viewporty: `768x1024`, `390x844`.
- Reprodukcja: Playwright screenshot matrix na zalogowanym localStorage userze.
- Dowod: 18 failures: `tablet-768` i `mobile-390` nie przechodza nawigacji do Recordings/Calendar/Tasks/People, profilu i notifications. `mobile-390__mobile-sidebar-open.png` pokazuje drawer z mocnym przyciemnieniem/blur, ktory obniza czytelnosc menu.
- Wplyw: krytyczne dla publicznego MVP, bo podstawowa nawigacja na mobile/tablet nie ma potwierdzonej ergonomii.
- Rekomendacja: ustabilizowac drawer, warstwy overlay, hit-targets i zamykanie menu; dodac Playwright smoke dla `390x844` i `768x1024` obejmujacy przejscie przez wszystkie glowne zakladki.

### P0-3: Mojibake w user-facing UI

- Ekran/obszar: auth, app shell, copy PL.
- Viewporty: wszystkie.
- Reprodukcja: `rg -n "Ă|Ä|â|Â|�" src`.
- Dowod: `src/components/auth/AuthHeroSection.tsx:49` pokazuje `VoiceBĂłbr`; `src/components/app-shell/AppHeader.tsx:80` pokazuje `Szukaj wszÄ™dzie...`; `src/components/app-shell/AppSidebar.tsx:114` pokazuje `Strona gĹ‚Ăłwna`.
- Wplyw: bezposrednio obniza jakosc premium i wiarygodnosc produktu w PL.
- Rekomendacja: znormalizowac pliki do UTF-8, naprawic copy w komponentach i testach, dodac regresyjny skan mojibake do CI dla `src`, `scripts` i aktywnych docs.

## P1

### P1-1: Profile ucina prawa strone na tablecie

- Ekran/obszar: Profile.
- Viewport: `1024x768`.
- Reprodukcja: otworzyc Profile po zalogowaniu i odczekac do zaladowania panelu.
- Dowod: `tablet-1024__app-profile-confirmed.png` pokazuje obciety prawy panel kart; style profilu zaczynaja sie w `src/ProfileTabStyles.css:103`, `:129`, `:164`, z responsive tylko dla `768px` i `480px`.
- Wplyw: widok ustawien/profilu wyglada niedopracowany na typowym tablecie/laptopie low-height.
- Rekomendacja: dodac breakpoint ok. `1100px/1024px`, przejsc z bocznego hero grid na jedna kolumne, wymusic `min-width: 0` i bezpieczne `overflow-wrap`.

### P1-2: Tasks ma clipping tabeli/commandbara na desktop/tablet

- Ekran/obszar: Tasks.
- Viewporty: `1280x720`, `1024x768`.
- Reprodukcja: wejsc w Tasks w zalogowanym shellu.
- Dowod: `desktop-1280__app-tasks.png` pokazuje uciete prawe kolumny/akcje; DOM matrix raportuje offscreen items. Kluczowe style: `src/styles/tasks.css:1143`, `:1355`, `:1814`.
- Wplyw: najgorszy widoczny problem layoutu w operacyjnym widoku SaaS.
- Rekomendacja: rozdzielic responsywnosc tabeli od glownego layoutu, dac `.todo-table-wrap` kontrolowany horizontal scroll wewnatrz panelu, skompaktowac commandbar i ukryc/zwijac drugorzedne akcje przy `<=1280px`.

### P1-3: Mobile header ma za szeroka zawartosc

- Ekran/obszar: App header.
- Viewport: `390x844`.
- Reprodukcja: otworzyc zalogowany Studio na mobile.
- Dowod: `mobile-390__app-studio.png`; DOM wykryl szerokosc elementow header/main wieksza niz viewport mimo braku globalnego body horizontal overflow. Kod zawiera tekst i shortcut w `src/components/app-shell/AppHeader.tsx:77-84`; CSS probuje chowac te elementy w `src/styles/modern-layout.css:404-408`.
- Wplyw: ryzyko niewidocznych hit-targetow i niestabilnego ukladu na telefonach.
- Rekomendacja: ustawic header jako twarda siatke z ikonowymi akcjami na mobile, wymusic `min-width: 0`, zweryfikowac ze label/shortcut nie biora udzialu w layout flow.

### P1-4: CSS lint nie jest release-grade

- Ekran/obszar: design-system governance.
- Reprodukcja: `pnpm exec stylelint "src/**/*.{css,scss}" --formatter json --allow-empty-input`.
- Dowod: 6436 naruszen w 53 plikach; najwiecej w `src/styles/tasks.css`, `src/studio/StudioMeetingViewStyles.css`, `src/App.css`.
- Wplyw: bramka nie pomaga utrzymac spacingu, layoutu i design-system consistency.
- Rekomendacja: zaktualizowac Stylelint config pod aktualna wersje albo swiadomie przyjac legacy notation; najpierw wlaczyc zasady majace release value: duplicate selectors, invalid values, unknown custom properties, no-descending-specificity, z-index tokens, media breakpoint order.

### P1-5: Konfiguracja agentow ma za szerokie permissions i drift

- Obszar: Codex/Qwen/Copilot project governance.
- Reprodukcja: inspekcja `AGENTS.md`, `.github/copilot-instructions.md`, `.qwen/settings.json`, `.codex/`.
- Dowod: brak katalogu `.codex/`; `.qwen/settings.json:9`, `:13`, `:31` dopuszcza `del`, `git checkout`, `rm`. `AGENTS.md:247` wspomina stale "~286 failing frontend tests".
- Wplyw: ryzyko przypadkowych destrukcyjnych operacji przez agenta i niespojnych instrukcji miedzy narzedziami.
- Rekomendacja: ograniczyc allowlist do nie-destrukcyjnych komend, wymagac approval dla `rm/del/git checkout/git push`, odswiezyc Known Issues i dodac repo-scoped opis policy zgodny z aktualnym runtime Codex.

## P2

### P2-1: A11y warning w hero auth

- Ekran/obszar: Auth hero.
- Viewport: auth desktop/mobile.
- Reprodukcja: `pnpm run audit:a11y:ci`.
- Dowod: `components/auth/AuthHeroSection.tsx:63`, `heading-skip`, `h1 -> h3`.
- Rekomendacja: uzyc semantycznego `h2` albo zmienic feature headings na nie-heading text, jesli sa tylko etykietami kart.

### P2-2: Command Palette i a11y tests sa niepelne

- Ekran/obszar: Command Palette.
- Reprodukcja: inspekcja `src/CommandPalette.a11y.test.tsx`.
- Dowod: suite a11y jest `describe.skip`; screenshoty istnieja, ale nie ma aktywnej bramki keyboard/focus/aria dla realnego modala.
- Rekomendacja: odskipowac minimalny zestaw: open/close, focus trap, Escape, Arrow navigation, visible focus.

### P2-3: Notes istnieje w kodzie, ale nie jest widoczna w shell navigation

- Ekran/obszar: Notes.
- Reprodukcja: porownac `src/NotesTab.tsx` z nav/command palette.
- Dowod: `src/components/app-shell/AppSidebar.tsx:37-42` zawiera Studio/Recordings/Calendar/Tasks/People, bez Notes; `src/lib/commandPalette.ts:58-62` tez nie dodaje Notes.
- Wplyw: plan audytu obejmowal Notes, ale ekran nie jest osiagalny zwyklym flow.
- Rekomendacja: dodac Notes jako swiadomy tab albo usunac z release scope i dokumentacji.

### P2-4: Lighthouse i czesc E2E maja port/config drift

- Obszar: release tooling.
- Dowod: `package.json:86` ma `lighthouse http://localhost:3000`, podczas gdy Playwright uzywa `PLAYWRIGHT_BASE_URL` w `playwright.config.js:4`.
- Rekomendacja: ujednolicic env-driven URLs dla Lighthouse i visual smoke.

### P2-5: Playwright ma tylko desktop `chromium` project

- Obszar: release tooling.
- Dowod: `playwright.config.js:36` definiuje tylko `chromium`.
- Rekomendacja: dodac stale projekty `chromium-desktop`, `chromium-tablet`, `chromium-mobile` albo jeden dedicated `layout-smoke` project z viewport matrix.

## Top 10 napraw

1. Naprawic UTF-8/mojibake w aktywnym UI i dodac CI skan mojibake.
2. Zastapic falszywie zielony `test:visual:check` realna matryca screenshotow albo usunac go z release gates.
3. Skalibrowac Stylelint tak, aby wynik byl mozliwy do utrzymania i mial znaczenie release.
4. Naprawic mobile/tablet sidebar drawer, overlay i nawigacje wszystkich glownych tabow.
5. Przebudowac mobile header na kompaktowa siatke ikonowych akcji.
6. Dodac breakpoint `<=1100/1024px` dla Profile i usunac clipping kart.
7. Uporzadkowac Tasks table/commandbar: wewnetrzny scroll, zwijanie akcji, `min-width: 0`.
8. Odskipowac minimalne a11y tests dla Command Palette i focus trap.
9. Utwardzic `.qwen/settings.json` i odswiezyc `AGENTS.md` Known Issues/runtime.
10. Ujednolicic env URL-e dla Playwright, Lighthouse i lokalnego smoke.

## Codex Config Assessment

Repo ma dobra intencje: `AGENTS.md` jest centralnym dokumentem i `.github/copilot-instructions.md` odsyla do niego. To jest zgodne z kierunkiem opisanym w OpenAI Codex docs dla [AGENTS.md](https://developers.openai.com/codex/guides/agents-md). Problemem jest praktyczna egzekucja: lokalny runtime nie zgadza sie z Node 22, `AGENTS.md` zawiera stale Known Issues, a Qwen permissions sa zbyt szerokie.

W repo nie znalazlem katalogu `.codex/`. Dla projektu z wysokim naciskiem na agent safety warto doprecyzowac policy zgodnie z aktualnymi dokumentami Codex: [config basics](https://developers.openai.com/codex/config-basic), [rules](https://developers.openai.com/codex/rules) i real-browser workflow dla UI z [responsive frontend validation](https://developers.openai.com/codex/use-cases/frontend-designs). Nie wymaga to globalnych zmian uzytkownika; wystarczy repo-scoped dokumentacja/policy i usuniecie driftu w istniejacych plikach agentow.

Nie czytalem ani nie drukowalem wartosci `.env`.

## Self-Review

- Screenshoty obejmuja auth/login/register/reset, shell, Studio, Recordings, Calendar, Tasks, People, Profile, Command Palette i Notification Center tam, gdzie flow bylo osiagalne.
- Mobile/tablet coverage nie jest pelne dla wszystkich zakladek, bo sama nawigacja/drawer zawiodla; traktuje to jako P0 finding, nie jako cichy brak danych.
- Problemy P0/P1 sa potwierdzone screenshotami, DOM heuristics albo wynikami testow. Nie przypisuje jednoznacznych root cause tam, gdzie wymagaloby to implementacyjnego debugowania.
- Rekomendacje sa male i zgodne z obecnym design-system kierunkiem: bez szerokiego redesignu, bez zmiany produktu w tym audycie.
- Wyniki trzeba powtorzyc na Node 22 przed finalnym release signoff, bo audyt lokalny poszedl na Node 24.
