# Using a Mac mini with the field app

The phone app stays the tool in the rep's hand. A Mac mini does the heavy, slow, always-on work and hands the result to the phone as a file. Nothing here needs a server, and the phone makes no new outside request.

## Market scan (built)

`tools/market-scan.mjs` searches OpenStreetMap for the buildings around a place, ranks them with the same engine the app uses (`js/engine.js`), and writes a **market pack** file. Only a place, a radius and the building filters are sent. Never a lead, contact, price or note. It waits longer and retries, so big areas (a 3 mile radius in a dense city) finish where a phone search can time out.

### One-time setup
1. Install Node 18 or newer (`brew install node`, or the installer from nodejs.org).
2. Get the app files onto the Mac mini (`git clone` the repo, or download the ZIP from GitHub).
3. OpenStreetMap asks for a way to contact the user. Set it once: `export IAI_CONTACT="YOUR-EMAIL (your own address)"` (use your own address; do not commit it).

### Run one market
```
node tools/market-scan.mjs --address "1 Example Street, Sampletown" --miles 3 --out sampletown.json
```
Options: `--preset targets|hotels|apartments|offices|medical|commercial|highrise`, `--types hotel,apartments,office,medical`, `--min-levels 3`, `--unknown-levels yes|no`, `--lat/--lon` instead of `--address`, `--label "Name"`.
The screen prints the top 15 and where the file went.

### Run every market overnight
Keep a list **outside the repo** (copy `tools/markets.example.json`, one line per market):
```
node tools/market-scan.mjs --batch ~/iai/markets.json --out-dir ~/iai/packs
```
It pauses 15 seconds between markets to be polite to the free service. To run it every night at 2 AM, save this as `~/Library/LaunchAgents/com.iai.marketscan.plist` (change the paths) and run `launchctl load ~/Library/LaunchAgents/com.iai.marketscan.plist`:
```
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.iai.marketscan</string>
  <key>ProgramArguments</key><array>
    <string>/opt/homebrew/bin/node</string><string>/Users/you/iai-app/tools/market-scan.mjs</string>
    <string>--batch</string><string>/Users/you/iai/markets.json</string><string>--out-dir</string><string>/Users/you/iai/packs</string></array>
  <key>EnvironmentVariables</key><dict><key>IAI_CONTACT</key><string>YOUR-EMAIL (your own address)</string></dict>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>2</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>/Users/you/iai/scan.log</string><key>StandardErrorPath</key><string>/Users/you/iai/scan.log</string>
</dict></plist>
```

### Get it onto the phone
Put the pack in iCloud Drive or AirDrop it. On the phone: **Map → Recent searches → Import a scan file**. The app describes the scan first, then shows it (works with map lookups off). It does not touch any lead.

## Planned lanes (not built; each needs the owner's approval first)

All three need the phone to talk to the Mac mini (for example over Tailscale), which is a new outside request. Under `CLAUDE.md` that needs the owner's approval, and the app would show the exact request before sending, like the map lookups do.

- **Share between reps.** Today: Export a backup and Import it (whole-phone). Next step: a pack of one property's record (contacts, activity, quotes) that another rep imports and merges by property. Later: a small sync service on a Mac mini with each lead assigned to a rep.
- **Local AI for outreach.** A model running on the Mac mini (for example Ollama) drafts email and call-prep text from a property's own record. The rep sees the exact words sent to it, and every draft still needs the rep's approval. Nothing goes to a cloud AI service.
- **Call transcription.** Speech-to-text on the Mac mini (for example whisper.cpp) turns a recording into a transcript attached to the property, with "what I heard" ✨ suggestions the rep accepts. Trellis can replace this once its export format is known. Recording-consent rules apply and are the owner's call.
