# UI_LAYOUT_CHECKLIST

Checklist do review layoutu i zmian wizualnych.

## Spacing i rhythm

- Odstepy miedzy przyciskami sa zgodne z tokenami, bez lokalnych `margin-left: 7px` i podobnych obejsc.
- Sekcje w panelach maja rowny pionowy rytm.
- Grid i split layout maja stale gapy na desktop i mobile.

## Actions i toolbary

- Glowne akcje sa grupowane w jednym miejscu i nie "plywaja" miedzy ekranami.
- Ikonki i tekst w przyciskach sa wycentrowane pionowo.
- Przyciski tej samej rangi maja ten sam rozmiar i wysokosc.

## Panele i naglowki

- Panel ma jednolity padding, promien i border.
- Naglowki stron i paneli maja wspolny uklad: eyebrow, title, description, actions.
- Panele poboczne nie maja innych radius/gap bez swiadomego uzasadnienia.

## Responsive

- Topbar nie lamie sie chaotycznie na szerokosciach tabletowych.
- Sidebar i aside schodza do jednej kolumny przewidywalnie.
- Pola input/select/button sa klikalne i czytelne na mobile.

## Themes i variants

- Kazdy ekran dziala w `dark`, `light` i `beaver`.
- Layout preset `default`, `compact` i `bobr` nie rozbijaja szerokosci i spacingu.
- Zmiana theme/layout nie wymaga specjalnych klas per ekran.

## Regression gates

- Kluczowe ekrany maja smoke visual check.
- Zmiany layoutowe sa weryfikowane przed merge na desktop i przynajmniej jednym waskim breakpointcie.
