# SitesNuker

Browser extension that limits your daily time on addictive websites. Set per-site limits, track usage, and block sites when limits are reached.

**Firefox MV3** | React 18 | TypeScript | Tailwind CSS | WXT

## Features

- **Per-site daily limits** — choose 5–60 minute limits from a preset grid (1-hour hard cap)
- **Automatic blocking** — sites are blocked via `declarativeNetRequest` when limits are reached
- **Friction by design** — increasing limits or extending time requires a 20-second countdown confirmation; reducing limits is instant
- **Live usage tracking** — real-time countdown badges, progress bars (used vs remaining vs hard cap), and per-site expanded cards
- **Nuclear Mode** — block all tracked sites for 5 min to 5 hours when you need to focus
- **Statistics** — daily and 7-day weekly usage trends with color-coded charts
- **Hard block** — manually block a site until tomorrow, regardless of remaining time
- **Domain aliases** — youtu.be, old.reddit.com, m.facebook.com etc. map to their canonical domains
- **Preset sites** — YouTube, Facebook, Reddit, Instagram, TikTok (10-minute defaults)
- **Custom sites** — add any domain (up to 20 sites)
- **Letter favicons** — privacy-first site icons with no external API calls
- **Localized** — English, German, Spanish, Polish, Russian

## Install

Install from [Mozilla Add-ons](https://addons.mozilla.org/firefox/addon/sitesnuker/).

## Development

Requires **Node.js 22+**.

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (Firefox)
npm run compile      # Type check
npm run lint         # Lint
npm test             # Run tests
npm run build        # Production build
npm run zip          # Create .zip for AMO submission
```

## Project Structure

```
entrypoints/
  background.ts        # Tracking, blocking, message handling
  content.ts           # Block overlay on tracked pages, media pausing
  popup/               # React popup UI
    App.tsx             # Root component, page routing, nuclear mode
    components/         # Site rows, charts, bottom sheets, countdown ring
    pages/              # MainList, NuclearSetup, NuclearCountdown, Statistics
    hooks/              # useStorage, useActiveDomain
  blocked/              # Blocked page (redirect target)
shared/
  blocking.ts           # declarativeNetRequest rule management
  backgroundHelpers.ts  # Write lock, session tracking, self-write tracker
  storage.ts            # Schema validation, migrations, read/write
  constants.ts          # Limits, presets, domain aliases
  types.ts              # TypeScript interfaces
  statsComputation.ts   # Weekly trends, north star metric
  blockedPageTheme.ts   # Shared styles for blocked page overlay
  utils.ts              # Date keys, time formatting, domain extraction
  i18n.ts               # Localization helper
```

## How It Works

1. **Background script** tracks active tab time per domain using in-memory sessions, flushed to `browser.storage.local` every 5 seconds.
2. When usage hits the site's daily limit (or the 1-hour hard cap), a **declarativeNetRequest** redirect rule blocks the domain at the browser level.
3. A **content script** (injected at `document_start`) checks block status and displays a full-page overlay before the page renders.
4. **Nuclear Mode** blocks all tracked sites simultaneously for a chosen duration — rules are removed when the timer expires.
5. All popup mutations are routed through `browser.runtime.sendMessage` to the background, which serializes writes via a Promise-based mutex.
6. **Daily limits reset at midnight** — `dailyLimitMinutes` reverts to `baseLimitMinutes`, and all block rules are cleared for the new day.

## Privacy

All data is stored locally — no analytics, telemetry, or external API calls. The `<all_urls>` permission is required to block any user-configured domain and inject content scripts.

## License

MIT
