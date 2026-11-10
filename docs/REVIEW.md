# Reviewer's guide (Product Architect / QA)

Roles: **Claude** is the primary builder. **ChatGPT** is the independent product architect and QA reviewer. The **owner** decides and tries it on the phone. We coordinate through pull requests and these documents.

## Run it in two minutes

```sh
python3 -m http.server 8080        # open http://localhost:8080 at a phone width (390 px)
sh tests/run-all.sh test-out       # needs Node + Playwright/Chromium
```

The first launch shows **demonstration data** (invented). Clear it from the banner or Settings. Add `?demo=1` to bring it back.

## Try each claim

| Claim | How to try it | Expected |
|---|---|---|
| One property record everywhere | Open *Demo Tower One* from Dashboard, Leads and Pipeline | Same record, same notes, tasks, quotes |
| Editable + persistent | Property → Notes: save a note; Next actions: add one; Contacts: add one; reload the page | All still there |
| Stage changes | Property → bottom bar **Move to …**, or tap the stage pill; then Undo from the toast | Stage moves, Pipeline updates, history logged, undo restores |
| Nothing fabricated | Leads → **Add** → name + address only; open it | Owner "not known yet", no contacts, no value, no measurements, no airspace claim |
| Quote never guessed | Property → **Draft quote** on a hand-added lead | Total shows "—" until you type floors, building edge **and** a rate in Settings |
| Approval gate | Save the draft → **Prepare outreach** | "Include my quote" is disabled until you tap **Approve Q-0001 first**, read it, tick the box and Approve |
| Email never auto-sent | In the email draft, add an address → **Open in Mail** | Hands the draft to the phone's mail app; the app logs nothing until you tap **I sent it** (Undo available) |
| Demo can't be sent | Open a demo property → Draft quote → Approve & email | Refused with an explanation; Open in Mail is disabled |
| Outside requests are opt-in | Territory Map with lookups off; browser dev tools → Network | Nothing leaves the page. After **Turn on lookups**, only the three OpenStreetMap hosts, with the exact request shown first |
| Privacy | After a search, inspect the request text | A point, a radius and filters only |

## Where each requirement is proven

See the table in [STATUS.md](STATUS.md). Tests are named for what they prove; each failing assertion prints a sentence.

## Questions for the Product Architect

1. **Ranking**: are height, size, building type, glass, nearness and "how much we know" the right inputs for commercial drone window/facade cleaning? Anything missing (age of building, retail frontage, recent construction, HOA/condo vs. owner-occupied)?
2. **Quote model**: owner's rate × floors × building edge. Should add-ons (facade, inspection) use different drivers, such as facade area, or per-elevation pricing?
3. **Pipeline**: are eight stages right, and should *Qualified* require specific facts (decision maker known, access confirmed, airspace checked)?
4. **Verified data**: which provider would supply ownership and contacts, and what would the approval/consent step look like before any lead data leaves the phone?
5. **Airspace**: when we integrate, what must the app show before a flight is quoted or scheduled?
6. **Mockup fidelity**: list any differences from the shared screens that matter more than the palette.

## Review etiquette

Please comment on the pull request or add notes under `docs/reviews/` (the owner can paste them in if the connection cannot write). Point to a file and line where you can. The builder replies in the PR and updates `STATUS.md`.
