# Nova Domus

A Home Assistant dashboard that actually feels like home.

Home Assistant is one of the most powerful home automation platforms available, and also one of the least inviting to look at. Nova Domus is the layer between HA and your wall tablet — fast, configurable, and built by someone who uses it every day and kept wanting it to do one more thing. It started as a fork of [ha-fusion](https://github.com/matt8707/ha-fusion) by [matt8707](https://github.com/matt8707) and grew into its own project over three years of daily use.

[![preview](/static/preview.png)](https://youtu.be/2jNCyvkyLD8)

---

## Why Nova Domus

**A dashboard that adapts to your home, not the other way around.**
The kitchen tile doesn't have to be a single light switch. It can be the camera outside the door, the button that opens the gate, and the sensor that tells you if it's raining — all in one place because that's what makes sense in your kitchen. The Custom Panel lets you compose exactly that: rows of cameras, buttons, sensors, and sliders inside a single tile, shaped around how you actually move through your space. Every room is different; the dashboard should reflect that.

**The simplest interface is sometimes no interface at all.**
Nova Domus includes a built-in AI assistant connected to whichever agent you've already configured in Home Assistant — Anthropic, Google, OpenAI, a local Ollama model, anything HA supports. Ask it something, get an answer or an action. Voice input and spoken responses work wherever the browser allows it. Nothing extra to set up: it routes through Home Assistant's conversation API and stays within the boundaries of what HA already knows about your home.

**Designed to run unattended.**
On a wall panel, the dashboard should mostly take care of itself. When the doorbell rings, the camera feed opens automatically and a countdown gives you time to unlock the door before the modal closes on its own. When nobody's been near the panel for a few minutes, it returns to whatever view you've set as the default — the floor plan, the living room, whatever makes sense as the idle state. No taps required, no stale screens left open.

---

## Installation

### Home Assistant Add-on

The easiest way in if you're on HA OS or Supervised. Add the repository and install directly from the add-on store:

[![Add add-on repository](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Famedello%2Faddon-ha-fusion)

Or add manually: `https://github.com/amedello/addon-ha-fusion`

### Docker

```bash
docker compose up -d nova-domus
```

**Update:**

```bash
docker compose pull nova-domus && docker compose up -d nova-domus
```

<details>
<summary>Without Compose</summary>

```bash
docker run -d \
  --name nova-domus \
  --network bridge \
  -p 5050:5050 \
  -v /path/to/data:/app/data \
  -e TZ=Europe/Rome \
  -e HASS_URL=http://your-ha-instance:8123 \
  --restart always \
  ghcr.io/amedello/nova-domus
```

> Already running `ghcr.io/amedello/ha-fusion`? That tag still receives updates — no changes needed.

</details>

---

## Query strings

| Parameter     | Effect                                          |
| ------------- | ----------------------------------------------- |
| `?view=Name`  | Load a specific view on startup                 |
| `?menu=false` | Hide the menu button (useful on kiosk displays) |

---

## Keyboard shortcuts

| Key                    | Action       |
| ---------------------- | ------------ |
| `f`                    | Filter       |
| `Esc`                  | Exit / close |
| `Cmd/Ctrl + S`         | Save         |
| `Cmd/Ctrl + Z`         | Undo         |
| `Cmd/Ctrl + Shift + Z` | Redo         |

---

## Development

```bash
git clone https://github.com/amedello/ha-fusion.git
cd ha-fusion
pnpm install

cp .env.example .env   # set HASS_URL

pnpm dev       # dev server with HA proxy
pnpm check     # type check
pnpm lint      # eslint + prettier
pnpm format    # auto-fix formatting
```

Dashboard config: `data/dashboard.yaml` — App config: `data/configuration.yaml`

---

## Debug

```bash
docker logs nova-domus   # backend errors
# browser console for frontend
```

---

## Credits

Nova Domus stands on the work of [matt8707](https://github.com/matt8707/ha-fusion). The original dashboard design, architecture, and entity integrations are his — this project would not exist without that foundation.

---

## Support

If Nova Domus saves you time, or just a few steps to the light switch:

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/amedello)
