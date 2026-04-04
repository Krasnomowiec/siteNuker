# Privacy Policy — SitesNuker

**Last updated:** 2026-04-04
**Publisher:** Filip Krasnomowiec

## What SitesNuker does

SitesNuker is a browser extension that helps you limit time spent on distracting websites by tracking usage and blocking sites when daily limits are reached.

## Data collected

SitesNuker stores the following data locally on your device:

- **Blocked site list** — domains you add to the block list and their daily time limits
- **Usage data** — time spent on blocked sites per day
- **History** — daily usage summaries (retained for 30 days, then automatically deleted)
- **Settings** — your preferences (enabled/disabled state, nuclear mode configuration)

## Data storage

All data is stored exclusively in your browser's local storage (`browser.storage.local`). Nothing leaves your device.

## Data sharing

SitesNuker does **not**:

- Send any data to external servers
- Use analytics, telemetry, or tracking
- Make any network requests
- Share data with third parties
- Collect personally identifiable information

## Permissions

- **storage** — to save your settings and usage data locally
- **tabs** — to detect which site you are currently visiting
- **declarativeNetRequest** — to block sites that have exceeded their daily limit
- **activeTab** — to identify the current tab's URL
- **host_permissions (`<all_urls>`)** — to redirect blocked sites to the extension's block page

## Data deletion

Uninstalling the extension removes all stored data. You can also remove individual sites or clear usage history from within the extension.

## Contact

For questions or concerns, open an issue at [github.com/Krasnomowiec/siteNuker](https://github.com/Krasnomowiec/siteNuker/issues).
