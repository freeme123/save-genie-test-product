# Save Genie test product page

A fake product page whose **price** and **availability** rotate over time, for
testing Save Genie's price-drop and availability-change detection.

- Server-rendered **JSON-LD `Product`** → extracts cleanly at **T1** (no WebView/Zyte).
- Price/availability are derived from the clock (every 3h by default), so a given
  UTC time always yields the same value — predictable for testing.
- A GitHub Action rebuilds + redeploys hourly so the served HTML never lags.

## How it rotates

`generate.js` picks a slot from `SCHEDULE` based on the current time. The default
schedule steps the price **down** several times (to trigger drop notifications),
flips to **OutOfStock** once (to test availability changes), then **rises** again.
Full cycle = `SLOT_HOURS * SCHEDULE.length` = 24h. Edit `SCHEDULE` / `SLOT_HOURS`
in `generate.js` to taste.

## Local preview

```sh
node generate.js
open public/index.html        # macOS
```

To check the raw HTML the way Save Genie's T1 fetch sees it (no JS execution):

```sh
node generate.js && cat public/index.html
# or serve it:  python3 -m http.server -d public 8000  → http://localhost:8000
```

## Deploy (one-time setup)

1. Create a GitHub repo and push this folder.
2. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The workflow runs on push, hourly, and via **Actions → Rotate price & deploy → Run workflow**.
4. Your URL: `https://<owner>.github.io/<repo>/` — save **that** URL in Save Genie.

## Notes

- The JSON-LD `image`/`url` become absolute via the Pages `base_url` at build time.
- Keep `name` + `gtin13` stable (they are) so Save Genie treats every check as the
  same product across price changes.
- Scheduled GitHub Actions are best-effort and can be delayed a few minutes — fine
  here since the value only changes every few hours and the page is time-derived.
