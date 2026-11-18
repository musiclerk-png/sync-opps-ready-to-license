# Sync Opps. Public Catalog Feed Bridge v1.0

**Development state: source installed, read-only dry run passed, public /exec URL provided, GitHub Pages live mode configured. Live web response and a real song withdrawal still require end-to-end verification.**

This is a deliberately read-only Google Apps Script Web app. It solves the main drawback of storing real song data in GitHub's static `catalog.json`: the public website can read the PRIVATE Google Sheets database through a strictly whitelisted, approved-only response and automatically hide Paused/Withdrawn tracks for **new requests**, without needing a GitHub update after every change.

The script contains **no passwords, tokens or private spreadsheet ID**. It may safely reside in the public repository, but access to the spreadsheet itself must remain private. A public feed inherently publishes ONLY reviewed, owner-consented public song metadata.

## One-time setup (owner)

1. Open https://script.google.com/home and choose **New project**. Name it **Sync Opps Public Catalog Feed**. Do **not** add the code to the existing Catalog Intake or Song Removal projects.
2. Copy the complete source from [SyncOpps_PublicCatalogFeed_v1.gs](./SyncOpps_PublicCatalogFeed_v1.gs) into the new project's `Code.gs` and save.
3. In **Project Settings > Script properties**, add `CATALOG_SHEET_ID` with the document ID from the existing private **Sync Opps. Ready to License | Catalog Database v1.0** Google Sheet. Save. **Never paste this ID into the public GitHub repository.**
4. Select `syncOppsPublicFeedDryRun` and click Run; grant permission to read the Sheet. With zero approved Public Staging entries, expected output is `{"mode":"READ ONLY","schemaVersion":1,"approvedPublicSongs":0,"errors":[]}` (with an explanatory note).
5. Choose **Deploy > New deployment > Web app**; **Execute as Me**, **Who has access: Anyone**. Copy the `/exec` URL and share it privately with the development operator.
6. The development operator will edit `feed-config.json` to `{"schemaVersion":1,"mode":"live","endpoint":"https://script.google.com/macros/s/.../exec"}` after the public response is independently checked.
7. No trigger is needed. Existing hourly intake and five-minute removal triggers are NOT changed.

## Security and publication gates

A song is returned only when ALL of the following are true:

- It appears exactly once in private Songs and is present in **Public Staging** with `Final QA Check=Yes` and `Ready for Separate Public Export=Yes`.
- Songs `Catalog Status=Published`, `Review Status=Approved`, explicit listing authorization, private buyer routing consent, and a reviewed Full Track or Preview Only in-page player.
- Supported rights disclosure and verified authority state. A 100% share total alone is not legal clearance.
- Linked member has `Membership Status=Active Paid`, `Patreon Tier=$5 Standard` or `$10 Pro`, an eligibility-verified date, and private inquiry-routing consent.
- Consented composition, publishing and master owners are supplied in Public Staging in a strict `Name 50%`-style format; all three must be present.
- Buyer inquiry URL points only to the approved Sync Opps Tally inquiry form `jeoYaE` with public `song_id` prefill, which is not yet published or routed.
- Player URL matches a supported HTTPS provider embed. Every real provider must pass a signed-out test.
- Content filtered out by any gate is **never** included in the output. An error yields an empty feed.

The website is now set to **live mode** in `feed-config.json`. The earlier static `catalog.json` remains empty and is not a fallback. In **live mode**, if the endpoint is unavailable, the website fails closed and shows zero songs; it **does not** fall back to a stale public JSON file.

A confirmed withdrawal updates the private Songs status. On subsequent requests, the feed omits that song immediately; no separate GitHub publication job is needed. Already-open browser sessions may continue to show previously loaded data until refreshed; members' underlying music providers remain independently controlled.

## Important remaining work

- Buyer Tally form `jeoYaE` is published, but the private inquiry receiving and routing path still needs completing before publishing real music.
- The Google Song Removal processor has already queued one test withdrawal and sent an email for identity verification; the test song remains Hidden until confirmation is clicked.
- Static GitHub Pages file publication and the site design are live, but real-song source playback is not certified.
- This bridge provides no administrative editing API and does not create an Apps Script source-code development bridge. Direct programming of Apps Script project source still requires Google Apps Script editor/authorized API actions.
