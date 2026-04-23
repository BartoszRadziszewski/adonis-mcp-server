# CHANGELOG – adonis-mcp-server

Historia zmian projektu. Najnowszy wpis na górze.

---

## 2026-04-23 – Sesja 63: Automatyczny workspace przez nagłówek HTTP

**Commit:** `323448c`

**Co zrobiono:**

- `app/middleware/workspace_context.ts` – `AsyncLocalStorage<string>` singleton; przechowuje aktywny workspace przez czas trwania pojedynczego żądania HTTP
- `app/middleware/workspace_middleware.ts` – odczytuje nagłówek `X-Workspace-Root` z żądania i uruchamia dalsze przetwarzanie w kontekście podanego workspace
- `start/kernel.ts` – `workspace_middleware` zarejestrowany globalnie (`server.use`) – działa dla wszystkich żądań HTTP
- `generate_bpmn_tool.ts` + `set_workspace_tool.ts` – `workspaceStorage.getStore()` dodane jako priorytet 2 w łańcuchu workspace
- `README.md` – pełna dokumentacja automatycznego podejścia (metoda A: nagłówek w `.mcp.json`); zaktualizowana struktura projektu o middleware

**Łańcuch priorytetów workspace (ostateczny):**
```
param workspace_root → X-Workspace-Root header → mcp-workspace.json → MCP_WORKSPACE_ROOT (.env) → błąd
```

**Efekt:** Każdy projekt może mieć własne `.mcp.json` z nagłówkiem `X-Workspace-Root` – jeden serwer obsługuje wiele projektów jednocześnie bez ręcznego przełączania i bez restartu.

---

## 2026-04-23 – Sesja 62b: `set_workspace` tool + multi-project automation

**Commit:** `73741c1`

**Co zrobiono:**

- `app/mcp/tools/set_workspace_tool.ts` – nowe narzędzie MCP:
  - bez argumentu: zwraca aktywny workspace z wszystkich trzech źródeł (nagłówek / plik / .env)
  - z argumentem: zapisuje ścieżkę do `mcp-workspace.json`; zmiana natychmiastowa (bez restartu)
  - eksportuje `readWorkspaceConfig()` do użycia przez inne narzędzia
- `scripts/set-workspace.mjs` – CLI: `npm run workspace -- C:/projects/projekt` (alternatywa terminalowa)
- `package.json` – dodano skrypt `"workspace": "node scripts/set-workspace.mjs"`
- `.gitignore` – dodano `mcp-workspace.json`, `*.sqlite3`, `.adonisjs/`
- `start/mcp.ts` – `set_workspace_tool` zarejestrowane jako pierwsze

---

## 2026-04-23 – Sesja 62a: `workspace_root` param + multi-project support

**Commit:** `775c728`

**Co zrobiono:**

- `generate_bpmn_tool.ts` – dodano parametr `workspace_root` w Schema i `handle()`; priorytet: param → `.env` → błąd
- `.env.example` – dodano `MCP_WORKSPACE_ROOT=`
- Wstępne testy multi-project z ręcznym przekazywaniem ścieżki

---

## 2026-04-23 – Sesja 62: Szablon procesu + ulepszony silnik routingu BPMN

**Commit:** `567f446`

**Co zrobiono:**

- `docs/szablon-procesu.md` – kompletny szablon dokumentacji procesu biznesowego:
  - konwencja pola `Następny` dla wszystkich 7 typów przepływu
  - przykłady kroków S1–S12 z bramkami AND/XOR, pętlą i zakończeniem
  - sekcje: metadane, kontekst, architektura systemów, kroki, ryzyka, historia
- `generate_bpmn_tool.ts` – przepisany silnik routingu:
  - `parseNextField()` – parser pola `Następny`: AND split, XOR split (z etykietami), AND/XOR merge, pętla, koniec, linear
  - poprawiony regex dla kroków: `### (S\d+)([^\n]*)\n` + ekstrakcja nazwy przez split na `–`
  - grupowanie merge-gatewayów z kolejnych kroków `(scal AND/XOR)`
  - layout pętli: łuk poniżej zadań z `loopY = max(sy, ty) + 60`
  - swimlanes (lanes) per `Obszar` organizacyjny

---

## 2026-04-22 – Sesja 62 init: Initial commit – AdonisJS MCP server z generate_bpmn

**Commit:** `e642398`

**Co zrobiono:**

- Inicjalizacja projektu AdonisJS 7 + TypeScript
- `@jrmc/adonis-mcp` v1.0.1 – integracja protokołu MCP
- `app/mcp/tools/generate_bpmn_tool.ts` – pierwsze narzędzie: konwertuje `.md` → BPMN 2.0 XML
- `app/mcp/tools/hello_world_tool.ts` – narzędzie testowe
- `start/mcp.ts` – ręczna rejestracja narzędzi (preload)
- `start/routes.ts` – trasa `/mcp`
- Podstawowy layout BPMN z swimlanes
