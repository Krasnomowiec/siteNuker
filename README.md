# SitesNuker

Browser extension that limits your daily time on addictive websites. Set per-site limits, get blocked when time runs out, and track your progress with built-in statistics.

## Features

- **Per-site daily limits** — configure how many minutes per day you can spend on each site
- **Hard blocking** — when your limit is up, the site is blocked via `declarativeNetRequest` (no workarounds)
- **Nuclear mode** — block ALL tracked sites for a chosen duration (5 min – 5 hours)
- **Usage statistics** — daily average, weekly trends, per-site breakdowns
- **History tracking** — 30-day rolling archive of usage data
- **i18n** — English and Polish UI

## Tech Stack

- **Firefox MV3** (Manifest V3)
- **WXT** — build framework for browser extensions
- **React 18** + **TypeScript** (strict mode)
- **Tailwind CSS v4** with custom design tokens
- **Vitest** for unit tests
- **ESLint** + **Prettier**

## Development

```bash
# Install dependencies
npm install

# Start dev server (Firefox)
npm run dev

# Run tests
npm test

# Type check
npm run compile

# Lint
npm run lint

# Production build
npm run build

# Create .zip for distribution
npm run zip
```

## Project Structure

```
entrypoints/
  background.ts        — persistent background script (timers, blocking, storage)
  content.ts           — content script (block overlay on tracked pages)
  blocked/             — full-page block screen
  popup/
    App.tsx            — popup root with page routing
    pages/             — MainList, NuclearSetup, NuclearCountdown, Statistics
    components/        — Header, AddSiteBar, SiteRow, Slider, stats charts
    hooks/             — useStorage, useActiveDomain
shared/
  types.ts             — StorageSchema, SiteConfig, DomainUsage, etc.
  constants.ts         — limits, presets, time options
  utils.ts             — date/time formatting, domain extraction
  blocking.ts          — declarativeNetRequest rule management
  storage.ts           — read/write/migrate storage
  statsComputation.ts  — statistics calculations
  i18n.ts              — internationalization helper
public/
  _locales/            — en, pl message catalogs
  icon/                — extension icons (16–128px)
  rules/               — declarativeNetRequest static rules
```

## License

MIT
