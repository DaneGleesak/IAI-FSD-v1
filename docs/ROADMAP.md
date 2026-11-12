# Roadmap

Direction from the owner (design mockups as the visual reference, tailored to IAI): the **property research and sales tool** for IAI's reps, with outreach built in and quotes customized from the customer's request, using Mac minis where they help. No private data in this file: the repository is public.

## Order the owner picked
1. ✅ **Map-first search**: results right under the map, filters fold to one line, one-tap hotels / apartments / offices / medical, 3 mi radius. Also ✅ **Mac mini market scan** (`docs/MAC-MINI.md`).
2. ✅ **My Field Day home** (Simple by default): today at a glance, next stop with Call / Navigate / Note / Photo, today's route with straight-line miles, follow-ups due, "Scan for new opportunities". The number tiles, territory sketch and pipeline snapshot are switches. Not built: drive time (needs a routing service) and voice notes.
3. ✅ **Quote builder by service**: per-service lines from the rates the rep typed, with a **quote from the request** step: the rep pastes or types what the customer asked for, the app suggests scope (services, floors, frequency, dates) as ✨ proposals the rep accepts, and the draft still needs approval.

## Added since
- ✅ **County parcel records (Cuyahoga)**: tap-to-look-up owner, units, land use and building area for one building. Other counties come later, one at a time, each with the owner's approval of its host.

- ✅ **How much to show**: Simple / More / Everything switches, so screens start uncrowded and fill up as the taps become habit.
- ✅ **Swipe review** on the area search (slice 1). County and city search, obstacles and tiers are planned in `docs/SWIPE-REVIEW-PLAN.md`.

## Mockup ideas that fit as they are
Ranked list with Fit and Confidence; verified / unknown / estimated badges; Overview · Contacts · Services · Notes · Files tabs; IAI service fit with upsells (window, facade, pressure wash, roof, thermal, mapping, solar); operational checks (facade and glass, balconies, water, launch area, airspace "needs check"); eleven-stage pipeline.

## Mockup ideas that need the owner's approval or a real source (nothing is faked)
- Satellite map layer, building photos, weather chip: each is a new outside request.
- Fit and Confidence percentages: shown only as High / Medium / Lower with the reasons, never invented scores.
- Owner, manager, decision-maker: blank until a person types it or a labelled source (Seamless.ai import) gives it.
- Airspace: "needs check" with the FAA link. No clearance is ever claimed.

## Waiting on the owner
- The IAI logo, to settle colors (green in the mockups, navy / blue / cyan in the app).
- A target address for a first live test.
- How Seamless.ai and Trellis export (CSV columns, transcript format).
- Mac mini lanes in `docs/MAC-MINI.md`: sharing between reps, local AI, call transcription.
