# Data model

Everything is stored on the device. Nothing is sent anywhere unless the owner turns lookups on (see [Outside requests](#outside-requests)).

- `localStorage['iai-fsd-v1-state']`: the state described below (JSON).
- `localStorage['iai-fsd-v1-state-damaged']`: an unreadable save, kept untouched (never overwritten). The app opens empty and tells the owner.
- `localStorage['iai-fsd-v1-state-before-import']`: a copy of the previous state, kept when a backup is imported.
- IndexedDB `iai-fsd-files`, store `files` `{id, buf, mime, ts, size, name}`: photos and files. Never in localStorage. Photos are shrunk to at most 1600 px. They go into a backup only when the owner chooses.

Every field has a safe default in `normalize()`, so an older save always opens. The legacy name `leads` is still read.

## The canonical property record

`state.properties[]`: **one record per building.** Everything that belongs to a building hangs off it; no other list holds copies.

```
id, name, addr, lat, lon, cat            identity and place (cat: office, hotel, medical, apartments, education, retail, industrial, mixed…)
src       'map' | 'address' | 'manual' | 'demo'
demo      true on invented demonstration data
osm       OpenStreetMap id (so a building is never added twice)
stage     Identified · Researching · Contacted · Qualified · Proposal · Negotiation · Won · Lost
band, prio, why[]   ranking: High/Medium/Lower and the plain reasons (✨ inference); prio is the owner's override
bld       {levels, height, sqft, perimFt, glass, op(opening hours text), web, phone, email, airMi, airName, approx, outline[[lat,lon]], checked, src}
          map-derived numbers are estimates with a source; checked=true once the owner confirms them
f         {owner, mgmt, vendor, renewal}: each {v, st:'unknown'|'estimated'|'verified', src}
contacts[]  {id, name, title, email, phone, role:'decision'|'owner'|'manager'|'other', conf:''|'low'|'medium'|'high'|'verified', src}
ops       {launch, water, obstructions, glass}: 'Yes'|'Some'|'No'|'Not sure'|''  (site questions, unanswered until asked)
services[]  ids of services to offer here
estValue    the owner's own typed estimate (null if none)
events[]    {id, ts, type:'stage'|'touch'|'note'|'quote'|'update', text, from, to, how, by, init, ref}   the activity timeline
tasks[]     {id, text, due, done, ts, doneTs}                                                          next actions
notes[]     {id, text, ts}                                                                              field notes
quotes[]    {id, ref, ts, total, coreTotal, coreAllPriced, scope, note, stories, perimFt, text, status:'draft'|'approved', approvedTs, approvedBy, lines[]}
fileIds[]   ids in IndexedDB
```

How the pieces connect:

- **Stage** changes go through `setStage()`, which logs a `stage` event. `touchLead()` logs a `touch` and returns an undo; the first real touch moves Identified/Researching to Contacted.
- `init:true` events (a new lead's first event) never count as a touch, so a fresh lead shows *Not yet contacted*.
- **Value** (`leadValue`) is the latest quote's core total *only when every core line is priced*, else the owner's typed estimate, else nothing.
- A **quote** is saved as `draft`. `approved` is set only by the owner's tap in the approval dialog. `approvedQuote(l)` is the only quote an email may include.
- A **demonstration** property (`demo:true`) can never have a quote approved, and its email cannot be opened in Mail.

## Other state

```
settings   {lookups:{on, autoSend}, sender:{name, company, phone, email, address, blurb, optOut}, floorFt,
            services[{id, name, unit, rate, min, on, core, pitch…}], playbooks[]}
map        {view, pin, radius, crit, lens, offer[]}        what the Territory Map is showing
search     {last, runs[≤30], saved[≤60]}                   the last result list (candidates, not leads), recent and saved areas
counters   {quote}                                         Q-0001… never reused
route      {day, ids[]}                                    today's route, reset each day
ui         {tab, seeded, mapTab, pipeView, pipeFilter, leadSort, leadStage, showN, closed{}}
```

Rates default to `null`. **No price exists anywhere in the code.**

## Search results are not leads

A map search produces *candidates* in `search.last`. A candidate becomes a property only when the owner taps **Add to pipeline** (`commitTemp()`): stage Identified, first event `init:true`, every number from the map is an estimate sourced "OpenStreetMap, <date>", owner and contacts blank.

## Backup

`exportData(withFiles)` → `{app:'iai-fsd', v:1, ts, state, files?}`. `importData(text)` validates, keeps the previous state under `…-before-import`, restores files into IndexedDB, and returns `{ok, msg, leads}`.

## Outside requests

The app has one network function, `fetchJSON` in `js/ui.js` (`credentials:'omit'`, `cache:'no-store'`, no referrer except address search, where OpenStreetMap asks for the app's origin). `sw.js` ignores every cross-origin request.

| Host | When | What is sent |
|---|---|---|
| `tile.openstreetmap.org` | only while the Territory Map is open with lookups on | the tile coordinates being viewed |
| `overpass-api.de` | on tapping Search, after the exact request is shown | centre point, radius, filters |
| `nominatim.openstreetmap.org` | on tapping Go/Research, after the exact request is shown | the address typed |
| `gis.cuyahogacounty.gov` | on tapping “Look up county record”, after the exact request is shown | one building's map position (longitude, latitude) |

Plain links the owner taps (Call, Text, Email, Apple Maps, NWS forecast, FAA LAANC, web search, Ohio business search) are ordinary `<a>` links the phone opens; the app never fetches them. `tests/outside.js` and `tests/hygiene.js` enforce this.
