# Modal Scroll & Layout Review — Design Spec

**Date:** 2026-06-05  
**Scope:** Fix scroll, layout, and spacing issues across all modals in ha-fusion  
**Target resolutions:** 2560×1440 (QHD, primary), 768×1024 (tablet), plus general responsiveness  

---

## Problem Statement

Modals exhibit two overlapping issues across large resolutions:

1. **Unnecessary scrollbar** — the scrollbar appears even when content would fit on screen
2. **Content overflow requiring scroll** — important UI elements (buttons, fields) require scrolling to reach

Root cause in `Index.svelte`: `display: block` is set on `.contents` while `flex-direction: column` is also declared — `flex-direction` has no effect without `display: flex`, making proper flex-based layout impossible. As a result, the entire modal (header + content) scrolls together, so the title and close button disappear when scrolling long forms.

---

## Approach

**Per categories**, in 4 phases:

1. Global container fix (Index.svelte + ConfigButtons.svelte)
2. Config modals audit + targeted fixes (~27 files)
3. Entity detail modals audit by category (~43 files)
4. Special modals — per-modal architectural fixes (6 files)

---

## Phase 1 — Global Container (Index.svelte + ConfigButtons.svelte)

### Index.svelte — `.contents`

**Current (broken):**
```css
.contents {
  display: block;          /* flex-direction has no effect */
  flex-direction: column;  /* ignored */
  overflow-y: auto;        /* entire modal scrolls, header included */
  max-height: 85vh;
}
```

**Fixed:**
```css
.contents {
  display: flex;
  flex-direction: column;
  overflow: hidden;        /* clip at max-height; body child handles scroll */
  max-height: 85vh;
}
```

**New `.body` wrapper** (wraps `<slot />` in the template):
```css
.body {
  overflow-y: auto;
  flex: 1;
  min-height: 0;  /* required for flex scroll to work */
}
```

**Template change:**
```svelte
<!-- before -->
<slot />

<!-- after -->
<div class="body">
  <slot />
</div>
```

**Result:** The `.header` (title + close button) is always visible. Only the `.body` scrolls. All existing `max-height` responsive breakpoints on `.contents` remain unchanged.

### ConfigButtons.svelte — sticky footer

Config modals use `ConfigButtons.svelte` (Done / Rimuovi / Cambia tipo) rendered as the last element of the slot. After the Phase 1 fix, these buttons live inside `.body` and will scroll with the content.

To keep them always visible at the bottom of long config forms, make them sticky:

```css
/* ConfigButtons.svelte */
.container {
  position: sticky;
  bottom: 0;
  background: var(--theme-modal-background-color-modal);
  padding-top: 0.8rem;
  margin-top: 1.6rem;  /* replaces current margin-top: 2.37rem */
  z-index: 1;
}
```

The `background` prevents content from showing through when scrolling past the sticky bar.

---

## Phase 2 — Config Modals (~27 files)

Most config modals will automatically benefit from the Phase 1 fix. The following have custom heights or internal scroll containers that require individual verification and possible fix:

### Priority: High

| File | Issue | Expected fix |
|------|-------|--------------|
| `MainItemConfig.svelte` | Internal list `height: 10rem; overflow: auto` — verify nested scroll still works | Verify only; adjust height if cramped on QHD |
| `SidebarItemConfig.svelte` | Same pattern as MainItemConfig | Same |
| `VisibilityConfig/Index.svelte` | `min-height: 8.6rem` on condition panel — verify content isn't clipped | Verify; adjust if needed |
| `CustomPanelConfig.svelte` | `min-height: 22rem` — verify modal isn't unnecessarily tall on mobile | Adjust to `min-height` that works across breakpoints |

### Priority: Normal

All other config modals (`ButtonConfig`, `CameraConfig`, `ClimateConfig`, `LightConfig`, `ThemeEditor`, `ViewConfig`, `AppearanceConfig`, etc.) — open each one, verify no scroll issues remain after Phase 1, fix any spacing or layout problems observed at QHD and 768×1024.

**Common fixes expected:**
- Remove unnecessary fixed `height` values (use `min-height` or `auto` instead)
- Adjust vertical spacing/padding that looks too compressed or too loose at QHD

---

## Phase 3 — Entity Detail Modals (~43 files)

Entity modals (Light, Climate, MediaPlayer, Cover, Fan, Lock, Alarm, etc.) are interacted with at runtime and are generally shorter than config modals. Most will be fixed by Phase 1.

### Layout-special modals requiring individual attention

| File | Issue |
|------|-------|
| `DeviceTrackerModal.svelte` | Map container at `height: 75vh` — verify it adapts correctly inside the new flex `.body` |
| `CalendarModal.svelte` | Calendar grid at `height: 75vh` — same verification |
| `YoutubeModal.svelte` | Video embed — verify aspect ratio at QHD |
| `UpdateModal.svelte` | Changelog content can be long — verify scroll behavior |

### Audit approach

For all 43 entity modals: open in the app at 2560×1440 and 768×1024, check for scroll/layout/spacing issues, fix any that appear. Document any per-file changes.

---

## Phase 4 — Special Modals (6 files)

### AiAssistantModal.svelte

**Problem:** Messages container uses `height: 60vh` (fixed). Inside a modal with `max-height: 75vh` at QHD (`min-width: 1920px` breakpoint), this leaves very little room for the input area and creates a rigid layout.

**Fix:** Replace fixed `height: 60vh` with flex-based sizing:
```css
/* messages container */
.messages {
  flex: 1;
  min-height: 0;       /* flex scroll */
  overflow-y: auto;
}
```
The modal's `.body` wrapper becomes a flex column, and `.messages` fills available space naturally.

### PictureElementsConfig.svelte

**Problem:** Canvas editor with multiple independently-scrolling panels and `height: 75vh` fixed layout. Konva canvas requires explicit pixel dimensions.

**Fix:** Adapt to the new flex container carefully — verify that Konva canvas resizing still works. The panel scroll areas (`overflow-y: scroll`) should continue working within `.body`. Adjust `height: 75vh` to `min-height: 75vh` or flex-based if the canvas allows it.

### DoorbellModal.svelte

**Problem:** Video stream + "Apri porta" button. Verify aspect ratio of the video at QHD doesn't create excess whitespace or cropping.

**Fix:** Ensure the video/image element uses `max-width: 100%; height: auto` and the button is always visible below the stream without scroll.

### CameraModal.svelte

Same verification as DoorbellModal — live stream image sizing at QHD.

### AiAssistantConfig.svelte / DoorbellConfig.svelte

Config counterparts — verify under Phase 2 criteria.

---

## Responsive Breakpoints (unchanged)

The existing `max-height` breakpoints in `Index.svelte` are kept as-is:

| Breakpoint | max-height |
|-----------|-----------|
| default | 85vh |
| ≥ 1920px | 75vh |
| 1366–1919px | 80vh |
| 768–1023px | 82vh |
| 480–767px | 88vh |
| ≤ 479px | 90vh |

If during the audit specific breakpoints prove wrong, they will be adjusted per-phase.

---

## Success Criteria

- [ ] No unnecessary scrollbar on modals where content fits the screen
- [ ] Title and close button always visible during scroll
- [ ] ConfigButtons (Done/Rimuovi) always visible at the bottom of config modals
- [ ] No content clipped or inaccessible at 2560×1440
- [ ] No regressions at 768×1024 or smaller
- [ ] AiAssistantModal messages area fills available space without fixed `60vh`
- [ ] PictureElements canvas editor unaffected by flex container change
