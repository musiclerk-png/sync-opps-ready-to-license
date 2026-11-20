# Sync Opps. | Ready to License Catalog

Public website files for the limited **November 23, 2026** beta of the Sync Opps. Ready to License Catalog.

## November 20, 2026 frontend safeguards

- Public Catalog Feed is deployed as existing Web App version 4 using the same `/exec` URL. Six private Songs entries remain Hidden, no accepted beta members, no approved public staging records.
- Frontend `normalizeSong` rejects inquiry destinations other than the approved secure Tally form `https://tally.so/r/jeoYaE`, and requires the hidden `song_id` parameter to match the displayed catalog song ID. Eight synthetic malicious-link/valid-link cases passed.
- An already-open visible catalog tab now checks the live server feed at most once every 60 seconds, in addition to when the tab regains focus. Withdrawn songs are removed from the DOM when refreshed; the server independently blocks ineligible buyer inquiries. This is not instantaneous withdrawal across every browser or CDN.
- The refresh timer is suppressed in hidden tabs and the live site continues to fail closed (no static song fallback) when the feed cannot be retrieved. Seven synthetic timer/visibility tests passed.
- The source and test verification above are **not** a substitute for signed-out real-browser playback, eligible-member and rights-owner approvals, or positive delivery of a buyer inquiry. No synthetic song was inserted into the actual private catalog.

## November 20, 2026 backend hosting and buyer safety

- Managed MP3 previews now require the actual `res.cloudinary.com` HTTPS delivery hostname and a versioned `video/upload` asset path, along with the private approval, exact Cloudinary public ID and stored authorized reference. A path on an unrelated or lookalike website cannot pass either public-feed or buyer-routing validation.
- Existing Public Catalog Feed deployment was safely updated to **version 4** on the same Web App ID and URL through the Development Bridge, with live JSONP schema verification, backup, and no rollback. Beta + Buyer Intake source update independently completed with HEAD_VERIFIED and PASS; it did not create a new deployment.
- **27 synthetic feed and buyer eligibility cases** and **9 synthetic buyer-delivery and no-retry cases** passed in isolated Node tests. No real email was sent, and these cases do not establish real signed-out browser playback.
- [Catalog safety CI workflow](.github/workflows/catalog-safety.yml) was added to execute these test files when relevant code changes. The workflow definition has been committed; a successful GitHub Actions run has not yet been independently confirmed.
- [Release gates](docs/Beta_Release_Gates_Nov_20_2026.md) describe actual paid-member, split-owner, consent, browser playback, inquiry delivery and withdrawal evidence required before making the first real song public.

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

## Beta and buyer application processor (v1.1 installed, partial live intake verified)

- [Installed v1.1 processor source](backend/SyncOpps_Beta_Buyer_Intake_v1.1.gs).
- [Installed v1.1 safety and rollback guide](backend/README_Safety_Upgrade_v1.1.md).
- [First 40 application form](https://tally.so/r/YjGvPd).
- [Buyer licensing inquiry form](https://tally.so/r/jeoYaE), not yet linked to public song cards.
- The new private `Beta Applications (PRIVATE)` tab collects applications; **Beta 40** remains empty until authenticated owner approval and paid Patreon membership verification.
- This existing standalone Apps Script project already has the Tally API key and an installed trigger. A live beta application imported into the private Sheet and a controlled unpublished-song buyer inquiry was blocked as designed. Positive delivery to a verified licensed member is still untested. Do not reinstall v1.0 or create a duplicate trigger.

## Installed launch-safety upgrade v1.1 (initial checks passed)

Complete replacement code and rollback versions are retained in the existing DEV Drive folder and GitHub. On November 18, 2026, the owner installed v1.1 in the existing Public Catalog Feed and Beta + Buyer Intake Apps Script projects. The existing public Web app was updated to Version 2 and returned exactly an empty approved-song feed in the owner's browser. The beta intake dry run and subsequent time-based execution completed. Positive approved-song delivery and withdrawal are **not yet tested**:

- [Public Catalog Feed v1.1](backend/SyncOpps_PublicCatalogFeed_v1.1.gs)
- [Beta + Buyer Intake v1.1](backend/SyncOpps_Beta_Buyer_Intake_v1.1.gs)
- [Single installation and rollback guide](backend/README_Safety_Upgrade_v1.1.md)
- [20-case offline safety test](backend/tests/test_pub_buyer_v1.1.js)

The prepared v1.1 release enforces first-40 accepted beta slots until Jan 5, 2027, independently verifies each rights-owner row's consent to show names and shares, and matches public disclosures against approved underlying splits. It also blocks buyer routing on the same criteria. The owner installed the two replacement sources in the **existing** projects; the v1.0 versions remain available for rollback. All real titles are still Hidden pending paid membership, authority, per-owner disclosure consent and signed-out playable source verification. Do not change any private rights or member verification statuses just to make test songs appear.

## Development management

The master project development record is held in the private Google Doc `Sync Opps. Ready to License | Ongoing Development Document`. Site source is managed directly through the connected GitHub integration, without paid browser automation. Changes should be reviewed in small batches and published only when safe.

## Managed MP3 preview uploads (internal lifecycle test passed November 19, 2026)

- The existing member Tally form accepts optional authorized MP3 previews up to 10 MB per song. Files remain private in Tally until reviewed and separately hosted.
- The existing Catalog Intake v1.7 Apps Script has been installed with the Cloudinary Free Script Properties in its own private project. The separate one-time InternalMP3Preflight code was delivered through the newly commissioned Apps Script Dev Bridge.
- On November 19, an owner-authorized INTERNAL-only recording was successfully retrieved from private Tally, its MP3 signature checked, Cloudinary API authentication and 0% credit usage confirmed, and one temporary public upload tested (HTTP 206). Cloudinary returned `destroy: ok`, with the deleted URL later verified as HTTP 404. The test song remains Hidden with no public URL and no altered rights/member flags.
- This proves the internal MP3 upload and withdrawal **technical lifecycle only**. It does NOT certify a publicly approved real member listing, complete HTML5 browser playback, purchaser email delivery, or rights clearance.
- Security regression: A staged-only managed MP3 URL could pass legacy public-feed/buyer-routing validation without an active private hosting approval and matching Cloudinary Public ID. The exact installed baseline was patched and **22 synthetic Node.js regression cases passed**. GitHub holds the corrected source and [test suite](backend/tests/test_live_baseline_managed_mp3.js). Public Catalog Feed's existing version 2 `/exec` must remain active until a controlled same-deployment rollout and signed-out browser tests; newly staged source alone is not a public deployment.
- Normal DISCO share links remain held for review. Only owner-generated official DISCO embed URLs may become public players, after signed-out playback verification. Membership eligibility, all three independent ownership categories, per-owner public display consent, licensing approval and private inquiry routing are mandatory for public listing.
