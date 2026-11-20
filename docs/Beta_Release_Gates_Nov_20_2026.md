# Sync Opps. Ready to License | Beta Release Gates
**Updated:** November 20, 2026
**Status:** Prelaunch. Internal technical MP3 lifecycle passed. No real member track is currently approved for publication.

## Current connected-system snapshot
- **Catalog Songs:** Six records; six Hidden, zero Published.
- **Public Staging:** Three draft records. Zero have Final QA = Yes or Ready for Separate Public Export = Yes.
- **First 40 beta:** Zero accepted slots.
- **Tally beta form:** Published, one completed application. That application is Declined with Paid Eligibility Unverified and Identity Verification Pending. Do not reinterpret it as an approved member.
- **Tally buyer inquiry form:** Published, one synthetic/test submission in the private sheet recorded as Blocked. No verified buyer delivery yet.
- **Song removal:** One request Pending Verification. Do not treat it as owner-confirmed withdrawal.
- **Public Feed:** The existing /exec deployment version 4 passed the Development Bridge live JSONP verification on November 20. The Cloudinary URL host guard is active. No song was published. Buyer routing source was updated and hash-verified separately; confirm the final Drive audit before declaring that request complete.

## Gate 1. Real paid-member eligibility and beta admission
- Patreon membership email, tier, payment status and verified-on date have been checked against Patreon or direct owner-admin evidence, not the applicant's claim.
- One unambiguous member ID and one licensing contact with private inquiry-routing consent.
- Administrator verifies applicant identity and explicitly approves their Beta Applications (PRIVATE) row.
- Before January 5, 2027, the member occupies a single accepted, verified First 40 slot. Do not populate slots merely for software testing.
- No outreach or acceptance email is sent without owner-approved messaging.

## Gate 2. Music rights and display consent, per track
- Writer/composition ownership splits sum to **100% within writer category**.
- Publishing ownership splits sum to **100% within publishing category**.
- Master/sound recording ownership splits sum to **100% within master category**.
- These three category totals are **separate and never combined into 200% or 300%**.
- Each relevant rights owner grants permission for the claimed public ownership disclosure and approves or delegates the relevant licensing authority; restrictions and additional approvals remain explicitly recorded.
- One-stop or additional-approval claims have separate verification. The catalog cannot assume an artist's 100% claim alone proves every license can be approved.
- Final track review is Approved, rights status is valid, and member listing authorization is Yes.

## Gate 3. In-page player and audio hosting
- Only an owner-approved streaming player or authorized MP3 preview is used.
- For a managed MP3, private Preview Host Authorization is Approved Preview, the active Cloudinary public ID and the stored Authorized Embed Reference match, and the URL uses the real res.cloudinary.com video/upload/v123/...mp3 delivery pattern.
- Test a genuinely permissioned track in a *signed-out* browser, including play/pause/seek and desktop/mobile layouts. A successful HTTP 206 test alone does not prove HTML player behavior.
- SoundCloud, Spotify, YouTube, Bandcamp and Apple Music must use embeddable formats supported by the frontend and allow playback outside their home services. DISCO requires the owner's actual official embed, never an ordinary share URL.
- A withdrawn, deleted or expired preview must never fall back to an old Public Staging URL.

## Gate 4. Listing readiness and public feed
- Public Staging has correct Song ID, title, artist, source, genre, approved player URL, searchable metadata, and consented rights-owner lists with percentages.
- Final QA Check = Yes and Ready for Separate Public Export = Yes only after a human sign-off.
- Catalog Status is Published only after all eligibility, ownership and publication safeguards pass.
- Validate that the existing live Web App URL still returns approved JSONP with no private member emails, Tally attachment URLs, Script Properties or other credentials.
- Verify active search filters, Licensing Info modal, and track-specific buyer inquiry form on the real GitHub Pages site. Keep an all-hidden catalog empty and do not fabricate eligible records to make the page appear populated.

## Gate 5. Buyer inquiry routing and idempotence
- The public CTA points only to the official Tally buyer form and carries the exact selected Song ID.
- The backend independently rechecks current song, Public Staging, rights disclosures, beta eligibility, member consent, valid recipient email and per-buyer/per-song rate limits.
- Verify a real owner-authorized test inquiry is delivered only to the intended private licensing contact, Reply-To points to the buyer, and no private email appears on the public site.
- Verify a duplicate Tally submission cannot send a second email. If an email fails, mark Failed for human review, never blindly resend.
- Never use actual buyer or member contact information in synthetic QA fixtures.

## Gate 6. Pause, withdrawal and CDN deletion
- Owner identity/authority confirmation is required before processing an actual song withdrawal request.
- Once verified, the private song status is Paused or Withdrawn, the public feed suppresses it, open visible tabs refresh within about a minute, and the server blocks new inquiries immediately.
- For hosted MP3s, remove the active Cloudinary asset and verify the exact former URL no longer serves audio. Do not assume a deletion API response guarantees instantly purged CDN caches.
- Verify the catalog contains no retained obsolete player URLs. Keep an audit trail of original request, confirmation and removal status.

## Gate 7. Owner release decision
- Capture evidence of completed signed-out desktop and mobile playback, licensing information, one successful buyer inquiry and one authorized withdrawal.
- Owner explicitly approves the first real member track for public release. Do not mark generic synthetic test records or the internal song "Ominous Shadows" as eligible to satisfy a release gate.
- Until then, keep all real tracks Hidden, preserve the existing production deployment, and maintain a prelaunch status.
