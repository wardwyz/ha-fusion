# Documentation

Nova Domus is a Home Assistant dashboard built for wall panels and daily use. This page covers the main concepts and configuration options.

---

## Views

A dashboard is divided into **views** — tabs shown in the navigation bar. Each view has its own sections and items. One view can be marked as the **default**: the dashboard returns to it automatically after a configurable idle timeout.

### View options

| Option                | Description                                                    |
| --------------------- | -------------------------------------------------------------- |
| Name                  | Label shown in the nav tab                                     |
| Icon                  | Optional icon beside the label                                 |
| Default view          | Returns here after inactivity                                  |
| Default timeout       | Seconds of inactivity before returning (requires Default view) |
| Iframe URL            | Load an external page instead of a tile grid                   |
| Visibility conditions | Hide the view tab based on entity state                        |

---

## Sections

Each view is made up of **sections** that group tiles together.

| Section type       | Description                      |
| ------------------ | -------------------------------- |
| Default            | A responsive grid of tiles       |
| `horizontal-stack` | Side-by-side columns of sections |
| `vertical-stack`   | Stacked sections in one column   |
| `scenes`           | A compact grid of scene buttons  |

Sections can have an optional title. In `horizontal-stack`, an empty column can be kept visible with `spacer: true`.

---

## Item types

### Button

The standard tile. Displays an entity's icon, name, and state. Tapping it calls the default service for that entity type (toggle, activate, open, etc.). Long-press opens the detail modal for more controls, history, and attributes.

Supports: lights, switches, covers, climate, sensors, scripts, automations, scenes, locks, media players, fans, vacuums, alarms, and more.

### Camera

Shows a live MJPEG or snapshot stream from a camera entity. Tapping opens the full-screen view.

### Doorbell

Monitors a binary sensor (e.g. a doorbell trigger). When the sensor turns on, the camera feed opens automatically in a modal with a configurable auto-close countdown.

### Custom Panel

Composes multiple entities into a single tile — rows of cameras, buttons, sensors, sliders, and separators. Use it to build room-specific tiles that show exactly what matters in that space.

### Conditional Media

Shows a different camera or media player based on which one is currently active. Useful for a single "what's playing" tile that switches sources automatically.

### Picture Elements

Overlays interactive elements (buttons, state badges, icons) on top of a background image. Mirrors the Home Assistant Picture Elements card format.

### AI Assistant

A text and voice interface to the Home Assistant conversation API. Supports any agent configured in HA (Anthropic, Google, OpenAI, Ollama, etc.). Voice input and spoken responses work wherever the browser supports it.

### Music Assistant

Controls a Music Assistant player. Shows the current track, album art, and transport controls (previous, play/pause, next) directly on the tile. Tapping opens a full modal with queue management, browse, search, and multi-player controls.

### Empty

An invisible placeholder that reserves space in the grid.

---

## Sidebar

The sidebar appears on the left and is independent of views. Items stack vertically.

| Type               | Description                                                     |
| ------------------ | --------------------------------------------------------------- |
| `time`             | Current time                                                    |
| `date`             | Current date                                                    |
| `weather`          | Current conditions from a weather entity                        |
| `weather_forecast` | Hourly or daily forecast                                        |
| `sensor`           | Value from any sensor entity                                    |
| `binary_sensor`    | State badge for a binary sensor                                 |
| `template`         | Rendered Jinja2 template string                                 |
| `bar`              | Horizontal bar showing a numeric value (e.g. battery, progress) |
| `radial`           | Circular gauge                                                  |
| `graph`            | Sparkline history graph for a sensor                            |
| `navigate`         | Button that switches to a named view                            |
| `camera`           | Live camera feed                                                |
| `image`            | Static image                                                    |
| `iframe`           | Embedded external page                                          |
| `history`          | Scrollable entity history list                                  |
| `notifications`    | HA persistent notifications                                     |
| `power_summary`    | Total power draw across a list of entities                      |
| `timer`            | Countdown for a timer entity                                    |
| `ai_assistant`     | Inline AI assistant prompt field                                |
| `divider`          | Horizontal rule separator                                       |

---

## Visibility conditions

Items and sections can be hidden based on entity state. Conditions support `==`, `!=`, `>`, `<`, `>=`, `<=` and can be combined with `and` / `or` logic.

---

## Edit mode

Open the drawer (hamburger menu) and enable **Edit mode** to:

- Drag and drop tiles and sections
- Configure any item via its gear icon
- Add, delete, or reorder views
- Undo / redo changes (`Cmd/Ctrl+Z` / `Cmd/Ctrl+Shift+Z`)
- Rename, resize, or hide sections

Changes are saved to `data/dashboard.yaml` via **Save** or `Cmd/Ctrl+S`.

---

## Settings

Open via the gear icon in the drawer.

| Section         | Description                                      |
| --------------- | ------------------------------------------------ |
| Language        | UI locale                                        |
| Token           | Long-lived HA access token (if not using OAuth)  |
| MapTiler        | API key for detailed map tiles in device tracker |
| YouTube         | Enable YouTube embed support                     |
| Music Assistant | Connect to a Music Assistant server              |
| Version         | Installed version, update check                  |
| Custom JS       | Load `data/custom.js` on startup                 |
| Custom CSS      | Load `data/custom.css` on startup                |
| Motion          | Disable animations (useful on low-power panels)  |

---

## Themes

Themes are YAML files in `static/themes/`. The active theme is set in the dashboard config (`dashboard.theme`). Themes define CSS custom properties for colors, backgrounds, fonts, and gradients.

---

## Query string parameters

| Parameter     | Effect                            |
| ------------- | --------------------------------- |
| `?view=Name`  | Open a specific view on load      |
| `?menu=false` | Hide the menu button (kiosk mode) |

---

## Keyboard shortcuts

| Key                | Action                    |
| ------------------ | ------------------------- |
| `f`                | Focus search              |
| `Esc`              | Close modal / exit search |
| `Cmd/Ctrl+S`       | Save dashboard            |
| `Cmd/Ctrl+Z`       | Undo                      |
| `Cmd/Ctrl+Shift+Z` | Redo                      |
