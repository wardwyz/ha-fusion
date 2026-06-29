# Developer

Notes for contributors and anyone extending Nova Domus.

---

## Setup

```bash
git clone https://github.com/amedello/ha-fusion.git
cd ha-fusion
pnpm install

cp .env.example .env   # set HASS_URL to your HA instance
pnpm dev               # starts Vite dev server on :5173, proxies /api/ and /local/ to HASS_URL
```

### Commands

```bash
pnpm dev          # dev server with hot reload
pnpm build        # production build → build/
pnpm preview      # preview production build

pnpm check        # svelte-check (type checking)
pnpm check:watch  # type checking in watch mode

pnpm lint         # prettier --check + eslint
pnpm format       # prettier --write
```

There is no test suite. Validate changes with `pnpm check` and `pnpm lint`.

---

## Stack

| Layer            | Technology                                    |
| ---------------- | --------------------------------------------- |
| Framework        | SvelteKit 2 + Svelte 4 + TypeScript 5         |
| Build            | Vite + adapter-node                           |
| Server           | Express + http-proxy-middleware (`server.js`) |
| Styles           | Scoped Svelte CSS + CSS custom properties     |
| Icons            | Iconify (`@iconify/svelte`)                   |
| Drag and drop    | `svelte-dnd-action`                           |
| Modals           | `svelte-modals`                               |
| Dashboard config | `data/dashboard.yaml`                         |
| App config       | `data/configuration.yaml`                     |

---

## Architecture

```
server.js (Express, :5050)
  ├── proxy /api/ + /local/ → HASS_URL
  └── SvelteKit handler
        └── +page.server.ts   (loads YAML files server-side)
              └── +page.svelte (WebSocket auth, renders layout)
                    ├── Main/Index.svelte   (tile grid, DnD)
                    │     └── Content.svelte → routes type → component
                    ├── Sidebar/Index.svelte
                    └── Drawer/Index.svelte (edit mode panel)
```

`server.js` sets `X-Proxy-Target` so `+page.server.ts` can discover the HA URL at runtime (needed in add-on / ingress mode).

---

## State management

All shared state lives in `src/lib/Stores.ts` as Svelte writable/readable/derived stores.

| Store                                 | Purpose                                                         |
| ------------------------------------- | --------------------------------------------------------------- |
| `dashboard`                           | Parsed `dashboard.yaml` — mutated directly for edits            |
| `configuration`                       | Parsed `configuration.yaml`                                     |
| `states`                              | Live HA entity states (WebSocket subscription)                  |
| `editMode`                            | Controls drag-and-drop, configure overlays, drawer              |
| `history` / `historyIndex` / `record` | Client-side undo/redo                                           |
| `lang`                                | Derived function `(key: string) => translated string`           |
| `itemHeight`                          | Computed tile height — use `style:min-height="{$itemHeight}px"` |

---

## WebSocket / HA connection

`src/lib/Socket.ts` — `authentication()` is called from `+page.svelte` on mount and retried every 3 s. Authenticates via long-lived token or OAuth, then subscribes `states`, `config`, and `services`.

---

## Adding a new item type

1. **Add the interface** to `src/lib/Types.ts` and add the type discriminant to the `Item` union.

2. **Create the tile** at `src/lib/Main/MyType.svelte`. Follow the Button.svelte pattern:

   - Accept `export let sel: MyTypeItem`
   - Apply `style:min-height="{$itemHeight}px"` on the root element
   - Use `background-color: var(--theme-button-background-color-off)` for the tile background

3. **Route the type** in `src/lib/Main/Content.svelte` — add a case to the `{#if}` chain.

4. **Create the config modal** at `src/lib/Modal/MyTypeConfig.svelte` (for edit mode).

5. **Add translations** for any new UI strings to `static/translations/en.json`.

---

## Adding a new sidebar item type

Same steps as above but:

- Interface goes into the `SidebarItem` union in `Types.ts`
- Tile lives in `src/lib/Sidebar/`
- Routing is in `src/lib/Sidebar/Index.svelte`
- Config modal goes in `src/lib/Modal/SidebarItemConfig.svelte` (the shared config entry point)

---

## Dashboard mutations

All edit-mode changes must:

1. Call `record` store to push to undo history **before** the mutation
2. Mutate `$dashboard` directly
3. Save via `POST /_api/save_dashboard`

Use `generateId()` from `src/lib/Utils.ts` for all new IDs — IDs must be unique across the whole dashboard. Never hardcode IDs.

Use `updateObj(sel, key, event?)` from `Utils.ts` to mutate config objects in edit forms. Passing `undefined` as the third argument deletes the key.

---

## Translations

All UI strings go through `$lang('key')`. Add new keys to `static/translations/en.json`. Community contributors handle other locales — never add translations to non-English files in the same PR.

---

## Modals

Modals use `svelte-modals` (`openModal` / `closeModal`). The root stack is `src/lib/Modal/Index.svelte`.

- The modal shell provides a `.header` (h1 + close button) and a `.body` (default slot)
- First element in `.body` is typically `<h2>` which gets `margin: 1.3rem 0 0.6rem 0` via `Modal.css`
- Use `size="large"` prop for wide modals (80vw)

---

## Theming

Theme YAML files live in `static/themes/`. The active theme is set via `dashboard.theme`. CSS custom properties are applied by `src/lib/Components/Theme.svelte`.

Key variables:

| Variable                               | Usage                          |
| -------------------------------------- | ------------------------------ |
| `--theme-button-background-color-off`  | Tile background                |
| `--theme-button-name-color-off`        | Tile name text                 |
| `--theme-button-state-color-off`       | Tile state text                |
| `--theme-modal-background-color-modal` | Modal background               |
| `--theme-colors-text`                  | General text color             |
| `--theme-background-image`             | Page background gradient/image |

---

## Add-on vs standalone mode

`ADDON=true` enables ingress-aware proxy logic in `server.js`. In add-on mode the HA URL is derived from request headers at runtime instead of from `HASS_URL`. `HASS_PORT` and `EXPOSED_PORT` control the exposed-port fallback.

---

## Docker

```bash
# development
docker compose -f compose-dev.yml up

# production
docker compose up -d
```

Images are published to `ghcr.io/amedello/nova-domus` via GitHub Actions (`.github/workflows/docker-publish.yml`).
