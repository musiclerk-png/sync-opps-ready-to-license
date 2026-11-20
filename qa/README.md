# Sync Opps. Catalog QA tools

These pages are development diagnostics, not the public release catalog.

## Isolated first-member sandbox

[Open the browser-only beta member QA page](./beta-member-sandbox.html)

- Uses the first existing beta applicant's **QA-only assumed eligibility**, as documented in the separately copied private Google Sheets sandbox. Does not include the applicant's name, email, submission ID, or private rights details.
- Displays a synthetic ten-second local WAV test tone, not the applicant's audio or any copyrighted song.
- Shows three separate fictional owner categories: composition/songwriter 100%, publishing 100%, and master/sound recording 100%. These percentages are not added together and do not claim real rights verification.
- Buyer inquiry is captured **in the visitor's browser memory only** and never transmitted or emailed. The Tally inquiry URL is not used.
- Scenario selector exercises approved, unverified member, revoked beta invite, pending MP3 hosting, missing owner disclosure consent, paused song, and withdrawn song.
- A blocked or withdrawn scenario hides the listing, stops the audio player, revokes its local object URL, and makes the inquiry unavailable. Reset restores only the local simulation.
- No Google Sheets, Patreon, Cloudinary, Apps Script, live buyer routing, or other network APIs are invoked by this page. The HTML intentionally has a restrictive Content Security Policy, noindex directive, and no external assets.
- It is a visual simulation of the product experience, **not** proof that the real approved feed, production player, external embeds, live email routing or CDN withdrawal work in a signed-out session.

### Verified development browser checks

Tested using headless Chromium at desktop width 1365px and mobile width 390px on November 20, 2026.

All passed: initial listing, local audio playback, licensing information modal with independent 100% ownership categories, one simulated buyer inquiry with zero emails sent, immediate player stop/URL removal on withdrawal, reset, five other blocked scenarios, mobile width without horizontal overflow, zero external HTTP requests, and zero JavaScript exceptions.

The local test harness source can be manually exercised in Chromium or another modern browser. Do not enter real buyer details or real music-rights information into the form.

## Provider player prepublication tool

[Open the existing provider player tester](./catalog-player.html)

This separate tool tests real signed-out player compatibility when the actual song owner has authorized the preview link. It is not a publication approval or substitute for rights verification.

## Release decision

See [beta release gates](../docs/Beta_Release_Gates_Nov_20_2026.md). Production remains prelaunch: all real tracks Hidden; the real first beta application remains Declined/Unverified; only the independent QA database treats it as verified for test purposes.
