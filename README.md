# IAI Field Sales Dashboard

An iPhone-first field-sales app for **Integrity Aerial Imaging**: commercial drone window cleaning, facade cleaning and inspection. *Clean. Inspect. Protect. From the Air.*

Tap a place on the map, say how far to look and what kind of building, and the app sources buildings, ranks them from most to least worth reaching, and keeps **one record per property** that carries its contacts, activity, quotes, tasks and pipeline stage. Quotes and emails are always **drafts you read and approve**; the app sends nothing by itself.

> **Status: first working vertical slice (v1.0.0).** It runs, it is tested, and the first screen you see is **clearly labelled demonstration data** (invented buildings) until you clear it. See [`docs/STATUS.md`](docs/STATUS.md) for exactly what is working, what is simulated and what needs review.

## What is in it

| Screen | What it does |
|---|---|
| **Dashboard** | Today's numbers, top-priority lead (Call / Navigate / Note / Photo), today's route, follow-ups due, pipeline snapshot |
| **Territory Map** | Drop a pin, pick a radius, building type and minimum stories, then search. Results come back ranked **High / Medium / Lower** with the plain reasons. Saved areas and recent searches |
| **Property Intelligence** | One building in depth: Overview · Contacts · Services · Notes · Files. Edit facts, add contacts, field notes, photos, next actions, change stage, draft a quote, prepare outreach |
| **Review** | Swipe through the buildings a search found, one card at a time: right = Pursue, left = Pass, middle = Investigate. Only Pursue adds a lead; undo after every choice |
| **Leads** | Search, filter by stage, sort; add a lead in ten seconds |
| **Pipeline** | Your funnel (Lead → Contacted → Meeting → Quote → Scheduled → Completed, or Lost) as a map, list or board, with totals, win rate and overdue |
| **Settings** | **How much to show** (Simple / More / Everything and single switches), your details, services and **your** prices, ready-made solutions, lookups on/off, backup export/import, demo data |

IAI's three core services come first: **window cleaning**, **facade cleaning** and **inspection**. Roof cleaning, soft washing, 3D mapping, solar-panel cleaning and marketing are listed as add-ons.

## Run it

No build step and no dependencies for the app itself: it is plain HTML, CSS and JavaScript.

```sh
python3 -m http.server 8080      # then open http://localhost:8080
```

Open it on an iPhone (Safari → Share → **Add to Home Screen**) to install it. It works offline once opened.

Add `?demo=1` to the address to load the demonstration data again.

## Test it

```sh
npm i -D playwright && npx playwright install chromium   # once
sh tests/run-all.sh test-out                             # every suite
```

| Suite | Checks |
|---|---|
| `tests/hygiene.js` | The repo is public: no real prices, phone numbers, emails or backups; only the allowed web addresses; one network function |
| `tests/engine.js` | Quote maths never guesses; ranking; outline measurements; starter solutions |
| `tests/pwa.js` | Manifest, icons, service worker caches everything, app opens offline |
| `tests/fsd1.js` | The vertical slice end to end: demo labels, navigation, one property record, persistence, stage changes, quote approval gate, email on tap only, backup round trip, damaged-save handling |
| `tests/blocked.js` | If the browser blocks storage (private browsing, an embedded preview) the app still opens with demo data, works for the visit and says changes won't be kept |
| `tests/files.js` | Photos and files: stored on the phone, shown on the property, left out of a backup unless chosen, restored from one that includes them |
| `tests/outside.js` | Nothing is sent until lookups are on; only the declared hosts: three OpenStreetMap hosts, plus the backup building server only when the main one is busy (the county test is `tests/county.js`); private data never leaves; map results are not leads until you add one |
| `tests/layout.js` | 320 px and 390 px wide: no sideways scroll, touch targets ≥ 40 px (pass a folder to save screenshots) |

The outside services are **mocked** in the tests, with invented buildings.

## Try it in your markets

See [`docs/FIELD-TEST.md`](docs/FIELD-TEST.md): install on the phone, one-time setup, a first run through a market, and what to watch for.

## Principles (what the app will not do)

- **Nothing made up.** Ownership, contacts, prices, flight clearance and building measurements are left blank or marked *unknown* until you or a source supplies them. Map-derived numbers are labelled estimates with their source and date. There are **no built-in prices**: a quote line without your rate says "rate needed".
- **No flight clearance claims.** The app shows how far the nearest mapped airport is and links to the FAA's LAANC page. It never says a site is cleared.
- **Approval before anything customer-facing.** A quote is a draft until you read it and tick *I have read this quote and approve it*. Only approved quotes can go into an email. The email opens in your own mail app; *I sent it* is the only thing that logs it, and it can be undone. Demonstration properties can never have a quote approved.
- **Private by default.** Everything lives in this browser on your phone. No account, no analytics, no cookies. Outside lookups (map pictures, building search, address search) are **off until you turn them on**, show the exact request first, and send only a place and filters, never a lead, contact, price or note. See [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md#outside-requests).

## Repository map

```
index.html  styles.css  sw.js  manifest.json  icons/     the app shell
js/engine.js     pure logic: map maths, ranking, quote maths, solutions
js/core.js       data model, saving, demo data, backup
js/map.js        the slippy map
js/ui.js         dialogs, toasts, navigation, the lookup consent step
js/work.js       updates, calls, tasks, stages, contacts, quote, email
js/leads.js      Leads tab + Property Intelligence
js/territory.js  Territory Map
js/review.js     Swipe review
js/dashboard.js  js/pipeline.js  js/settings.js  js/app.js
tests/           automated checks      docs/   status, data model, review guide
netlify.toml     static deploy (copies only the app files)
```

## Working together

Claude is the primary builder; ChatGPT is the independent product architect and QA reviewer; the owner decides. Changes go through pull requests on a feature branch. [`docs/REVIEW.md`](docs/REVIEW.md) is the reviewer's guide: requirement-by-requirement evidence, how to try each claim, and the open questions.

Mac mini scans: see [docs/MAC-MINI.md](docs/MAC-MINI.md). What comes next: [docs/ROADMAP.md](docs/ROADMAP.md).
