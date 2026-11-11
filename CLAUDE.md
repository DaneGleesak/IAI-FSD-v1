# IAI Field Sales Dashboard: working rules

This app will be used in the field. Every change must keep the owner's saved data intact.

## Shape
- No framework, no build. Plain HTML/CSS/JS, classic `<script>` tags sharing global scope. Load order is fixed in `index.html`: engine → core → map → ui → work → leads → territory → dashboard → pipeline → settings → app.
- `sw.js` caches the app shell (network-first). **Bump `CACHE` in `sw.js` on every release** and add any new file to `ASSETS`.
- Outside requests: only the three OpenStreetMap hosts and the Cuyahoga County parcel server (`gis.cuyahogacounty.gov`, owner-approved: it gets one building's map position and nothing else), only after lookups are turned on and the exact request is shown, only via `fetchJSON` in `js/ui.js`. Never send a lead, contact, price or note. Add nothing else without the owner's approval.
- Netlify copies only app files into `dist/` (`netlify.toml`). `docs/` and `tests/` are never served.

## Hard rules
1. Never break saved data. New fields get defaults in `normalize()`; old saves and backups must still import.
2. Export/import must include any new data.
3. **Nothing made up**: no ownership, contact, price, flight clearance or building measurement unless a person typed it or a labelled source gave it. Rates default to null.
4. **Approval first**: quotes are drafts until the owner approves; only approved quotes enter an email; the app sends no email; demo data cannot be approved.
5. Demonstration data is invented, tagged `demo:true`, and labelled DEMO DATA wherever it shows.
6. No native `prompt`/`confirm`/`alert`: use `openDlg`, `askConfirm`, `toast`, `pickLead`.
7. Mobile first (iPhone Safari, home-screen app): safe areas, touch targets ≥ 40 px, no sideways scroll at 320 px, reduced motion.
8. Tone: calm operator. Private, plain, not gamified. ✨ marks anything inferred.
9. **The repository is public.** Never commit real prices, rates, phone numbers, emails, customer or lead data, backups, or the company's internal notes. Tests use invented companies and buildings. `tests/hygiene.js` checks this.

## Tests
`sh tests/run-all.sh test-out` before every push. Update `docs/STATUS.md` with any change to what is built.
