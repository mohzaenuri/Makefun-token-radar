# Launch Radar — token-radar-01

[![make.fun](https://make.fun/badge/token-radar-01)](https://make.fun/c/token-radar-01/?ref=tfmv7ccz)
[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/mohzaenuri/Makefun-token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/mohzaenuri/Makefun-token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it ranks pre-token protocols by an implied value priced
off the live market, and gives every row a concrete six-step farm plan.

## Model: radar-2 (comparables)

For each category, the multiple is the **median mcap/TVL of the live-token
protocols in that category** (119 live peers in the snapshot). Categories with
fewer than 3 live peers use the global median (0.246). Multiples are clamped
to [0.05, 1.50]. Then:

```
implied = max(1, round(TVL × multiple
  × (1 + clamp(7d, −50, 100)/100 × 0.35)
  × (0.7 + min(age, 1460)/1460 × 0.5)
  × (1 + 0.03 × min(chains, 5))))
```

The board covers all 40 watchlist protocols plus every other rankable
pre-token protocol below the floor — 183 rows in this snapshot (40 watchlist
+ 143 early finds), the whole rankable universe below the floor. Live-token
protocols are never ranked; they appear apart, at the market's own value, as
the comparables the model is priced from.

## Run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-ke-snapshot.json>
```

Node 22+, standard library only. The program reads the sealed snapshot,
writes `board.json`, `data.js`, copies `dashboard/` and `screenshots/`, and
writes `dossier.json`. Two runs produce byte-identical output.

Check the gate locally:

```sh
node scripts/check-gate.mjs out
```

## Dashboard

Static page, no network: sortable board, text/category/chain/watchlist
filters, a detail view per protocol (model breakdown, farm plan,
comparables), the methodology with the full category-multiples table, and a
live-token comparison.

---
Built for [make.fun](https://make.fun/c/token-radar-01/?ref=tfmv7ccz) — token-radar-01.
