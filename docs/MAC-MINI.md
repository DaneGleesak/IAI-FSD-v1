# Using a Mac mini with the field app

The phone app stays the tool in the rep's hand. A Mac mini does the heavy, slow, always-on work and hands the result to the phone as a file. Nothing here needs a server, and the phone makes no new outside request.

## Market scan (built)

`tools/market-scan.mjs` searches OpenStreetMap for the buildings around a place (or over a whole box, such as a county), ranks them with the same engine the app uses (`js/engine.js`), and writes a **market pack** file. Only a place, a radius and the building filters are sent. Never a lead, contact, price or note.

Why this matters: the free map servers are not built for daily field use and sometimes refuse a phone ("too many requests"). The Mac mini can ask slowly and politely overnight, and your phone then opens a finished file with no waiting and no outside request.

How it behaves: two requests per place (the buildings, then airport distances); after a "too many requests" answer that server is left alone for a minute; a busy main server is replaced by the backup (`overpass.private.coffee`); a server that runs out of time is not asked again, and the tool says to use a smaller area. It was tested against a stand-in server only: **the real servers could not be reached while building it, so run one small market first** and check the result looks right.

### One-time setup (about 10 minutes)
1. Install Node 18 or newer: go to nodejs.org, download the macOS installer, run it. (Or `brew install node` if you use Homebrew.)
2. Get the app files onto the Mac mini: on the repository page on GitHub press the green **Code** button, then **Download ZIP**, and unzip it. Remember the folder.
3. Open **Terminal**, type `cd ` (with a space), drag the unzipped folder onto the Terminal window, press Return.
4. OpenStreetMap asks for a way to contact whoever is searching. Type this once per Terminal window, with your own email: `export IAI_CONTACT="your-own-email"` (do not put it in the repo).

### Try one small market first
```
node tools/market-scan.mjs --address "1 Example Street, Sampletown" --miles 3 --out sampletown.json
```
It prints the top 15 and where the file went. Options: `--preset targets|hotels|apartments|offices|medical|commercial|highrise`, `--types hotel,apartments,office,medical`, `--min-levels 3`, `--unknown-levels yes|no`, `--lat/--lon` instead of `--address`, `--label "Name"`.

### Sweep a whole county or city (many small circles over a box)
1. On openstreetmap.org search for the county or city, press **Export**, and note the four numbers it shows (top, left, bottom, right).
2. The tool wants them as **south,west,north,east**, which is bottom, left, top, right:
```
node tools/market-scan.mjs --box 40.0,-83.1,40.1,-82.9 --miles 2 --label "Sampletown county" --out sampletown-county.json
```
It covers the box with overlapping 2-mile circles, asks for each one slowly (8 seconds apart), joins the results (a building seen twice is listed once), ranks everything, and keeps the best 400, which is as many as the phone holds. Up to 80 circles per sweep (`--max-tiles` to change); a bigger county takes a few runs, or a larger `--miles`. A circle that fails is skipped and named; the rest still arrive. Expect about 20 to 40 minutes: start it before bed.

### Run several markets overnight
Keep a list **outside the repo** (copy `tools/markets.example.json`, one entry per market or sweep):
```
node tools/market-scan.mjs --batch ~/iai/markets.json --out-dir ~/iai/packs
```
It pauses 15 seconds between markets. To run it every night at 2 AM, save this as `~/Library/LaunchAgents/com.iai.marketscan.plist` (change the paths) and run `launchctl load ~/Library/LaunchAgents/com.iai.marketscan.plist`:
```
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.iai.marketscan</string>
  <key>ProgramArguments</key><array>
    <string>/opt/homebrew/bin/node</string><string>/Users/you/iai-app/tools/market-scan.mjs</string>
    <string>--batch</string><string>/Users/you/iai/markets.json</string><string>--out-dir</string><string>/Users/you/iai/packs</string></array>
  <key>EnvironmentVariables</key><dict><key>IAI_CONTACT</key><string>your-own-email</string></dict>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>2</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>/Users/you/iai/scan.log</string><key>StandardErrorPath</key><string>/Users/you/iai/scan.log</string>
</dict></plist>
```

### Get it onto the phone
Put the pack in iCloud Drive or AirDrop it. On the phone: **Map → Recent searches → Import a scan file**. The app describes the scan first, then shows it (works with map lookups off). It does not touch any lead. Then swipe through it in **Review**.

## Planned lanes (not built; each needs the owner's approval first)

All three need the phone to talk to the Mac mini (for example over Tailscale), which is a new outside request. Under `CLAUDE.md` that needs the owner's approval, and the app would show the exact request before sending, like the map lookups do.

- **Share between reps.** Today: Export a backup and Import it (whole-phone). Next step: a pack of one property's record (contacts, activity, quotes) that another rep imports and merges by property. Later: a small sync service on a Mac mini with each lead assigned to a rep.
- **Local AI for outreach.** A model running on the Mac mini (for example Ollama) drafts email and call-prep text from a property's own record. The rep sees the exact words sent to it, and every draft still needs the rep's approval. Nothing goes to a cloud AI service.
- **Call transcription.** Speech-to-text on the Mac mini (for example whisper.cpp) turns a recording into a transcript attached to the property, with "what I heard" ✨ suggestions the rep accepts. Trellis can replace this once its export format is known. Recording-consent rules apply and are the owner's call.
