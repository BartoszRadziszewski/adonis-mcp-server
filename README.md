# adonis-mcp-server

> **Serwer MCP (Model Context Protocol) zbudowany na AdonisJS** – umożliwia modelom AI (np. Claude) wywoływanie własnych narzędzi backendowych przez API HTTP.

---

## Czym jest ten projekt?

**MCP (Model Context Protocol)** to standard komunikacji, dzięki któremu asystent AI (np. Claude w Claude Code) może wywoływać funkcje Twojego serwera tak samo, jak człowiek klika przyciski w aplikacji. Zamiast tylko odpowiadać na pytania, AI może:

- czytać i zapisywać pliki na Twoim komputerze,
- wywoływać skrypty i generować dokumenty,
- integrować się z dowolnym systemem, do którego masz dostęp.

Ten projekt to **gotowy szablon serwera MCP** opartego na frameworku [AdonisJS](https://adonisjs.com/) (Node.js + TypeScript). Zawiera przykładowe narzędzie `generate_bpmn`, które konwertuje pliki Markdown z dokumentacją procesów biznesowych (format BPMN) na pliki XML gotowe do otwarcia w [bpmn.io](https://demo.bpmn.io) lub Camunda Modeler.

---

## Wymagania wstępne

| Narzędzie | Wersja | Po co |
|-----------|--------|-------|
| [Node.js](https://nodejs.org/) | ≥ 22 (LTS) | Środowisko uruchomieniowe serwera |
| npm | ≥ 10 | Zarządzanie pakietami (dołączony z Node.js) |
| [Claude Code](https://claude.ai/download) | najnowsza | Klient AI wywołujący narzędzia MCP |
| Git | dowolna | Pobieranie kodu |

> **Windows:** projekt był tworzony i testowany na Windows 11 z Node.js 24. Działa również na macOS/Linux.

---

## Instalacja krok po kroku

### 1. Pobierz repozytorium

```bash
git clone https://github.com/TWOJ_LOGIN/adonis-mcp-server.git
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

Otwórz `.env` w dowolnym edytorze tekstowym i uzupełnij:

```env
APP_KEY=<wygeneruj_losowy_ciąg_znaków_32+>
MCP_WORKSPACE_ROOT=C:\projects\twoj-projekt   # ścieżka do folderu, z którego narzędzia mają czytać pliki
```

Aby wygenerować `APP_KEY`, uruchom:

```bash
node ace generate:key
```

### 4. Utwórz bazę danych (SQLite, jednorazowo)

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

Powinieneś zobaczyć listę dostępnych narzędzi (`generate_bpmn`, `hello_world`).

---

## Podłączenie do Claude Code

W folderze Twojego projektu (z którego korzysta Claude Code) utwórz plik `.mcp.json`:

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

Po restarcie Claude Code narzędzia MCP będą dostępne – Claude sam zdecyduje kiedy je wywołać, lub możesz poprosić go o to bezpośrednio.

> **Ważne:** serwer (`npm run dev`) musi być uruchomiony, kiedy używasz Claude Code.

---

## Dostępne narzędzia (Tools)

### `generate_bpmn`

Konwertuje plik Markdown z opisem procesu biznesowego na plik BPMN 2.0 XML.

**Format wejściowy Markdown:**

```markdown
# ID-001 – Tytuł procesu

## Kroki procesu

### S1 – Nazwa kroku

| Atrybut | Wartość |
|---------|---------|
| Obszar | Dział XYZ |
| Czynności | Opis czynności |
| Systemy | System A |
| Następny | S2 |
| Wyzwalacz | Zdarzenie inicjujące |
| Dokumenty | Faktura |

### S2 – Kolejny krok
...
```

**Parametry wywołania:**

| Parametr | Typ | Wymagany | Opis |
|----------|-----|----------|------|
| `source_path` | string | ✅ | Ścieżka do pliku `.md` względem `MCP_WORKSPACE_ROOT` |
| `output_path` | string | ❌ | Ścieżka wyjściowa `.bpmn` (domyślnie: `raport/{nazwa}.bpmn`) |

**Przykład w Claude Code:**

> *„Wygeneruj diagram BPMN z pliku procesy/OS-001-proces.md"*

**Wynik:**
- Plik `.bpmn` gotowy do otwarcia w [demo.bpmn.io](https://demo.bpmn.io) lub Camunda Modeler
- Lanes (swimlanes) per obszar organizacyjny
- Tasks per krok procesu, z dokumentacją czynności
- Bramki AND/XOR tam gdzie wykryto słowa kluczowe
- Automatyczny layout diagramu

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

2. Zarejestruj narzędzie w `start/mcp.ts` – dodaj nazwę pliku do tablicy `toolFiles`:

```typescript
const toolFiles = [
  'generate_bpmn_tool',
  'hello_world_tool',
  'moje_narzedzie_tool',  // ← dodaj tutaj
]
```

3. Zrestartuj serwer – narzędzie pojawi się automatycznie.

---

## Struktura projektu

```
adonis-mcp-server/
├── app/
│   └── mcp/
│       └── tools/              ← Twoje narzędzia MCP
│           ├── generate_bpmn_tool.ts
│           └── hello_world_tool.ts
├── start/
│   ├── mcp.ts                  ← Rejestracja narzędzi (dodaj tu nowe)
│   ├── routes.ts               ← Trasa /mcp
│   └── env.ts                  ← Walidacja zmiennych środowiskowych
├── config/
│   └── mcp.ts                  ← Konfiguracja serwera MCP
├── .env.example                ← Szablon konfiguracji (skopiuj do .env)
└── adonisrc.ts                 ← Rejestracja providerów AdonisJS
```

---

## Technologie

| Technologia | Rola |
|-------------|------|
| [AdonisJS 7](https://adonisjs.com/) | Framework HTTP/TypeScript |
| [@jrmc/adonis-mcp](https://github.com/batosai/adonis-mcp) | Integracja protokołu MCP |
| [Node.js 22+](https://nodejs.org/) | Środowisko uruchomieniowe |
| [SQLite](https://www.sqlite.org/) | Baza danych (wbudowana, bez konfiguracji) |
| [VineJS](https://vinejs.dev/) | Walidacja danych wejściowych |

---

## Licencja

MIT
