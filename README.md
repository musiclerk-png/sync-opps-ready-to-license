# Sync Opps. | Ready to License Catalog

Public website files for the limited **November 23, 2026** beta of the Sync Opps. Ready to License Catalog.

## Current status

**Development / prelaunch.** The website code and fail-closed live public feed configuration are committed. No song is publicly approved or listed yet. GitHub Pages is live and serving the buyer-facing site. Advance applications for the first-40 paid-member beta are open.

- `index.html`: buyer-facing searchable catalog and licensing information interface based on the owner-approved design.
- `catalog.json`: legacy empty static feed, not used by live mode. Currently `"songs": []`.
- `feed-config.json`: live mode enabled with the standalone read-only Apps Script Web app URL; no stale fallback on feed failure.
- Google Sheets is the **private** source of truth. Never publish the workbook, raw Tally responses, Patreon emails, contact-routing emails, private authority documentation, or admin notes.

## Live website and beta applications

- Live website: https://musiclerk-png.github.io/sync-opps-ready-to-license/
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
- Buyer licensing inquiry: https://tally.so/r/jeoYaE is published, but automatic contact routing is not connected or tested; DO NOT link it to any real song until delivery is verified.

## Beta and buyer application processor (source prepared, not installed)

- [Complete Apps Script source](backend/SyncOpps_Beta_Buyer_Intake_v1.gs).
- [Installation and safety instructions](backend/README_Beta_Buyer_Intake_v1.md).
- [First 40 application form](https://tally.so/r/YjGvPd).
- [Buyer licensing inquiry form](https://tally.so/r/jeoYaE), not yet linked to public song cards.
- The new private `Beta Applications (PRIVATE)` tab collects applications; **Beta 40** remains empty until authenticated owner approval and paid Patreon membership verification.
- This standalone script uses Tally's free API. It still requires one new Apps Script installation plus a private Tally API key stored in Script Properties. No live Tally API processing or buyer email delivery has been verified yet.

## Development management

The master project development record is held in the private Google Doc `Sync Opps. Ready to License | Ongoing Development Document`. Site source is managed directly through the connected GitHub integration, without paid browser automation. Changes should be reviewed in small batches and published only when safe.
