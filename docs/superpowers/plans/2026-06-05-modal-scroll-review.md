# Modal Scroll & Layout Review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix scroll, layout, and spacing issues across all ha-fusion modals — sticky header and footer, proper flex scroll in the body, and per-modal visual corrections at QHD (2560×1440) and tablet (768×1024).

**Architecture:** The root cause is `display: block` in `Index.svelte` that disables `flex-direction: column`, making the entire modal (header + content) scroll together. Fix: `display: flex` + a `.body` wrapper with `overflow-y: auto; flex: 1; min-height: 0`. Phase 1 fixes the global container and makes ConfigButtons sticky; Phases 2–4 audit and fix per-modal layout issues revealed after the global fix.

**Tech Stack:** SvelteKit 4, Svelte 4, TypeScript — no test suite; validate with `pnpm check` (type check) + `pnpm lint` + visual inspection in the browser at multiple resolutions.

**Spec:** `docs/superpowers/specs/2026-06-05-modal-scroll-review-design.md`

---

## File Map

| File | Change |
|------|--------|
| `src/lib/Modal/Index.svelte` | Fix `display: flex`, add `.body` wrapper, move scroll |
| `src/lib/Modal/ConfigButtons.svelte` | Sticky bottom footer |
| `src/lib/Modal/CalendarModal.svelte` | Replace `height: 75vh` with `height: 100%` |
| `src/lib/Modal/DeviceTrackerModal.svelte` | Replace `height: 75vh` with `height: 100%` |
| `src/lib/Modal/AiAssistantModal.svelte` | Replace `height: 60vh` with `min-height` + `flex: 1` |
| Various config + entity modals | Visual audit, fix spacing/height as found |

---

## Task 1: Fix Index.svelte — Global Flex Container

**Files:**
- Modify: `src/lib/Modal/Index.svelte`

- [ ] **Step 1: Update the CSS for `.contents`**

  In `Index.svelte`, find the `.contents` style block (around line 248) and apply:

  ```css
  .contents {
      padding: 1.6rem 1.9rem 1.9rem 1.9rem;
      background-color: var(--theme-modal-background-color-modal);
      display: flex;           /* was: display: block */
      flex-direction: column;  /* now has effect */
      pointer-events: auto;
      max-height: 85vh;
      max-width: 85vw;
      border-radius: 1.2rem;
      position: relative;
      box-shadow: rgba(0, 0, 0, 0.56) 0px 22px 70px 4px;
      outline: 1px solid rgba(255, 255, 255, 0.25);
      overflow: hidden;        /* was: overflow-y: auto */
  }
  ```

- [ ] **Step 2: Add the `.body` CSS class**

  Immediately after the `.contents` block, add:

  ```css
  .body {
      overflow-y: auto;
      flex: 1;
      min-height: 0;
  }
  ```

- [ ] **Step 3: Wrap `<slot />` in `.body` in the template**

  In the template section (around line 207), change:

  ```svelte
  			<slot />
  		</div>
  	</div>
  </div>
  ```

  To:

  ```svelte
  			<div class="body">
  				<slot />
  			</div>
  		</div>
  	</div>
  </div>
  ```

- [ ] **Step 4: Run type check**

  ```bash
  pnpm check
  ```

  Expected: no new errors.

- [ ] **Step 5: Visual smoke-test**

  Start the dev server (`pnpm dev`) and open any modal (e.g. a Button config in edit mode). Confirm:
  - Modal title and ✕ button remain visible while scrolling
  - Content scrolls inside the body area
  - No visual regressions in the modal header

---

## Task 2: Fix ConfigButtons.svelte — Sticky Footer

**Files:**
- Modify: `src/lib/Modal/ConfigButtons.svelte`

- [ ] **Step 1: Update the `.container` style**

  In `ConfigButtons.svelte`, replace the `.container` style block (around line 131):

  ```css
  /* before */
  .container {
      display: flex;
      justify-content: space-between;
      margin-top: 2.37rem;
  }
  ```

  With:

  ```css
  .container {
      display: flex;
      justify-content: space-between;
      position: sticky;
      bottom: 0;
      background: var(--theme-modal-background-color-modal);
      padding-top: 0.8rem;
      margin-top: 1.6rem;
      z-index: 1;
  }
  ```

- [ ] **Step 2: Visual verification**

  Open a config modal with many fields (e.g. ButtonConfig — it has icon, name, entity, tap_action, hold_action, double_tap_action sections). Scroll down and confirm the Done / Rimuovi / Cambia tipo buttons remain pinned at the bottom of the modal.

- [ ] **Step 3: Run type check and lint**

  ```bash
  pnpm check && pnpm lint
  ```

  Expected: no errors.

- [ ] **Step 4: Commit Phase 1**

  ```bash
  git add src/lib/Modal/Index.svelte src/lib/Modal/ConfigButtons.svelte
  git commit -m "fix: modal flex layout — sticky header, scrollable body, sticky config buttons"
  ```

---

## Task 3: Fix CalendarModal — Map/Calendar Height

**Files:**
- Modify: `src/lib/Modal/CalendarModal.svelte`

**Context:** CalendarModal uses `size="large"` and has a top-level container with `height: 75vh`. After the Phase 1 fix, this container lives inside `.body`. Since `.body` height ≈ `modal max-height - header - padding` ≈ `75vh - ~6.5rem`, a `height: 75vh` child overflows `.body` and triggers unwanted scroll. Fix: use `height: 100%` to fill the available body space.

- [ ] **Step 1: Change `height: 75vh` to `calc(75vh - 8rem)`**

  In `CalendarModal.svelte`, the style block (line ~194) has a plain `div` rule:

  ```css
  /* before */
  div {
      height: 75vh;
      margin-top: 1rem;
  }
  ```

  Change the height value:

  ```css
  div {
      height: calc(75vh - 8rem);
      margin-top: 1rem;
  }
  ```

  The `8rem` offset accounts for the modal header (~2.5rem) and vertical padding (~3.5rem QHD / ~3.5rem default) across all breakpoints.

- [ ] **Step 2: Visual verification**

  Open the Calendar modal at 2560×1440 and 768×1024. Confirm:
  - Calendar fills the modal body with no extra empty space below
  - No scroll in the modal body (the calendar itself handles month/week navigation)
  - Month/week/day navigation works as before

- [ ] **Step 4: Commit**

  ```bash
  git add src/lib/Modal/CalendarModal.svelte
  git commit -m "fix: CalendarModal height fills flex body instead of fixed 75vh"
  ```

---

## Task 4: Fix DeviceTrackerModal — Map Height

**Files:**
- Modify: `src/lib/Modal/DeviceTrackerModal.svelte`

**Context:** Same issue as CalendarModal — `height: 75vh` inside `.body` overflows. The map container also has children set to `height: 100%` (MapLibre container) that depend on the parent having a defined height.

- [ ] **Step 1: Change `height: 75vh` to `calc(75vh - 8rem)`**

  In `DeviceTrackerModal.svelte`, the selector is `.container` (line ~396):

  ```css
  /* before */
  .container {
      width: 100%;
      height: 75vh;
      border-radius: 0.6rem;
      font-family: inherit;
      margin-top: 1rem;
  }
  ```

  Change:

  ```css
  .container {
      width: 100%;
      height: calc(75vh - 8rem);
      border-radius: 0.6rem;
      font-family: inherit;
      margin-top: 1rem;
  }
  ```

- [ ] **Step 2: Visual verification**

  Open a DeviceTracker entity modal at 2560×1440 and 768×1024. Confirm:
  - MapLibre map renders correctly (not blank)
  - Map fills the modal body area without overflowing
  - Map is interactive (pan, zoom work)
  - No overflow scroll in the modal body

- [ ] **Step 3: If MapLibre renders blank**

  MapLibre reads the container's pixel height on init. If the map is blank, force a resize after mount. Read the existing `onMount` in `DeviceTrackerModal.svelte` — there may already be a `map.resize()` call. If not, add:

  ```svelte
  // inside onMount, after map initialization
  setTimeout(() => map?.resize(), 50);
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add src/lib/Modal/DeviceTrackerModal.svelte
  git commit -m "fix: DeviceTrackerModal map height fills flex body"
  ```

---

## Task 5: Fix AiAssistantModal — Chat Container Height

**Files:**
- Modify: `src/lib/Modal/AiAssistantModal.svelte`

**Context:** `.chat-container` has `height: 60vh; min-height: 320px`. After Phase 1, `.body` height at QHD ≈ 974px and `60vh` ≈ 864px — the chat fits. However, on screens where `60vh > body height`, the container overflows and causes double scroll. The fix makes the chat container fill available body space responsively.

- [ ] **Step 1: Change `.chat-container` to use flex fill**

  In `AiAssistantModal.svelte`, find the `.chat-container` style around line 323:

  ```css
  /* before */
  .chat-container {
      display: flex;
      flex-direction: column;
      height: 60vh;
      min-height: 320px;
  }
  ```

  Replace with:

  ```css
  .chat-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 320px;
  }
  ```

- [ ] **Step 2: Visual verification**

  Open the AI Assistant modal at 2560×1440 and 768×1024. Confirm:
  - Messages area fills the modal body
  - Input bar (microphone + text input + send) remains pinned at the bottom of the chat container
  - `afterUpdate` scroll-to-bottom still works (the `messagesEl.scrollTop = messagesEl.scrollHeight` call is unchanged)
  - No double scrollbar (only the messages area scrolls internally)

- [ ] **Step 3: If `height: 100%` leaves a too-small chat on short viewports**

  Add a responsive min-height via media query at the bottom of AiAssistantModal's `<style>`:

  ```css
  @media (max-height: 600px) {
      .chat-container {
          min-height: 260px;
      }
  }
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add src/lib/Modal/AiAssistantModal.svelte
  git commit -m "fix: AiAssistantModal chat container fills modal body height"
  ```

---

## Task 6: Audit Config Modals — Priority High

**Files:**
- Modify if needed: `src/lib/Modal/MainItemConfig.svelte`, `src/lib/Modal/SidebarItemConfig.svelte`, `src/lib/Modal/VisibilityConfig/Index.svelte`, `src/lib/Modal/CustomPanelConfig.svelte`

Start the dev server and set browser to 2560×1440, then 768×1024. Open each modal in edit mode and record issues.

- [ ] **Step 1: Check MainItemConfig and SidebarItemConfig**

  Open an entity tile's config modal (any button/sensor tile → configure → change type to see entity list). The entity picker list uses `height: 10rem; overflow: auto` (MainItemConfig line 250) with responsive variants up to `12.5rem` at larger breakpoints.

  Expected behavior after Phase 1: the list is intentionally limited-height and scrolls independently — this is correct. Verify it still looks right.

  If the list appears cramped at QHD (font is large, items cut off), increase the heights in the responsive media queries:

  ```css
  /* in MainItemConfig.svelte AND SidebarItemConfig.svelte */
  @media (min-width: 1920px) {
      .list { height: 14rem; }  /* was 12.5rem */
  }
  ```

  Only apply if visually needed.

- [ ] **Step 2: Check VisibilityConfig**

  Open any tile config → Visibility tab. The condition builder uses `min-height: 8.6rem`. Verify conditions display correctly and no content is clipped at QHD. No code change expected unless content is visually broken.

- [ ] **Step 3: Check CustomPanelConfig**

  Open a Custom Panel tile config. It has `min-height: 22rem; overflow: visible` (the `overflow: visible` is required for the Select dropdowns to escape the modal context — do not change it).

  Verify the modal doesn't look excessively tall at QHD (22rem = ~352px minimum). If it does, reduce to `min-height: 18rem` — the rows will expand it naturally.

- [ ] **Step 4: Commit any changes found**

  ```bash
  git add src/lib/Modal/MainItemConfig.svelte src/lib/Modal/SidebarItemConfig.svelte \
    src/lib/Modal/VisibilityConfig/Index.svelte src/lib/Modal/CustomPanelConfig.svelte
  git commit -m "fix: config modal height and spacing adjustments for QHD"
  ```

  If no changes were needed, skip this commit.

---

## Task 7: Audit Config Modals — Normal Priority

**Files:**
- Modify if needed: all remaining `src/lib/Modal/*Config.svelte` files

Open each config modal in edit mode at 2560×1440 and 768×1024. Apply the fixes below when issues are found.

- [ ] **Step 1: Open and check each modal**

  Config modals to audit (open in edit mode by clicking configure on a matching tile):

  | Modal | How to open |
  |-------|-------------|
  | ButtonConfig | Button tile → configure |
  | BinarySensorConfig | Binary sensor tile → configure |
  | CameraConfig | Camera tile → configure |
  | CodeConfig | Code tile → configure |
  | BarConfig | Sidebar bar item → configure |
  | GraphConfig | Sidebar graph item → configure |
  | HistoryConfig | Sidebar history item → configure |
  | SensorConfig | Sensor tile → configure |
  | TemplateConfig | Template item → configure |
  | ThemeEditor | Dashboard settings → Theme |
  | AppearanceConfig | Dashboard settings → Appearance |
  | ViewConfig | View settings (gear icon on view tab) |
  | WeatherConfig | Weather tile → configure |
  | NavigateConfig | Navigate tile → configure |
  | IframeConfig | Iframe tile → configure |
  | ImageConfig | Image tile → configure |
  | DateConfig | Sidebar date item → configure |
  | TimeConfig | Sidebar time item → configure |
  | AiAssistantConfig | AI Assistant tile → configure |
  | DoorbellConfig | Doorbell tile → configure |
  | RadialConfig | Sidebar radial item → configure |

- [ ] **Step 2: Apply common fixes as found**

  **If a modal scrolls unnecessarily** (has scrollbar but content fits): look for a fixed `height` on an internal container. Change it to `min-height` or remove it.

  **If content is visually cramped at QHD**: increase `padding` or `gap` values by 20–30%.

  **If spacing looks broken**: check for `margin-top` values that depend on the old `overflow-y: auto` scroll behavior of `.contents` and adjust.

- [ ] **Step 3: Commit batch of fixes**

  ```bash
  git add src/lib/Modal/
  git commit -m "fix: config modal layout audit — spacing and overflow corrections"
  ```

---

## Task 8: Audit Entity Detail Modals

**Files:**
- Modify if needed: all `src/lib/Modal/*Modal.svelte` files (except AiAssistantModal, CalendarModal, DeviceTrackerModal — already done)

Open each entity modal in the live dashboard (click on an entity tile in view mode). Test at 2560×1440 and 768×1024.

- [ ] **Step 1: Check control modals**

  | Modal | Entity type |
  |-------|-------------|
  | LightModal | Any light entity |
  | ClimateModal | Any climate entity |
  | FanModal | Any fan entity |
  | CoverModal | Any cover entity |
  | LockModal | Any lock entity |
  | AlarmControlPanelModal | Any alarm entity |
  | HumidifierModal | Any humidifier entity |
  | ValveModal | Any valve entity |
  | LawnMowerModal | Any lawn mower entity |
  | VacuumModal | Any vacuum entity |

  Expected: after Phase 1, these should all be fine. Look for unexpected scrollbars, cut-off content, or excessive whitespace.

- [ ] **Step 2: Check input/form modals**

  | Modal | Entity type |
  |-------|-------------|
  | InputSelectModal | input_select entity |
  | InputNumberModal | input_number entity |
  | InputTextModal | input_text entity |
  | InputDateModal | input_datetime entity |
  | CounterModal | counter entity |
  | TimerModal | timer entity |
  | TodoModal | todo entity |
  | GroupModal | group entity |

- [ ] **Step 3: Check info/action modals**

  | Modal | Entity type |
  |-------|-------------|
  | SensorModal | Any sensor entity |
  | UpdateModal | Any update entity |
  | AutomationModal | Any automation entity |
  | ScriptModal | Any script entity |
  | YoutubeModal | media_player with YouTube |
  | MediaPlayerModal | Any media_player entity |

- [ ] **Step 4: Apply fixes as found**

  Common patterns:

  **Unnecessary scrollbar on short content**: check if `.body` padding or modal padding creates phantom height. If so, check whether `min-height` on any inner element exceeds the visible height.

  **Content cut off**: find the element with `overflow: hidden` that is clipping and either increase its height or switch to `overflow: visible` if safe.

  **Excess whitespace at QHD**: reduce `padding` or `margin` values proportionally.

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/Modal/
  git commit -m "fix: entity modal layout audit — overflow and spacing corrections"
  ```

---

## Task 9: Audit DoorbellModal and CameraModal

**Files:**
- Modify if needed: `src/lib/Modal/DoorbellModal.svelte`, `src/lib/Modal/CameraModal.svelte`

- [ ] **Step 1: Check DoorbellModal**

  Open a doorbell tile in view mode (click it). The modal shows a video stream + "Apri porta" button. DoorbellModal has `overflow: hidden; min-height: 12rem` on the image container.

  At 2560×1440: verify the stream image fills the modal width (it uses the large `size` prop) and doesn't create whitespace below. Verify "Apri porta" button is always visible.

  If the image has excess whitespace, ensure the `<img>` has `max-width: 100%; height: auto; display: block`.

- [ ] **Step 2: Check CameraModal**

  Open a camera tile. Verify the live stream image fills the modal correctly at QHD. No extra scrollbar should appear.

- [ ] **Step 3: Commit any changes**

  ```bash
  git add src/lib/Modal/DoorbellModal.svelte src/lib/Modal/CameraModal.svelte
  git commit -m "fix: doorbell and camera modal image sizing at QHD"
  ```

---

## Task 10: Audit PictureElementsConfig

**Files:**
- Modify if needed: `src/lib/Modal/PictureElements/PictureElementsConfig.svelte`

**Context:** The canvas editor has a complex layout with multiple independent scroll panels and a Konva canvas. It uses `height: 75vh` and `overflow-y: scroll` on action/element panels. This task requires careful verification — do not change the Konva canvas dimensions.

- [ ] **Step 1: Open PictureElementsConfig**

  In edit mode, configure a Picture Elements tile. The canvas editor opens as a `size="large"` modal.

- [ ] **Step 2: Verify behavior after Phase 1**

  Check:
  - Canvas renders correctly (no blank area)
  - Left panel (elements list) and right panel (attributes) scroll independently as before
  - Toolbar buttons are accessible without extra scroll
  - Drag-to-resize handles work

- [ ] **Step 3: Fix if the canvas is blank or layout is broken**

  If the canvas container height doesn't compute correctly (Konva needs a pixel height), add explicit sizing. Read `PictureElementsConfig.svelte` first, then apply the appropriate fix. A typical fix is to ensure the canvas container has a computed pixel height via a bind + onMount resize pattern (already present in the file — verify it fires correctly after Phase 1).

- [ ] **Step 4: Commit any changes**

  ```bash
  git add src/lib/Modal/PictureElements/PictureElementsConfig.svelte
  git commit -m "fix: PictureElementsConfig canvas layout after flex container change"
  ```

---

## Task 11: Final Verification Pass

- [ ] **Step 1: Set browser to 2560×1440 and run through all modal categories**

  Open at least one modal from each category:
  - Config modal (edit mode): ButtonConfig or LightConfig
  - Entity detail modal: LightModal, ClimateModal
  - Special: AiAssistantModal, CalendarModal, DeviceTrackerModal
  - Confirm success criteria from spec:
    - [ ] No unnecessary scrollbar where content fits
    - [ ] Title + ✕ always visible during scroll
    - [ ] ConfigButtons (Done/Rimuovi) always at bottom
    - [ ] No content clipped or inaccessible

- [ ] **Step 2: Repeat at 768×1024**

  Same checks at tablet resolution. Pay attention to:
  - Padding not being too large (config modals should use the `480px–767px` breakpoint's reduced padding)
  - No content cut off on narrower viewport

- [ ] **Step 3: Run final checks**

  ```bash
  pnpm check && pnpm lint
  ```

  Expected: no errors or warnings.

- [ ] **Step 4: Final commit if any remaining fixes**

  ```bash
  git add src/lib/Modal/
  git commit -m "fix: final modal layout review — QHD and tablet verification"
  ```
