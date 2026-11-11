# Swipe review: the plan

Written for the owner's idea: search by **county** or by **city**, then go through the buildings one at a time with a swipe (the "Tinder" idea), **and keep the pin + radius area search**. This is the builder's own plan. No private data in this file: the repository is public.

## The idea in one line
Finding is cheap, deciding is slow. Put every building the app finds in front of the rep one card at a time, so each one gets a fast, honest answer: **Pursue**, **Investigate** or **Pass**.

## Built so far (slice 1, on the area search)
- **Review** opens from the Map results (“Swipe through (N)”) and from the Dashboard. Its tab stays lit under Map.
- One card at a time, best-ranked first. Swipe right = **Pursue**, left = **Pass**; the middle button = **Investigate**. Three big buttons and the arrow keys do the same, so swiping is never required.
- **Pursue** is the only choice that adds a lead (stage Identified, estimates labelled with their source). **Investigate** holds the building in its own pile. **Pass** keeps it, searchable, with an optional reason, and can be reconsidered.
- **Undo** after every choice. It removes a lead it made, but only while nothing has been done to that lead.
- A building already in the pipeline, or already decided, never comes up again, even after a new search.
- Every choice is saved with a copy of the building as it was, so it stays visible even when the search it came from is gone. Included in the backup.
- **How much to show** (Settings, or the “Show” button on Leads, the results and Review): Simple, More or Everything, or any single switch. Fresh installs start on Simple. Hiding never deletes anything.

## What the card shows, and what it never makes up
The card shows what the map says (outline, type, floors, size) and the ✨ reason for the rank. It does **not** show an owner, contact, price, tier or "good fit" score that nobody supplied. Floors are often missing on the map, so "floors unknown" is shown as such.

## Next slices (each is a separate pull request the owner can test)

### Slice 2: search by county and by city
- **Why it is different from the area search.** The area search asks the map for buildings near a pin. A county or city sweep asks for *many* more, so it needs a plan for size and speed.
- **City:** the rep types a city; the app finds its boundary on the map and searches the buildings inside it in tiles, one after another, with a progress line ("tile 4 of 12") and a clear "stopped early, here is what was covered" note. Runs on the phone.
- **County:** a county is too big for a phone in one go. Two ways, the owner picks:
  1. the **Mac mini** runs it overnight with the existing scan tool (`docs/MAC-MINI.md`) and the phone imports the finished pack, or
  2. the county's own parcel records supply the list of commercial parcels (owner, units, land use), and the map supplies the building shapes and floors. County records are complete where the map is patchy, and they have no floor count, so floors stay "unknown" unless the map or a person supplies them.
- **Same deck.** Whatever the source (pin and radius, city, county, a Mac mini pack), the results become the same Review deck.
- **Keep the area search exactly as it is.** City and county are new choices next to it, not replacements.

### Slice 3: obstacles and a short brief when you Pursue
- Obstacle flags with a state for each: **observed**, **suspected** or **unknown** (power lines near the roof, trees, no launch space, busy street, nearby airport). Only people mark "observed". Anything the app guesses is ✨ "suspected".
- The airport distance already in the app stays a distance, never a clearance.
- **Pursue** can open a one-screen brief: what to ask, who to find, the first next action.

### Slice 4: worth-it tiers (only with the owner's own numbers)
- A tier (A / B / C) only appears after the owner types the assumptions behind it: crew size, productivity, cost per crew hour, travel, setup, overhead. Until then every building says **Unrated**. Nothing is estimated for them.
- The tier is separate from the High / Medium / Lower fit band, and the rep can override it with a reason that is kept.
- A building that is blocked is never hidden by a high tier.

### Later
- **Photos.** Start with the rep's own photos on the card. Satellite or street imagery is a new outside request: it needs the owner's approval, and a key kept on a server, never in the app.
- **County owner on the card.** Already available one building at a time (tap "Look up county record"). A batch version for a whole deck needs the owner's go-ahead for the number of requests it makes.
- **Sharing between reps** and **local AI** wait for the Mac mini lane decisions.

## Decisions for the owner
1. **Pipeline stage names.** The app uses Identified · Researching · Contacted · Qualified · Proposal · Negotiation · Won · Lost. Your own flow may differ. Say the order you actually use and the app will follow it. Review does not depend on it: Pursue starts a lead at the first stage.
2. **County sweep:** Mac mini overnight, or county parcel records on the phone, or both.
3. **City sweep size:** which cities first, and how many buildings is "too many" for one sweep.
