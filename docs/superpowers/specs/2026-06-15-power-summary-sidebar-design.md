# Power Summary Sidebar Component — Design Spec

**Date:** 2026-06-15
**Status:** Approved

## Overview

A new sidebar item type (`power_summary`) that displays how many lights and devices are currently active in Home Assistant, organized into user-defined groups. Each group is configured with a domain filter, an optional exclusion list, and a set of states considered "on". The component replaces the need for a hand-crafted Jinja2 template in the Template sidebar item.

## Design Decisions

| Aspect | Decision |
|---|---|
| Layout | Groups with badge (icon + label + entity name or count + numeric badge) |
| Zero state | Groups remain visible but dimmed (opacity ~0.3) — not hidden |
| Active display | Name when count = 1, count when count > 1 |
| On-state selection | Predefined checkboxes (on, playing, heat, cool, fan_only, dry, auto, idle, paused) |
| Entity selection | Filter by domain; optional per-entity exclusion list |

---

## Section 1 — Data Structure

### YAML config example

```yaml
- type: power_summary
  id: 42
  hide_mobile: false
  groups:
    - label: Luci
      icon: mdi:lightbulb
      domains:
        - light
        - switch
      exclude:
        - switch.desktop_power
        - switch.asciugatrice
      on_states:
        - on
      count_suffix: accese

    - label: Dispositivi
      icon: mdi:television
      domains:
        - climate
        - media_player
        - switch
      exclude:
        - switch.soffitto_soggiorno
        - switch.soffitto_cucina
      on_states:
        - on
        - heat
        - cool
        - fan_only
        - playing
        - dry
        - auto
      count_suffix: accesi
```

### PowerSummaryGroup fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `label` | string | no | User-defined group name (e.g. "Luci") |
| `icon` | string | no | Iconify icon ID (e.g. `mdi:lightbulb`) |
| `domains` | string[] | yes | HA domains to include (e.g. `light`, `switch`) |
| `exclude` | string[]? | no | entity_ids to exclude from the domain filter |
| `on_states` | string[] | yes | States considered active (e.g. `on`, `playing`, `heat`) |
| `count_suffix` | string? | no | Text appended to count when >1 (default: empty — user configures in their language) |

### TypeScript interfaces (`src/lib/Types.ts`)

```typescript
export interface PowerSummaryGroup {
  label?: string;
  icon?: string;
  domains?: string[];
  exclude?: string[];
  on_states?: string[];
  count_suffix?: string;
}

export interface PowerSummaryItem {
  type?: string;
  id?: number;
  groups?: PowerSummaryGroup[];
  hide_mobile?: boolean;
}
```

`PowerSummaryItem` is added to the `SidebarItem` union type alongside the existing item types.

---

## Section 2 — Display Component (`src/lib/Sidebar/PowerSummary.svelte`)

### Props

```typescript
export let sel: PowerSummaryItem | undefined = undefined;
export let demo = false;
```

### Reactive logic

For each group, using `$:` reactive statements against `$states`:

1. Collect all entities in `$states` whose `entity_id` starts with `"{domain}."` for each domain in `domains` (same pattern as `entityList` in `Stores.ts`: `key.startsWith(`${domain}.`)`)
2. Filter out any entity_ids listed in `exclude`
3. Filter to those whose `state` is in `on_states`
4. Count the results → `count`

### Rendering per group

| count | Display |
|---|---|
| 0 | Row rendered at opacity ~0.3 (dimmed); no active-entity text |
| 1 | Shows `getName(entity)` — HA friendly name via existing `getName()` util |
| >1 | Shows `"{count} {count_suffix}"` (e.g. "3 accese") |

### Visual structure

```
┌──────────────────────────────────────────┐
│ 💡  LUCI                           [3]   │  full opacity; badge uses theme accent color
│     3 accese                             │
├──────────────────────────────────────────┤
│ 📺  DISPOSITIVI                    [1]   │  full opacity; badge uses theme accent color
│     TV della cucina                      │
├──────────────────────────────────────────┤
│ ❄️  ARIA CONDIZIONATA              [0]   │  dimmed (~0.3 opacity); badge omitted or opacity 0
│     —                                    │
└──────────────────────────────────────────┘
```

Badge color uses the existing `--theme-*` CSS custom properties (same approach as BinarySensor icon color). No hardcoded colors.

### Animation & edit mode

- Uses `$motion` store for opacity transitions (same pattern as Sensor, BinarySensor)
- In `$editMode`: all groups render at full opacity regardless of count (structure always visible)
- `demo = true` (used in config modal preview): renders with hardcoded fake data (one group active, one dimmed)

---

## Section 3 — Config Modal (`src/lib/Modal/PowerSummaryConfig.svelte`)

### Layout

```
┌─ Power Summary ──────────────────────────┐
│  Preview                                 │
│  ┌──────────────────────────────────┐    │
│  │  [live PowerSummary demo]        │    │
│  └──────────────────────────────────┘    │
│                                          │
│  Gruppi                                  │
│  ┌──────────────────────────────────┐    │
│  │  💡 Luci             [✎] [🗑]   │    │
│  │  📺 Dispositivi      [✎] [🗑]   │    │
│  │  [+ Aggiungi gruppo]             │    │
│  └──────────────────────────────────┘    │
│                                          │
│  (expanded group editor)                 │
│  Label      [ Luci              ]        │
│  Icon       [ mdi:lightbulb     ]        │
│  Domains    [✓ light] [✓ switch]         │
│             [ climate] [ media_player]   │
│  Exclude    [ Select entity... ▼ ]       │
│             switch.desktop_power  ✕      │
│  On states  [✓ on] [ playing] [ heat]    │
│             [ cool] [ fan_only] [ dry]   │
│             [ auto] [ idle] [ paused]    │
│  Suffix     [ accese            ]        │
│                                          │
│  Mobile     [Visible] [Hidden]           │
│                                          │
│  [ Delete ]              [ Duplicate ]   │
└──────────────────────────────────────────┘
```

### UX details

- Groups expand/collapse inline (no nested modal)
- **Domains**: clickable pill/chips for the most common HA domains: `light`, `switch`, `climate`, `media_player`, `sensor`, `input_boolean`, `fan`
- **Exclude**: uses the existing `Select` component filtered to entities matching the selected domains; selected entity_ids appear as removable tags (✕)
- **On states**: clickable chips: `on`, `playing`, `heat`, `cool`, `fan_only`, `dry`, `auto`, `idle`, `paused`
- Groups are reorderable via drag-and-drop using `svelte-dnd-action` (already a project dependency)
- Every config change calls `updateObj()` and triggers `$dashboard = $dashboard`; `$record()` is called `onDestroy` (identical pattern to all other config modals)

---

## Section 4 — Integration Points

| File | Operation | What |
|---|---|---|
| `src/lib/Types.ts` | modify | Add `PowerSummaryGroup`, `PowerSummaryItem`; add `PowerSummaryItem` to `SidebarItem` union |
| `src/lib/Sidebar/PowerSummary.svelte` | create | Display component |
| `src/lib/Modal/PowerSummaryConfig.svelte` | create | Config modal |
| `src/lib/Sidebar/Index.svelte` | modify | Add `power_summary` to dynamic imports map and rendering switch |
| `src/lib/Modal/SidebarItemConfig.svelte` | modify | Add `power_summary` to "Change type" menu; open `PowerSummaryConfig` |
| `static/translations/en.json` | modify | Add keys: `power_summary`, `add_group`, `on_states`, `count_suffix`, `domains`, `exclude` |

No new stores. No new server endpoints. The component reads only the existing `$states` store.

---

## Out of Scope

- Clicking a group to toggle entities (view-only component)
- Per-entity custom display names (uses HA friendly name via `getName()`)
- More than the predefined on-state values (no free-text state input)
- Area-based filtering (domain + exclude is sufficient)
