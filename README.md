# Sync Opps. | Ready to License Catalog

Public website files for the limited **November 23, 2026** beta of the Sync Opps. Ready to License Catalog.

## Current status

**Development / prelaunch.** The website code and fail-closed live public feed configuration are committed. No song is publicly approved or listed yet. GitHub Pages is live and serving the buyer-facing site. Advance applications for the first-40 paid-member beta are open.

- `index.html`: buyer-facing searchable catalog and licensing information interface based on the owner-approved design.
- `catalog.json`: legacy empty static feed, not used by live mode. Currently `"songs": []`.
- `feed-config.json`: live mode enabled with the standalone read-only Apps Script Web app URL; no stale fallback on feed failure.
- Catalog rechecks the live feed after a visitor returns to an inactive browser tab (at most once per 60 seconds) to reduce stale withdrawn listings. A buyer inquiry is still independently blocked at the private server if publication or authority becomes invalid.
- Google Sheets is the **private** source of truth. Never publish the workbook, raw Tally responses, Patreon emails, contact-routing emails, private authority documentation, or admin notes.

## Live website and beta applications

- Live website: https://musiclerk-png.github.io/sync-opps-ready-to-license/
- Dedicated First 40 beta enrollment landing page: https://musiclerk-png.github.io/sync-opps-ready-to-license/beta/ (Patreon join + application CTAs).
- **Preferred browser-only player QA:** https://musiclerk-png.github.io/sync-opps-ready-to-license/qa/catalog-player.html . Official SoundCloud, Spotify, YouTube, Bandcamp, Apple Music and DISCO embeds/direct MP3 references are screened. The tool also offers TEST-ONLY Google Drive file-preview, Dropbox `raw=1` audio, and Untitled official iframe support to diagnose owner-provided links, **but these are not enabled in the production backend**. DISCO `s.disco.ac` Share URLs and Untitled `/library/track/` URLs are NOT embeddable players and require the respective official Embed codes. A custom artist track page is not a universal player. A player rendering without verified audio does not pass QA; never mark a song Approved/Published from these tool results.
- Legacy SoundCloud-only player QA remains at https://musiclerk-png.github.io/sync-opps-ready-to-license/qa/soundcloud-player.html . Both QA utilities remain outside the public site navigation.
- First 40 paid-member beta applications: https://tally.so/r/YjGvPd
- Existing paid members and new paid Patreon members may apply now. Beta begins November 23, 2026.
- Applications require Patreon eligibility and available capacity confirmation; application alone is not an accepted slot.
- **Permanent website platform: GitHub Pages. Carrd is not used for this project.**
- A custom domain may be added later through GitHub Pages DNS configuration without changing the hosting platform.

## Public listing contract

The website deliberately rejects any record unless `catalogStatus === "Published"` and `publicReview === "Approved"` and required playable-source and inquiry URLs are present. `catalog.json` must have:

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-11-18",
  "songs": []
}
```

Approved records may contain only consented public display data: song ID, title, artist display name, genre, mood/use tags, playback source and approved player URL, runtime, instrumental/explicit indicators, member-consented public composition/publishing/master shares and licensing restrictions, plus a **private buyer inquiry form URL** (never a raw email address). The code enforces an allowlist of supported player origins for Spotify, YouTube, Bandcamp, SoundCloud, Apple Music and DISCO, plus HTTPS-hosted MP3 audio. These players require signed-out, mobile and on-site verification individually. No full-length playback guarantee is implied.

**Important:** Live mode now reads a read-only, approved-only Apps Script feed from the private Sheet. Paused or withdrawn songs should be excluded on new page loads. This has not yet been proven with a real approved-to-withdrawn track and external playback. Keep all real songs hidden until that end-to-end test and buyer routing are verified.

## Beta conditions

- Beta limit: **40 verified eligible paid Patreon members**. Reserve capacity only after membership and unique applicant verification, with a single slot per member. Do not advertise unverified slot counts.
- Direct buyer-to-member/authorized-rightsholder licensing. No Sync Opps. commission; members retain 100% of their negotiated licensing fees.
- No guaranteed inquiries or licensing placements.
- Eligibility checks, rights authority, player usability and buyer routing must pass prior to any song being published.

## Operating intake forms

- Member song submission: https://tally.so/r/peo0gV (private eligibility and rights review)
- Song removal requests: https://tally.so/r/e5rybE (email-confirmed removal workflow)
- Buyer licensing inquiry: https://tally.so/r/jeoYaE is published with song, artist and Song ID visible from URL-prefilled hidden fields. Its Tally intake processor is installed and scheduled, but its positive email-delivery path is not yet proven; do not activate real song listings until approved routing is tested.

## Beta and buyer application processor (source prepared, not installed)

- [Complete Apps Script source](backend/SyncOpps_Beta_Buyer_Intake_v1.gs).
- [Installation and safety instructions](backend/README_Beta_Buyer_Intake_v1.md).
- [First 40 application form](https://tally.so/r/YjGvPd).
- [Buyer licensing inquiry form](https://tally.so/r/jeoYaE), not yet linked to public song cards.
- The new private `Beta Applications (PRIVATE)` tab collects applications; **Beta 40** remains empty until authenticated owner approval and paid Patreon membership verification.
- This standalone script uses Tally's free API. It still requires one new Apps Script installation plus a private Tally API key stored in Script Properties. No live Tally API processing or buyer email delivery has been verified yet.

## Installed launch-safety upgrade v1.1 (initial checks passed)

Complete replacement code and rollback versions are retained in the existing DEV Drive folder and GitHub. On November 18, 2026, the owner installed v1.1 in the existing Public Catalog Feed and Beta + Buyer Intake Apps Script projects. The existing public Web app was updated to Version 2 and returned exactly an empty approved-song feed in the owner's browser. The beta intake dry run and subsequent time-based execution completed. Positive approved-song delivery and withdrawal are **not yet tested**:

- [Public Catalog Feed v1.1](backend/SyncOpps_PublicCatalogFeed_v1.1.gs)
- [Beta + Buyer Intake v1.1](backend/SyncOpps_Beta_Buyer_Intake_v1.1.gs)
- [Single installation and rollback guide](backend/README_Safety_Upgrade_v1.1.md)
- [20-case offline safety test](backend/tests/test_pub_buyer_v1.1.js)

The prepared v1.1 release enforces first-40 accepted beta slots until Jan 5, 2027, independently verifies each rights-owner row's consent to show names and shares, and matches public disclosures against approved underlying splits. It also blocks buyer routing on the same criteria. The owner installed the two replacement sources in the **existing** projects; the v1.0 versions remain available for rollback. All real titles are still Hidden pending paid membership, authority, per-owner disclosure consent and signed-out playable source verification. Do not change any private rights or member verification statuses just to make test songs appear.

## Development management

The master project development record is held in the private Google Doc `Sync Opps. Ready to License | Ongoing Development Document`. Site source is managed directly through the connected GitHub integration, without paid browser automation. Changes should be reviewed in small batches and published only when safe.
