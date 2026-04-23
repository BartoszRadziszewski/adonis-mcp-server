# Szablon dokumentacji procesu biznesowego

> **Plik ten pełni dwie role:**
> 1. **Instrukcja** – jak wypełniać dokumentację procesu
> 2. **Szablon** – gotowy plik do skopiowania i uzupełnienia
>
> Generator BPMN (`generate_bpmn`) czyta pola z tabel i produkuje diagram. Pola oznaczone ⚙️ są wymagane przez generator. Pozostałe służą dokumentacji.
> Autor szablonu Bartosz Radziszewski bartosz.radziszewski@gmail.com (2026-04-23)
> https://github.com/BartoszRadziszewski/adonis-mcp-server

---

## Typy przepływów – co generator obsługuje

| Typ | Składnia pola `Następny` | Efekt w BPMN |
|-----|--------------------------|--------------|
| Liniowy | `S3` lub puste | Task → Task |
| Rozgałęzienie równoległe | `AND → [S3, S7]` | Task → Bramka AND → dwie ścieżki |
| Scalenie równoległe | `(scal AND)` | Dwie ścieżki → Bramka AND → Task |
| Decyzja wykluczająca | `XOR → [Tak: S4, Nie: S6]` | Task → Bramka XOR → gałąź z etykietą |
| Scalenie decyzji | `(scal XOR)` | Gałęzie → Bramka XOR → Task |
| Pętla powrotna | `pętla → S2` | Task → (wstecz) → Task (linia przerywana) |
| Koniec procesu | `(koniec)` | Task → Zdarzenie końcowe |

> **Wskazówka:** Jeśli krok nie ma pola `Następny` lub jest ostatni – generator automatycznie połączy go z kolejnym krokiem lub zdarzeniem końcowym.

---

## Konwencje nazewnictwa pliku

```
{OBSZAR}-{NNN}-{slug-tytulu}-{as-is|to-be}.md

Przykłady:
  OS-001-SENT-wysylka-krajowa-as-is.md
  P2P-003-przyjecie-towaru-to-be.md
  FK-002-obieg-faktury-kosztowej-as-is.md
```

---
---

# {ID} – {Tytuł procesu} ({As-Is | To-Be})

**Obszar:** {np. Ochrona Środowiska / Transport | Finanse / AP | P2P / Zakupy}
**Typ:** As-Is
**Wersja:** v01
**Data udokumentowania:** RRRR-MM-DD
**Właściciel procesu:** {rola / stanowisko, np. Kierownik Działu Transportu}
**Autor dokumentacji:** {Imię Nazwisko, rola}
**Ocena procesu:** {Prosty sekwencyjny | Ustrukturyzowany | Złożony z wyjątkami}
**Status weryfikacji:** Roboczy | Częściowy | Zweryfikowany
**Powiązany proces As-Is/To-Be:** {ID lub „brak"}
**Źródło:** {Notatka ze spotkania z … z RRRR-MM-DD; dokument „…"; obserwacja}

---

## Kontekst i zakres

### Cel procesu
{1–3 zdania: po co ten proces istnieje, jaki problem rozwiązuje lub jaką wartość dostarcza}

### Zakres

**Obejmuje:**
- {Wymień co jest w zakresie – kroki, dokumenty, systemy, działy}
- {…}

**Nie obejmuje:**
- {Co explicite jest poza zakresem – ważne dla uniknięcia niejasności}
- {…}

### Wyzwalacz uruchomienia (start procesu)
{Co powoduje start procesu – np.:
- „Zamówienie klienta zarejestrowane w NAV"
- „Wpływ faktury kosztowej"
- „Harmonogram miesięczny (ostatni dzień roboczy miesiąca)"}

### Wynik / produkt procesu (output)
{Co jest efektem procesu – np. „Zaksięgowana faktura w NAV + potwierdzenie dostawy w aktach"}

---

## Architektura systemów (opcjonalne)

```
{Diagram tekstowy przepływu danych między systemami, np.:}

NAV [Zamówienia/WZ/Faktury]
  → VCS [Zlecenia załadunku]
  → SPEED [Zlecenia transportowe]
  → TX-CONNECT [Monitoring GPS]
  → SENTCloud → PUESC [Zgłoszenie SENT]
```

---

## Kroki procesu

<!--
  INSTRUKCJA DLA GENERATORA BPMN:
  - Każdy krok to blok "### S{numer} – {nazwa}"
  - Numery nie muszą być ciągłe (S1, S2, S5... jest OK)
  - Pole "Obszar" definiuje lane (swimlane) – takie same wartości = ten sam pas
  - Pole "Następny" steruje przepływem (patrz tabela na górze)
  - Pole "Wyzwalacz" (tylko S1) definiuje nazwę zdarzenia startowego
-->

### S1 – {Nazwa pierwszego kroku}

| Atrybut | Wartość |
|---------|---------|
| ⚙️ Obszar | {Nazwa działu lub roli – będzie swimlane w BPMN} |
| ⚙️ Wyzwalacz | {Zdarzenie startowe – tylko dla S1, np. „Zamówienie klienta"} |
| ⚙️ Czynności | {Co się dzieje w tym kroku – krótko, konkretnie} |
| Systemy | {Systemy IT używane: NAV, SPEED, Excel, Outlook…} |
| Przepływ | {Opcjonalnie: System A → System B} |
| Dokumenty | {Dokumenty wejściowe → Dokumenty wyjściowe} |
| ⚙️ Następny | S2 |
| Automatyzacja | Ręczna \| Częściowa \| Automatyczna |
| RACI | O: {odpowiedzialny wykonawca}; K: {konsultowany}; I: {informowany} |
| Uwaga | {Opcjonalna nota, np. „Tylko dla towarów wrażliwych CN 6309"} |

### S2 – {Nazwa drugiego kroku}

| Atrybut | Wartość |
|---------|---------|
| ⚙️ Obszar | {Nazwa działu} |
| ⚙️ Czynności | {Co się dzieje} |
| Systemy | {Systemy IT} |
| Dokumenty | {Dokumenty} |
| ⚙️ Następny | S3 |
| Automatyzacja | Ręczna \| Częściowa \| Automatyczna |
| RACI | O: {…}; K: {…}; I: {…} |

<!-- Powtórz blok dla każdego kolejnego kroku -->

### S3 – {Krok z rozgałęzieniem równoległym (AND)}

| Atrybut | Wartość |
|---------|---------|
| ⚙️ Obszar | {Nazwa działu} |
| ⚙️ Czynności | {Co się dzieje – po tym kroku dwie ścieżki startują równolegle} |
| Systemy | {…} |
| ⚙️ Następny | AND → [S4, S7] |
| Automatyzacja | Częściowa |
| RACI | O: {…} |
| Uwaga | Po tym kroku ścieżka A (S4→S5→S6) i ścieżka B (S7→S8) toczą się równolegle |

### S4 – {Krok w ścieżce A}

| Atrybut | Wartość |
|---------|---------|
| ⚙️ Obszar | {Dział dla ścieżki A} |
| ⚙️ Czynności | {…} |
| ⚙️ Następny | S5 |
| Automatyzacja | Ręczna |
| RACI | O: {…} |

### S5 – {Krok kończący ścieżkę A – scalenie}

| Atrybut | Wartość |
|---------|---------|
| ⚙️ Obszar | {Dział} |
| ⚙️ Czynności | {…} |
| ⚙️ Następny | (scal AND) |
| Automatyzacja | Częściowa |
| RACI | O: {…} |
| Uwaga | Ścieżka A kończy się tutaj i czeka na ścieżkę B |

### S6 – {Krok w ścieżce B}

| Atrybut | Wartość |
|---------|---------|
| ⚙️ Obszar | {Dział dla ścieżki B} |
| ⚙️ Czynności | {…} |
| ⚙️ Następny | (scal AND) |
| Automatyzacja | Automatyczna |
| RACI | O: {…} |
| Uwaga | Ścieżka B kończy się tutaj i czeka na ścieżkę A |

### S7 – {Krok po scaleniu – po bramce AND}

| Atrybut | Wartość |
|---------|---------|
| ⚙️ Obszar | {Dział} |
| ⚙️ Czynności | {Wznowienie po scaleniu obu ścieżek} |
| ⚙️ Następny | S8 |
| Automatyzacja | Ręczna |
| RACI | O: {…} |

### S8 – {Krok z decyzją (XOR)}

| Atrybut | Wartość |
|---------|---------|
| ⚙️ Obszar | {Dział} |
| ⚙️ Czynności | {Po tym kroku następuje decyzja – dwie wykluczające się ścieżki} |
| ⚙️ Następny | XOR → [Zatwierdzona: S9, Odrzucona: S11] |
| Automatyzacja | Ręczna |
| RACI | O: {…}; K: {przełożony} |
| Uwaga | Decyzja na podstawie {kryterium} |

### S9 – {Krok ścieżki „Zatwierdzona"}

| Atrybut | Wartość |
|---------|---------|
| ⚙️ Obszar | {Dział} |
| ⚙️ Czynności | {…} |
| ⚙️ Następny | S10 |
| Automatyzacja | Częściowa |
| RACI | O: {…} |

### S10 – {Krok ze scaleniem decyzji (scal XOR)}

| Atrybut | Wartość |
|---------|---------|
| ⚙️ Obszar | {Dział} |
| ⚙️ Czynności | {Ścieżki łączą się z powrotem} |
| ⚙️ Następny | S13 |
| Automatyzacja | Ręczna |
| RACI | O: {…} |

### S11 – {Krok ścieżki „Odrzucona" – z pętlą}

| Atrybut | Wartość |
|---------|---------|
| ⚙️ Obszar | {Dział} |
| ⚙️ Czynności | {Np. Korekta i ponowne złożenie do zatwierdzenia} |
| ⚙️ Następny | pętla → S8 |
| Automatyzacja | Ręczna |
| RACI | O: {…} |
| Uwaga | Pętla – wraca do kroku S8 po korekcie |

### S12 – {Krok scalający obie ścieżki XOR}

| Atrybut | Wartość |
|---------|---------|
| ⚙️ Obszar | {Dział} |
| ⚙️ Czynności | {…} |
| ⚙️ Następny | (koniec) |
| Automatyzacja | Automatyczna |
| RACI | O: {…} |

---

## Bramki decyzyjne – opis (opcjonalne)

> Sekcja dla dokumentacji ludzkiej – generator BPMN nie czyta tej sekcji.

### AND po S3 – Równoległe: fizyczna wysyłka + rejestracja

**Ścieżka A (fizyczna):** S4 → S5 → (scal AND)
**Ścieżka B (systemowa):** S6 → (scal AND)
**Scalenie w:** S7

Obie ścieżki muszą się zakończyć zanim proces przejdzie do S7.

### XOR po S8 – Zatwierdzenie dokumentu

| Warunek | Ścieżka |
|---------|---------|
| Dokument zatwierdzony | → S9 |
| Dokument odrzucony | → S11 (korekta + pętla do S8) |

---

## Koniec procesu

{Co oznacza koniec procesu – np.
„Koniec następuje gdy wszystkie ścieżki równoległe zakończą się i dokument zostanie zarchiwizowany."
Wyzwalacz zakończenia: {np. potwierdzenie archiwizacji w NAV}}

---

## Ryzyka i luki

| # | Ryzyko / Luka | Obszar | Priorytet |
|---|---------------|--------|-----------|
| 1 | {Opis ryzyka} | {Obszar} | M \| S \| C \| W |
| 2 | | | |

> **Priorytety:** M = Must fix (blokuje ERP), S = Should fix, C = Could fix, W = Won't fix now

---

## Powiązania z innymi procesami

| Typ powiązania | ID procesu | Opis |
|----------------|------------|------|
| Poprzedza | {ID} | {Skrótowy opis} |
| Następuje po | {ID} | {Skrótowy opis} |
| Podproces | {ID} | {Skrótowy opis} |
| Równoległy | {ID} | {Skrótowy opis} |

---

## Historia zmian

| Wersja | Data | Autor | Co zmieniono |
|--------|------|-------|--------------|
| v01 | {RRRR-MM-DD} | {Autor} | Wersja inicjalna |
