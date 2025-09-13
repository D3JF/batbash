# BATBASH

Aggressively throttle background tabs to squeeze every last drop of battery life while keeping the websites intact when you return.

## What it does

- Puts **any** background tab into a deep-sleep state after a few seconds
- Pauses timers, animations, media, workers, canvas, and observers
- Whitelist your favorite sites (YouTube, Spotify, etc.) with two clicks
- Restores the page **instantly** when you switch back—scroll position intact

## Whitelist manager

1. Click the BATBASH toolbar icon → “Whitelisted Sites”
2. Type domain (e.g. `youtube.com`) → Enter
3. All sub-domains (`music.youtube.com`, `www.youtube.com`) stay awake automatically

## Install

TBA

## Build from source (optional)

```bash
git clone https://github.com/D3JF/batbash.git
cd batbash
```

Create the unsigned **.xpi** (a plain zip with Firefox’s extension structure):

```bash
zip -r batbash.xpi manifest.json *.js icons/ _locales/ -x ".*" "node_modules/*"
```

Install locally:

1. Open Firefox → `about:debugging` → **This Firefox** → **Load Temporary Add-on**  
2. Pick the generated `batbash.xpi`  
3. Extension stays loaded until you restart the browser (or reload it manually).
