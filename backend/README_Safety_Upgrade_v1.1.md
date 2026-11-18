# Sync Opps. | Safe Launch Backend Upgrade v1.1

The two COMPLETE replacement Google Apps Script files in this package tighten the first-40 beta release rules. They do not publish any songs or change any Sheet data merely by being installed.

## Why this update exists

The live v1.0 public feed validates paid membership and manual public-staging approvals, but does NOT directly check whether a member holds an accepted first-40 beta slot. It also reads public writer/publisher/master disclosures only from staging and cannot independently verify that each underlying ownership entry approved public display.

v1.1 closes those gaps in BOTH the public feed and buyer-routing processor.

## Changes

1. Until January 5, 2027 at 12:00 AM Central, an eligible song must belong to exactly one member with an accepted slot in the existing Beta 40 tab. That slot must show Invite Status = Accepted and Eligibility Verified = Yes, and its Patreon email must match the verified Members entry. This is the approved 40-member beta access period.
2. On January 5, 2027, the beta-slot-only restriction expires for ALL current verified active paid Sync Opps. members, as previously announced publicly. Member paid eligibility, review, authority, playback, routing consent, and rights display safeguards remain fully enforced.
3. Each songwriter, publishing and master ownership row underlying a public song must have Approved for Public Display = Yes. Stage-disclosed names and percentages must match the private approved ownership entries, with shares totaling 100% per rights category. These flags are consent/publication records, not independent proof of copyright ownership or legal agency authority.
4. Duplicate public-staging song IDs fail closed. Buyer email routing uses the same beta and owner-display gates and validates authorized media-player hostnames.
5. Pausing or withdrawing a published song removes it from the NEXT read-only public feed response. An already-open visitor tab may continue showing previously loaded metadata until refreshed; buyer routing separately revalidates status when a submission is processed.

## Installation sequence (ONE update per existing project)

### A. Public Catalog Feed (the standalone deployed Web app)

- Open the EXISTING **Sync Opps Public Catalog Feed** Apps Script project, not a new one.
- Replace the entire Code.gs content with `SyncOpps_PublicCatalogFeed_v1.1.gs`. Save.
- Run `syncOppsPublicFeedDryRun` once. Expected: READ ONLY, approvedPublicSongs=0, errors=[]. This checks new tab/column access without altering records.
- Go to **Deploy > Manage deployments**, edit the EXISTING Web app deployment, select **New version**, and deploy. Keep the SAME /exec URL already referenced by GitHub Pages. Do not create an additional web app or time trigger.
- In a private browser tab, open the existing /exec URL and confirm `window.syncOppsApprovedFeedV1({"schemaVersion":1,"songs":[]});`.

### B. Beta + Buyer Intake (the standalone existing 5-minute scheduled processor)

- Open EXISTING **Sync Opps Beta + Buyer Intake** project, not a new one.
- Replace entire Code.gs with `SyncOpps_Beta_Buyer_Intake_v1.1.gs`. Save.
- Run `syncOppsBetaBuyerDryRun` once. Expected: READ ONLY, buyerSubmissionsSeen=1, buyerUnprocessed=0, betaSubmissionsSeen=1, betaUnprocessed=0, currentBetaAssigned=0, errors=[]. Do not send any test submissions.
- Its existing Head time trigger automatically runs updated source; do NOT create another trigger, and do NOT deploy a Web app.
- Open Executions and verify the next trigger completes without errors.

### Do NOT change

- Script Properties `CATALOG_SHEET_ID` and `TALLY_API_KEY` remain in their respective private projects. Never put them in GitHub.
- Existing Catalog Intake and Song Removal Apps Script projects, triggers and forms.
- Current private member, rights approval, ownership and song status records. Keep all songs Hidden pending real rights evidence, consent and playback verification.
- Existing GitHub Pages `feed-config.json`, which continues referencing the current public Web app URL.

## QA before real publication

The off-line Node.js suite `test_pub_buyer_v11.js` uses mock sheet data only, no private accounts, no network and no email. It passed 20 simulated cases including approved song visibility, paused/withdrawn suppression, missing beta slot, incomplete owner display consents, mismatched ownership percentages, invalid player hosts, inactive membership and blocked buyer routing. This does NOT replace a real signed-out player check, actual positive buyer email delivery or owner rights approval.

## Rollback

The original v1.0 scripts remain unchanged in existing GitHub `backend/` versioned paths. If the new source has a Google Apps Script runtime issue, use Deploy > Manage deployments to restore the earlier version of the PUBLIC FEED web app; in Beta + Buyer Intake replace the current Code.gs source with the previous v1.0 version. Do not weaken approval flags in the Sheets to bypass errors.
