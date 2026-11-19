# Managed MP3 previews and DISCO embeds | November 19, 2026

## Current release state

- Existing member submission form: [Tally peo0gV](https://tally.so/r/peo0gV), published with optional 10 MB MP3 for Song 1 and conditional Song 2.
- Existing private Google Sheet: Songs AT:AV has private hosting authorization, CDN public ID and hosted update time.
- Full replacement for existing **Sync Opps Catalog Intake** Apps Script: [SyncOpps_Tally_Processor_v1.7.gs](SyncOpps_Tally_Processor_v1.7.gs), committed and syntactically checked. **Not yet installed** in live Apps Script.
- Source allowlists updated in [Public Catalog Feed v1.1](SyncOpps_PublicCatalogFeed_v1.1.gs), [Beta + Buyer Intake v1.1](SyncOpps_Beta_Buyer_Intake_v1.1.gs), and website index.html. The two v1.1 production Apps Script sources must still be updated, and only the existing public-feed deployment needs a new version.
- New MP3 attachment column not yet observed in the existing private Tally Raw Responses Sheet. The first actual upload will verify whether Tally updates this integration without reconnecting.
- No authorized MP3 has been uploaded to Cloudinary, played by a signed-out visitor or withdrawn. **No song has been approved or published.**

## Why two storage locations?

Tally's free file field collects one member-authorized MP3 up to 10 MB. This upload is a private submission, **not** the playable catalog file. Its signed storage URL must never enter the public feed or public GitHub source. See [Tally file upload documentation](https://tally.so/help/file-uploads).

After actual paid-member, first-40 beta, rights and preview consent verification, the owner may explicitly select **Approved Preview** in the existing private Songs Sheet. An Apps Script function then copies that owner-authorized preview to a dedicated public Cloudinary asset under an opaque identifier. Only a reviewed Cloudinary HTTPS audio URL can be used for a Managed MP3 Preview song in the updated public feed. All normal licensing rights and playback verification gates remain separate.

Cloudinary's Free plan has 25 combined monthly credits covering storage, bandwidth and processing. This is **not** infinite free hosting. Before each manual upload, the source checks Cloudinary's authenticated usage report and refuses to upload if usage cannot be verified or has reached 80% of free credits. Audio is Cloudinary's `video` resource type. Storage for 40 songs at the maximum 10 MB file size can reach roughly 400 MB, or 800 MB if all 40 upload two previews. Playback bandwidth is additional and counts against the quota. Do not enable a paid plan or add a payment method to expand usage without separate approval. [Cloudinary plans](https://cloudinary.com/pricing) and [credits](https://cloudinary.com/documentation/billing_and_plans).

## One existing-project installation, no duplicate triggers

1. Open the **existing** Google Apps Script project **Sync Opps Catalog Intake**. Replace the entire current `Code.gs` content with the entire latest linked `SyncOpps_Tally_Processor_v1.7.gs`. Save. Do not create a new Apps Script project or add a new trigger. The previously installed intake time trigger should remain unchanged.
2. In that project's private **Project Settings > Script Properties**, enter `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` from a verified **Cloudinary Free** environment. Never disclose the secret in ChatGPT, GitHub, a public file, the Tally form, or any Google Sheet.
3. Run `syncOppsPreviewSetupCheck` exactly once after installation. This is read-only. It reports whether the three private Songs columns exist, whether the two new raw-file columns have appeared, whether Cloudinary properties are present, and whether private managed previews are awaiting review. It does not upload, publish or email anything. Missing upload columns are expected until the first Tally submission using them.
4. Use the existing public-feed and Beta + Buyer Intake Apps Script projects to install the **complete latest v1.1 source files** linked above. Keep the Beta + Buyer time trigger unchanged. For **Public Catalog Feed only**, choose **Deploy > Manage deployments > Edit the existing web app > New version**. Preserve the already deployed `/exec` URL and `feed-config.json`. Do not create another deployment or trigger. Existing sources remain in GitHub for rollback.

## First real preview, only after lawful review

- Obtain one authorized member upload through the existing Tally form. A valid upload-only selection should appear as `Music Source=Managed MP3 Preview`, `Catalog Status=Hidden`, and `Preview Host Authorization (PRIVATE)=Pending` in Songs after the installed intake processor ingests the submission. **If not, examine the private Tally submission and integration status; do not manually expose the attachment URL.**
- Verify the member's paid Patreon status and first-40 acceptance. Independently verify the preview authorization and rights of everyone needed to make the audio publicly playable. Set `Rights Status=Verified` only based on actual evidence; confirm `Member Listing Authorization=Yes`. The song must remain Hidden until playback and disclosure QA. In **Songs AT**, change only the legitimately reviewed track to `Approved Preview`.
- Execute `syncOppsHostAuthorizedMp3Previews` in the **existing intake Apps Script project**. It uses the existing private raw record, reads one MP3 securely, requires the verified paid beta member, verified rights and explicit preview authorization, checks basic MP3 binary signature and 10 MB limit, checks free-plan usage, and uploads a public opaque-path MP3. The operation is bounded to 3 candidate songs per manual call and records CDN ID before publishing the player reference. Failed/partial writes try immediate CDN cleanup and retain a deletion marker where possible.
- Confirm **actual audio** plays for a signed-out visitor. A loaded player widget is insufficient. Complete approved member, writer/publisher/master ownership display consent, metadata and matching split QA, and the private buyer inquiry route before any song moves to Published.
- Confirm one legitimate positive buyer inquiry and one verified pause/withdrawal using owner-authorized material. Do not send a live artist test email without approval. Prior synthetic tests and the completed blocked negative inquiry do not need repetition.

## Withdrawal, safety and retention

The **existing** intake trigger calls the CDN revocation check on each run, even if intake processing fails. An existing hosted preview is deleted when its song is Paused, Withdrawn or Archived, its private hosting authorization is no longer Approved Preview, the member's paid/accepted status lapses during the beta gate, member listing consent is withdrawn, or rights verification is revoked. Deletion calls Cloudinary's signed API with CDN invalidation and clears its reference only after success. Invalidations can take time; public catalog and buyer routing also fail closed as soon as the private approval criteria fail. The **existing** Song Removal project remains responsible for identity verification.

The private original Tally attachment is **not automatically deleted** by the hosting code, because removing the original submission can destroy the audit trail. A separate retention/deletion decision is required for private source files after verified removal. Public listening previews are inherently accessible to visitors and potentially downloadable once hosted; do not market this as DRM or as keeping the approved preview private.

## DISCO track and playlist integration

DISCO supports official owner-controlled embed iframes: from **Track or Playlist > Share > Embed > Copy embed code**. A normal `https://s.disco.ac/...` share URL is a share page, **not** a player URL. In the existing [browser player QA](https://musiclerk-png.github.io/sync-opps-ready-to-license/qa/catalog-player.html), the owner or administrator can paste the official embed code and retrieve the normalized URL. The updated production code allows only official tenant `*.disco.ac/e/t/...`, `/e/p/...` or `/e/a/...` references, rejects ordinary share URLs, and retains the no-rights-bypass rules. A real owner-authorized DISCO embed still needs its signed-out audio test. DISCO embedded player activity does **not** generate DISCO Playlist Stats. [DISCO embed help](https://support.disco.ac/home/embedding-your-disco-content-on-external-sites).

## What has actually passed

The source was re-read from GitHub and parsed as JavaScript. Six newly focused offline checks passed for Tally-rich-hyperlink attachment retrieval, correct Cloudinary public ID, expected Cloudinary delivery URL, accepted paid beta eligibility, quota rejection at 80% and no duplicate upload. Earlier 13 targeted cases covered upload-only normalization, rejection of Tally bearer links in public player validation, accepted DISCO embeds and blocked DISCO share URLs. No real Cloudinary account/API session, legitimate upload, signed-out playback or production withdrawal has been verified.

**Deadline unchanged:** First 40 paid beta participants begin November 23, 2026, subject to actual eligibility; all eligible paid-member access is planned January 5, 2027. No Carrd and no duplicate infrastructure.
