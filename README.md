# adonis-mcp-server

> **Serwer MCP (Model Context Protocol) zbudowany na AdonisJS** – umożliwia modelom AI (np. Claude) wywoływanie własnych narzędzi backendowych przez API HTTP.

---

## Czym jest ten projekt?

**MCP (Model Context Protocol)** to standard komunikacji, dzięki któremu asystent AI (np. Claude w Claude Code) może wywoływać funkcje Twojego serwera tak samo, jak człowiek klika przyciski w aplikacji. Zamiast tylko odpowiadać na pytania, AI może:

- czytać i zapisywać pliki na Twoim komputerze,
- wywoływać skrypty i generować dokumenty,
- integrować się z dowolnym systemem, do którego masz dostęp.

Ten projekt to **gotowy szablon serwera MCP** opartego na frameworku [AdonisJS](https://adonisjs.com/) (Node.js + TypeScript). Zawiera narzędzia do pracy z dokumentacją procesów biznesowych:

- **`generate_bpmn`** – konwertuje plik Markdown z opisem procesu na diagram BPMN 2.0 XML
- **`set_workspace`** – ustawia aktywny projekt bez restartu serwera

---

## Wymagania wstępne

| Narzędzie | Wersja | Po co |
|-----------|--------|-------|
| [Node.js](https://nodejs.org/) | ≥ 22 (LTS) | Środowisko uruchomieniowe serwera |
| npm | ≥ 10 | Zarządzanie pakietami (dołączony z Node.js) |
| [Claude Code](https://claude.ai/download) | najnowsza | Klient AI wywołujący narzędzia MCP |
| Git | dowolna | Pobieranie kodu |

> **Windows:** projekt był tworzony i testowany na Windows 11 z Node.js 24.

---

## Instalacja krok po kroku

### 1. Pobierz repozytorium

```bash
git clone https://github.com/BartoszRadziszewski/adonis-mcp-server.git
cd adonis-mcp-server
```

### 2. Zainstaluj zależności

```bash
npm install
```

### 3. Skonfiguruj zmienne środowiskowe

Skopiuj plik przykładowy:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# macOS/Linux
cp .env.example .env
```

Otwórz `.env` i uzupełnij `APP_KEY`:

```env
APP_KEY=<wygeneruj_losowy_ciąg_znaków_32+>
```

Wygeneruj klucz:

```bash
node ace generate:key
```

> `MCP_WORKSPACE_ROOT` jest opcjonalne – zamiast tego użyj `set_workspace` (opisane niżej).

### 4. Utwórz bazę danych (jednorazowo)

```bash
node ace migration:run
```

### 5. Uruchom serwer

```bash
npm run dev
```

Serwer nasłuchuje pod adresem: `http://localhost:3333`

Sprawdź czy działa:

```bash
curl -s -X POST http://localhost:3333/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

---

## Podłączenie projektu do serwera

W każdym projekcie, z którym chcesz używać serwera MCP, dodaj plik `.mcp.json`:

```json
{
  "mcpServers": {
    "adonis-mcp-server": {
      "type": "http",
      "url": "http://localhost:3333/mcp"
    }
  }
}
```

Po restarcie Claude Code narzędzia MCP będą dostępne.

> **Ważne:** serwer (`npm run dev`) musi być uruchomiony.

---

## Zarządzanie aktywnymi projektami (workspace)

Jeden serwer obsługuje dowolną liczbę projektów. Narzędzia wiedzą, skąd czytać i gdzie zapisywać pliki dzięki **aktywnemu workspace**.

### Jak działa priorytet workspace

Każde wywołanie narzędzia szuka ścieżki projektu w następującej kolejności:

```
1. parametr workspace_root w wywołaniu  (najwyższy priorytet)
        ↓ nie podano
2. mcp-workspace.json                   (ustawiony przez set_workspace lub npm run workspace)
        ↓ plik nie istnieje
3. MCP_WORKSPACE_ROOT w .env            (fallback startowy)
        ↓ brak
4. błąd – workspace nie ustawiony
```

### Metoda 1 – przez Claude Code (zalecana)

Na początku pracy z projektem powiedz Claude:

> *„Ustaw workspace na C:/projects/moj-projekt"*

Claude wywoła `set_workspace` – zmiana jest **natychmiastowa**, serwer nie wymaga restartu.

Sprawdź aktualny workspace:

> *„Jaki mam teraz aktywny workspace?"*

### Metoda 2 – przez terminal (npm script)

```bash
# Ustaw aktywny projekt
npm run workspace -- C:/projects/moj-projekt

# Sprawdź aktualnie ustawiony workspace
npm run workspace
```

Przykładowy wynik:

```
✅ MCP workspace ustawiony na: C:\projects\moj-projekt
   Zapisano do: mcp-workspace.json
   Serwer nie wymaga restartu – zmiana aktywna natychmiast.
```

### Metoda 3 – parametr przy każdym wywołaniu

Możesz też podać ścieżkę bezpośrednio:

> *„Wygeneruj BPMN z C:/projects/inny-projekt/procesy/P2P-001.md"*

Claude przekaże `workspace_root` jako parametr do narzędzia.

### Jak wygląda typowy przepływ pracy

```
Rano – przełączasz się na projekt A:
  npm run workspace -- C:/projects/projekt-A
  (lub poproś Claude: "ustaw workspace projekt-A")

Pracujesz cały dzień:
  Claude generuje BPMN, czyta pliki – wszystko z projekt-A

Wieczór – przełączasz się na projekt B:
  npm run workspace -- C:/projects/projekt-B

Następnego dnia – sprawdzasz gdzie jesteś:
  npm run workspace      (bez argumentu → wyświetla aktualny)
```

> **Plik `mcp-workspace.json`** jest ignorowany przez git (`.gitignore`) – to Twoje lokalne ustawienie, nie jest wersjonowane.

---

## Dostępne narzędzia (Tools)

### `set_workspace`

Ustawia aktywny katalog projektu dla wszystkich pozostałych narzędzi.

| Parametr | Typ | Wymagany | Opis |
|----------|-----|----------|------|
| `workspace_root` | string | ❌ | Ścieżka do projektu. Pomiń – zwróci aktualny workspace. |

**Przykłady w Claude Code:**
> *„Ustaw workspace na C:/projects/moj-projekt"*
> *„Jaki mam aktualnie ustawiony workspace?"*

---

### `generate_bpmn`

Konwertuje plik Markdown z opisem procesu biznesowego na plik BPMN 2.0 XML.

**Format wejściowy** – plik `.md` wg szablonu z `docs/szablon-procesu.md`:

```markdown
# ID-001 – Tytuł procesu (As-Is)

**Typ:** As-Is
**Data udokumentowania:** 2026-01-15

## Kroki procesu

### S1 – Nazwa kroku
| Atrybut   | Wartość              |
|-----------|----------------------|
| Obszar    | Dział Sprzedaży      |
| Wyzwalacz | Zamówienie klienta   |
| Czynności | Opis co się dzieje   |
| Następny  | S2                   |

### S2 – Kolejny krok
...
```

Pełny szablon z opisem wszystkich typów przepływu: [`docs/szablon-procesu.md`](docs/szablon-procesu.md)

**Parametry:**

| Parametr | Typ | Wymagany | Opis |
|----------|-----|----------|------|
| `source_path` | string | ✅ | Ścieżka do `.md` względem workspace |
| `output_path` | string | ❌ | Ścieżka wyjściowa `.bpmn` (domyślnie: `raport/{nazwa}.bpmn`) |
| `workspace_root` | string | ❌ | Nadpisuje aktywny workspace dla tego wywołania |

**Obsługiwane typy przepływów:**

| Pole `Następny` | Efekt w BPMN |
|----------------|--------------|
| `S3` lub puste | Prosty przepływ task → task |
| `AND → [S3, S7]` | Bramka AND – dwie równoległe ścieżki |
| `(scal AND)` | Scalenie ścieżek równoległych |
| `XOR → [Tak: S4, Nie: S6]` | Bramka XOR – decyzja z etykietami |
| `(scal XOR)` | Scalenie po decyzji |
| `pętla → S2` | Pętla powrotna |
| `(koniec)` | Bezpośrednie zakończenie procesu |

**Wynik:**
- Plik `.bpmn` gotowy do otwarcia w [demo.bpmn.io](https://demo.bpmn.io) lub Camunda Modeler
- Swimlanes (lanes) per obszar organizacyjny
- Tasks z dokumentacją czynności
- Bramki AND/XOR z poprawnym routingiem i etykietami
- Automatyczny layout diagramu

---

### `hello_world`

Narzędzie testowe. Zwraca `Hello, {name}`.

---

## Dodawanie własnych narzędzi

1. Utwórz plik `app/mcp/tools/moje_narzedzie_tool.ts`:

```typescript
import type { ToolContext } from '@jrmc/adonis-mcp/types/context'
import type { BaseSchema } from '@jrmc/adonis-mcp/types/method'
import { Tool } from '@jrmc/adonis-mcp'

type Schema = BaseSchema<{
  input: { type: 'string' }
}>

export default class MojeNarzedzieTool extends Tool<Schema> {
  name = 'moje_narzedzie'
  title = 'Moje narzędzie'
  description = 'Co robi to narzędzie – opis dla AI'

  async handle({ args, response }: ToolContext<Schema>) {
    return response.text(`Wynik: ${args?.input}`)
  }

  schema() {
    return {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Opis parametru' },
      },
      required: ['input'],
    } as Schema
  }
}
```

2. Zarejestruj w `start/mcp.ts`:

```typescript
const toolFiles = [
  'set_workspace_tool',
  'generate_bpmn_tool',
  'hello_world_tool',
  'moje_narzedzie_tool',  // ← dodaj tutaj
]
```

3. Serwer przeładuje się automatycznie (HMR).

---

## Struktura projektu

```
adonis-mcp-server/
├── app/
│   └── mcp/
│       └── tools/
│           ├── set_workspace_tool.ts   ← zarządzanie aktywnym projektem
│           ├── generate_bpmn_tool.ts   ← generator BPMN z Markdown
│           └── hello_world_tool.ts     ← przykład / test
├── scripts/
│   └── set-workspace.mjs              ← CLI: npm run workspace -- <ścieżka>
├── docs/
│   └── szablon-procesu.md             ← szablon dokumentacji procesu
├── start/
│   ├── mcp.ts                         ← rejestracja narzędzi
│   ├── routes.ts                      ← trasa /mcp
│   └── env.ts                         ← walidacja zmiennych środowiskowych
├── mcp-workspace.json                 ← aktywny workspace (gitignored)
├── .env.example                       ← szablon konfiguracji
└── adonisrc.ts                        ← rejestracja providerów AdonisJS
```

---

## Technologie

| Technologia | Rola |
|-------------|------|
| [AdonisJS 7](https://adonisjs.com/) | Framework HTTP/TypeScript |
| [@jrmc/adonis-mcp](https://github.com/batosai/adonis-mcp) | Integracja protokołu MCP |
| [Node.js 22+](https://nodejs.org/) | Środowisko uruchomieniowe |
| [SQLite](https://www.sqlite.org/) | Baza danych (wbudowana) |
| [VineJS](https://vinejs.dev/) | Walidacja danych wejściowych |

---

## Licencja

MIT
