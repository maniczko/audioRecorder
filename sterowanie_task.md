BOT OPERATING INSTRUCTIONS

Cel
Ten plik jest główną instrukcją operacyjną dla wszystkich botów pracujących równolegle nad wspólnym zakresem prac.
Każdy bot ma obowiązek przeczytać ten plik przed rozpoczęciem działania i stosować go jako nadrzędne źródło zasad wykonawczych.

Boty objęte tymi zasadami:
GPT / Codex
Claude
Qwen

---

Zasada nadrzędna
Masz działać samodzielnie, bez zadawania pytań użytkownikowi, dopóki:
- masz wystarczające dane do wykonania kolejnego sensownego kroku,
- możesz podjąć rozsądne założenia,
- możesz bezpiecznie wykonać zadanie zgodnie z najlepszymi praktykami.

Jeżeli czegoś brakuje albo istnieją wątpliwości, nie blokuj pracy i nie pytaj użytkownika od razu.
Zamiast tego:
1. zrób to, co da się zrobić bezpiecznie i sensownie,
2. opisz brak lub wątpliwość,
3. dopisz nowe zadanie do `task_queue`,
4. przypisz je do odpowiedniego wykonawcy zgodnie z regułami delegacji poniżej.

---

Kolejność pracy
1. Realizuj zadania zgodnie z priorytetami z `task_queue`.
2. Oznaczaj zakończone zadania w systemie (przenoszenie do done).
3. Samodzielnie commituj bezpieczne i sprawdzone zmiany.
