# EPL data worker

> Thanks maintainer at yahoo japan for all the effort <3

Scrape https://soccer.yahoo.co.jp/ for various data for EPL to power my discord bot

## Endpoints

| Path        | What it does                                                                 |
| ----------- | ---------------------------------------------------------------------------- |
| `/schedule` | Current matchweek fixtures/results as JSON                                   |
| `/standing` | League table as JSON                                                         |
| `/health`   | Scrapes both pages and reports row counts and unmapped team names; 503 if not healthy |
| `/upnext`   | Posts to Discord if a match kicks off within `NEXT_MATCH_BUFFER_MINUTES`     |

A cron trigger runs the `/upnext` logic every 30 minutes.

## Development

```bash
npm run dev       # local worker on http://localhost:8787 (reads .dev.vars)
npm run check     # typecheck, tests, and a dry-run build
```

Note `.dev.vars` holds the real Discord webhook, so hitting `/upnext` locally posts to the channel.

## Observability

Workers Logs is enabled in `wrangler.toml`. Logs are structured JSON with an `event` field
(`fetch`, `parse_schedule`, `parse_standings`, `discord_webhook`, `unmapped_team`, `cron_failed`, …),
so they can be filtered in the Cloudflare dashboard. An `unmapped_team` warning means a team
needs adding to the map in `src/utils.ts`, usually after promotion.

## CI

`.github/workflows/ci.yml` runs typecheck, tests and a dry-run build on every push and PR,
and deploys on pushes to `master` once those pass (needs the `CF_API_TOKEN` secret).
