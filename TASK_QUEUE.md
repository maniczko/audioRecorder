# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

## 001. Globalne wyszukiwanie i command palette
Status: `done`
Priorytet: `P1`
Cel: przyspieszyc poruszanie sie po aplikacji i dostep do najczesciej uzywanych obiektow.
Akceptacja:
- `Ctrl+K` lub `Cmd+K` otwiera palette z wyszukiwaniem.
- mozna wyszukac zakladki, spotkania, zadania i osoby.
- wybor wyniku otwiera odpowiedni widok i zaznacza obiekt.
- palette zamyka sie `Esc` i po wyborze wyniku.
Wynik:
- wdrozone w UI wraz z testem integracyjnym.

## 002. Autosave draftow spotkan i przywracanie po odswiezeniu
Status: `done`
Priorytet: `P1`
Cel: ograniczyc utrate danych przy odswiezeniu strony lub przypadkowym wyjsciu.
Akceptacja:
- formularz briefu spotkania zapisuje draft automatycznie.
- po odswiezeniu draft wraca dla biezacego workspace.
- uzytkownik moze wyczyscic draft recznie.
Wynik:
- wdrozone autosave per workspace, restore po odswiezeniu i reczne czyszczenie draftu w Studio.

Nastepny do realizacji: `005. Upload queue i retry dla audio`

## 003. Centrum powiadomien i browser notifications
Status: `done`
Priorytet: `P1`
Cel: poprawic obsluge terminow, przypomnien i taskow po SLA.
Akceptacja:
- jest panel powiadomien w aplikacji.
- przypomnienia o zadaniach i spotkaniach trafiaja do panelu.
- po zgodzie przegladarki pojawiaja sie browser notifications.
Wynik:
- dodane centrum powiadomien w topbarze, alerty o przypomnieniach i SLA oraz browser notifications po zgodzie.

## 004. Aktywnosc workspace i realtime feed
Status: `done`
Priorytet: `P1`
Cel: lepiej pokazac prace zespolowa i zmiany bez recznego odswiezania.
Akceptacja:
- widac feed: kto dodal komentarz, task, spotkanie lub zmienil status.
- feed odswieza sie automatycznie w trybie `remote`.
- przy taskach i spotkaniach widac ostatnia aktywnosc.
Wynik:
- dodany feed aktywnosci workspace, ostatnia aktywnosc przy spotkaniach i zadaniach oraz test helpera aktywnosci.

## 005. Upload queue i retry dla audio
Status: `todo`
Priorytet: `P1`
Cel: zwiekszyc niezawodnosc nagran i transkrypcji.
Akceptacja:
- nagrania maja status `queued / uploading / processing / failed / done`.
- nieudany upload mozna ponowic jednym kliknieciem.
- kolejka nie gubi nagran po chwilowej utracie sieci.

## 006. Waveform i timeline review dla transkrypcji
Status: `todo`
Priorytet: `P2`
Cel: ulatwic review segmentow i prace na nagraniu.
Akceptacja:
- widac waveform lub os czasu nagrania.
- klik w segment przewija i odtwarza odpowiedni moment.
- mozna zaznaczac zakres audio i przypisac speakera.

## 007. Rozbudowane role i uprawnienia workspace
Status: `todo`
Priorytet: `P2`
Cel: lepiej przygotowac produkt do pracy kilku osob na jednym workspace.
Akceptacja:
- role `owner / admin / member / viewer` maja rozne uprawnienia.
- UI pokazuje, kto moze edytowac, usuwac i eksportowac.
- owner moze zarzadzac rolami z poziomu aplikacji.

## 008. Dashboard KPI dla spotkan i zadan
Status: `todo`
Priorytet: `P2`
Cel: dac szybszy wglad w skutecznosc spotkan i follow-upow.
Akceptacja:
- widac liczbe decyzji, otwartych taskow, overdue i taskow po spotkaniach.
- dashboard filtruje po workspace i zakresie dat.
- widok pokazuje trendy tygodniowe lub miesieczne.

## 009. Lepsza wersja mobilna i PWA
Status: `todo`
Priorytet: `P2`
Cel: poprawic wygode pracy na telefonie i tabletach.
Akceptacja:
- glowne widoki sa responsywne na mobile.
- aplikacja ma sensowny `manifest` i da sie zainstalowac.
- najwazniejsze akcje sa dostepne bez poziomego scrolla.

## 010. Pelny live sync z Google Calendar i Google Tasks
Status: `todo`
Priorytet: `P3`
Cel: domknac integracje z Google bez recznego przepinania zmian.
Akceptacja:
- zmiany lokalne synchronizuja sie do Google automatycznie.
- zmiany z Google sa odswiezane bez recznego klikania.
- widac status ostatniej synchronizacji i konflikty danych.
