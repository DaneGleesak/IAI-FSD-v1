# Implementation status

Version 1.0.0, first vertical slice. Last updated with the simple-view and swipe-review pull request.
Legend: ✅ working and covered by a test · 🟡 working, partly simulated or limited · ⬜ not built.

## The ten requirements

| # | Requirement | State | Evidence |
|---|---|---|---|
| 1 | Actual iPhone-first field-sales app, not static mockups | ✅ | Installable PWA, safe areas, 44 px targets, offline. `tests/pwa.js`, `tests/layout.js` (320 and 390 px). **Not yet run on a physical iPhone** |
| 2 | Screenshots as the shared visual reference | 🟡 | Five-tab nav, KPI tiles, territory card, top-priority lead, route, follow-ups, pipeline accordions/boards, Property Intelligence tabs, Scan CTA, "DEMO DATA / DRAFT — REVIEW REQUIRED" labels. Colours follow the IAI brand (navy/royal/cyan), as the owner asked, not the mockups' green. Pixel-level match not attempted |
| 3 | Working navigation: Dashboard, Territory Map, Property Intelligence, Leads, Pipeline | ✅ | `tests/fsd1.js` §2–3: every tab, Property Intelligence reached from Leads, Pipeline and Dashboard, Back |
| 4 | One canonical property record linking contacts, activities, quotes, tasks, stages | ✅ | `state.properties[]`; see [DATA-MODEL](DATA-MODEL.md). `tests/fsd1.js` §3, §5–7 |
| 5 | Persistent records, editable info, field notes, functional stage changes | ✅ | Notes, tasks, contacts, facts, site questions, building numbers, estimate, priority, stage (one tap, picker, undo), photos/files. Survive reload (`fsd1.js` §5), backup round trip (§8), damaged-save kept (§9); photos and files in `tests/files.js` |
| 6 | Clearly identified demonstration data until verified integrations exist | ✅ | Six invented properties, `DEMO DATA` tag on every card and sheet, banner, one-tap clear, never mixed with real leads. `fsd1.js` §1 |
| 7 | Prioritise commercial drone window cleaning, facade cleaning, inspection | ✅ | Default services: window cleaning (exterior/interior floor 1 + floors 2 and up) is the core; facade cleaning and inspection are first add-ons; ready-made solutions lead with them. `tests/engine.js` |
| 8 | Do not fabricate ownership, contacts, pricing, flight clearance, building measurements | ✅ | Blank/"unknown" defaults, no built-in rates, no clearance claims, map numbers labelled estimates with source. `fsd1.js` §4, §7; `engine.js` (quote maths); `hygiene.js` |
| 9 | Approval for external communications and customer-facing quotes | ✅ | Quote draft → read → tick → approve; unapproved quotes cannot enter an email; mail opens only on tap; "I sent it" logs; demo quotes cannot be approved. `fsd1.js` §7 |
| 10 | Automated tests, feature branch, README, status report, initial PR | ✅ | Eight suites (`sh tests/run-all.sh`), this report, README, PR from `feature/field-sales-vertical-slice` |

## What is real, what is simulated

**Real (works today, no setup)**
- All screens, saving, editing, undo, backup/restore, install, offline.
- Ranking and quote maths from building numbers you or the map supply.
- **Mac mini market scan**: `tools/market-scan.mjs` makes a ranked pack from OpenStreetMap on a Mac mini (same engine as the app); the phone imports it from a file with lookups on or off, and sends nothing (`tests/scan.js`). See `docs/MAC-MINI.md`.
- Map search is map-first: after Search the filters fold into one line (“Change filters” brings them back) and the ranked results sit right under the map. A 3 mi radius is one tap, a fresh install starts on the hotels / apartments / offices / medical preset, and the Search button stays in reach while the filters are open (`tests/outside.js`).
- **Connection check** (Settings): one tiny test to each of the five services (map picture, address search, building search, backup building search, county records), the exact requests shown first, results as ✅/❌ with the HTTP code and time, and a Copy button. Sends no lead data and names no building. Added so a failing search can be diagnosed from the phone. `tests/search.js`.
- **Building search, gentle version**: a map search is two requests, not many: all the building kinds you chose in one (exact tag values, 45 s server limit), then a small optional one for airport distances. The confirm step shows both. Manners the public server asks for: after a 429 (“too many requests”) that server is left alone for 30 s and a new search says how long to wait instead of asking again; a gateway error (502/503/504) earns one more round after a 10 s pause, never a rapid retry; a server that says it ran out of time (the area is too big) is not asked again, here or at the backup, and the message says to try a smaller radius. The main server is asked first; the owner-approved backup (`overpass.private.coffee`) is asked only when the main one is busy, down or silent, and the message says its map data can be a little older. If the airports fail the buildings are kept with a plain “Not everything was searched” note; if the buildings fail nothing is saved. Map pictures now send the app's web address (origin only) as Referer, which OpenStreetMap's tile servers require. Whether this fixes the owner's 3-mile failure on the live servers is **unverified** (the build environment cannot reach them): Settings → Check connection will show what each service says. `tests/search.js`, `tests/engine.js`, `tests/outside.js`.
- **How much to show**: twelve on/off switches (Simple, More or Everything, or one at a time) for what building cards, map results and Review display. A fresh install and any older save start on **Simple**: name, address, type, band, stage and next action only; “why it ranks”, last contact, value, owner and the long search explanation are switched off until you turn them on. Settings has the panel, and a “Show” button on Leads, the results and Review opens it. Hiding never deletes data; DEMO DATA tags and the one-line “order is a suggestion” note always stay. `tests/detail.js`.
- **Swipe review**: from the map results, go through the found buildings one card at a time. Right = Pursue (adds a lead), left = Pass, middle button = Investigate (holds it); buttons and arrow keys work too; undo after each; passed and held piles are kept and searchable; every choice is saved with the building and included in backups. Works on the area (pin + radius) search. Plan for county and city search and the rest: [SWIPE-REVIEW-PLAN](SWIPE-REVIEW-PLAN.md). `tests/review.js`.
- **County records (Cuyahoga)**: in a building's Contacts tab, “Look up county record” asks the county's public parcel records about that one map position (the exact request is shown first; nothing else is sent). It shows the deeded owner, mailing address, land use, building area and living units, labelled as the county's record. The owner fact is filled only when you tap “Use as owner” (estimated, source named); a typed owner is never replaced without asking. `tests/county.js` (mocked county, invented owners).
- Draft emails and quotes; opening a draft in the phone's mail app; copy to clipboard.
- Call / Text / Email / Navigate links (plain `tel:`, `sms:`, `mailto:`, Apple Maps), followed only when tapped.

**Simulated or limited**
- **Demonstration data**: six invented properties, owners and contacts, clearly labelled. Their building numbers are invented, so quotes on them cannot be approved.
- **Map, building search and address search** use OpenStreetMap when the owner turns lookups on. They are **mocked in all automated tests**; the build environment had no access to the live services, so **live behaviour is unverified** (rate limits, real data quality, the Overpass query on real data). Floors, outlines and addresses are volunteer-mapped and may be missing or wrong. The app says so.
- **Dashboard and Pipeline maps** are simple schematics drawn from the leads' coordinates, with no map tiles, so those screens make no outside request.
- **County records live behaviour is unverified**: the build environment could not reach `gis.cuyahogacounty.gov`, so the field names, the land-use codes and whether the county allows requests from a web page (CORS) are untested against the real server. If it refuses, the answer is a plain “County lookup failed” and the Mac mini tool is the fallback. The county has no floor count or year built.
- **Owner / manager / decision-maker research** (other than the county lookup above) is a set of search links the owner taps (county parcel record, business registration, web search). Results are typed in by the owner and marked *You typed it*. No data provider is integrated.
- **Airspace** shows only the distance to the nearest *mapped* airport and a link to the FAA LAANC page. No airspace or flight-clearance service is integrated.
- **Email** is never sent by the app. A draft opens in the owner's mail app.
- **Prices**: none are built in. The owner types a rate per service in Settings.

**Not built**
- ⬜ Verified property-data providers (ownership, contacts, parcel data) and CRM sync
  - **Planned (owner): Seamless.ai** will supply emails and phone numbers for decision makers. Step 1 is importing the owner's own export (CSV) into existing property records: each contact tagged "Seamless.ai" with the date, never marked verified until the owner confirms, never overwriting something the owner typed. That needs no new outside request. A live connection is a new outside host: the owner approves it first and sees exactly what would be sent (a company name and address, never notes or prices).
  - **Planned (owner): Trellis** will transcribe calls so the app can understand each property better. Step 1 is attaching a transcript to the property's activity timeline (stored on the phone). Step 2 is a "what I heard" list the owner reviews (decision maker, timing, current vendor, objections, next step), each marked ✨ as a suggestion and added to the record only when the owner accepts it. Audio, if ever stored, goes in IndexedDB, never localStorage. A live link is a new outside host and needs the owner's approval first. Call-recording consent rules differ by state, so they should be checked before recording (this is not legal advice).
- ⬜ Airspace/LAANC integration, weather window planning
- ⬜ Multi-user accounts, cloud sync, team assignment
- ⬜ Search by **county** and **city** feeding the same Review deck, obstacle flags, worth-it tiers (need the owner's own numbers) and imagery: [SWIPE-REVIEW-PLAN](SWIPE-REVIEW-PLAN.md)
- ⬜ Planned (owner): Mac mini lanes: sharing between reps, local AI for outreach, call transcription (`docs/MAC-MINI.md`); My Field Day home and quote-from-the-request (`docs/ROADMAP.md`)
- ⬜ Customer-facing quote PDF, e-signature, invoicing
- ⬜ Push notifications and calendar integration
- ⬜ Voice notes (the quick-action button area is Call / Navigate / Note / Photo)
- ⬜ CI workflow (tests run locally with `sh tests/run-all.sh`)

## Needs review

1. **Real iPhone pass**: Safari and home-screen mode, safe areas, keyboard behaviour in dialogs, `mailto:` hand-off, Apple Maps links, photo picker.
2. **Live county pass**: Map → turn lookups on → open a building in Cuyahoga County → Contacts → “Look up county record”. Check the owner, units and area look right.
3. **Live OpenStreetMap pass**: turn lookups on and try a real search around a known service area. Check Overpass load, result quality, and the 8-mile airport check.
4. **Ranking weights**: the High/Medium/Lower rules (height, size, type, glass, nearness, how much is known) are a reasonable first guess. Product review welcome.
5. **Quote model**: price = owner's rate × floors × building edge (or flat/per-sq-ft units). Confirm this matches how IAI prices; only the owner can supply rates.
6. **Pipeline stages and wording**: Identified · Researching · Contacted · Qualified · Proposal · Negotiation · Won · Lost.
7. **Email wording and compliance**: the draft carries the owner's mailing address and an opt-out line. The owner should have the final wording reviewed.
8. **Third-party links**: Google search, Ohio business search (shown for Ohio addresses), NWS forecast, FAA LAANC page, Apple Maps. Each leaves the app only when tapped.
9. **Look and feel**: compare against the mockups; list differences that matter.

## Known limitations

- Data lives in one browser (localStorage + IndexedDB). Clearing Safari data erases it; use Settings → Export backup.
- Safari can evict storage for sites not added to the Home Screen; installing helps.
- Floors are often missing from OpenStreetMap; the search can include buildings with no floor count, flagged as unknown.
- Single user, single device.
- If a view blocks browser storage entirely (some private-browsing or embedded previews), nothing is kept between visits; the app says so and works in memory for that visit.
