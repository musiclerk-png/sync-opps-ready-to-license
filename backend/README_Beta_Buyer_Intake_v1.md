# Sync Opps. | Beta Applications and Buyer Inquiry Processor v1.0

**Status:** Source complete and offline safety tested. NOT installed, not authorized and no live email deliveries verified. The existing intake, removal and public feed Apps Script projects must remain unchanged.

## Purpose

One standalone Google Apps Script project, using the **free Tally API**, reads both existing Tally forms and writes to the EXISTING private Sync Opps. Catalog Database Google Sheet.

- First 40 paid-member beta applications: `https://tally.so/r/YjGvPd`
- Buyer licensing inquiries: `https://tally.so/r/jeoYaE`
- No paid connector, no Tally-to-Sheets integrations, no Carrd.
- No webhook, public web app or new Google Sheet.
- All data stays in the existing private Google Sheet. Buyer emails are sent directly to a member's registered licensing contact only after the song passes current publishing and eligibility gates.

## Existing private tabs

- **Beta Applications (PRIVATE)**, added in the Catalog Database. Contains private application intake and explicit owner approval fields.
- **Beta 40**. Contains exactly 40 numbered membership places; cannot be filled from a self-reported Tally form alone.
- **Members**, **Songs**, **Public Staging**, **Buyer Inquiries** are reused, not overwritten.

## Installation (one-time owner action)

1. Open [Apps Script](https://script.google.com/home), click **New project** and name it `Sync Opps Beta + Buyer Intake`.
2. Open the complete [`SyncOpps_Beta_Buyer_Intake_v1.gs`](./SyncOpps_Beta_Buyer_Intake_v1.gs) source and paste it into the new project's `Code.gs`, replacing the default content.
3. In [Tally Settings > API keys](https://tally.so/settings/api-keys), choose **Create API key**. Tally's API is free; this key has broad access to your Tally account. **Keep it private. Do not send it in chat or put it in GitHub.** Copy it immediately as it will not be shown again.
4. In Apps Script **Project Settings > Script properties**, add exactly:

   - `CATALOG_SHEET_ID`: your existing private Catalog Database spreadsheet ID (copy it from the Google Sheet's URL).
   - `TALLY_API_KEY`: the private Tally API key just created.

5. Save, select `syncOppsBetaBuyerDryRun`, click **Run** and authorize read access to Sheets and external HTTP requests. The dry run is READ ONLY: it does not send emails, change slots or process any submissions.
6. With no beta applications or buyer inquiries yet, expected log resembles:

   ```json
   {"mode":"READ ONLY (no writes, emails or slot assignments)","betaSubmissionsSeen":0,"betaUnprocessed":0,"buyerSubmissionsSeen":0,"buyerUnprocessed":0,"currentBetaAssigned":0,"errors":[]}
   ```

7. After reviewing one successful dry run, install exactly ONE time-driven trigger in this separate Apps Script project: function `syncOppsProcessBetaBuyer`, Head deployment, Minutes timer, Every 5 minutes. Do not execute this function manually; it rejects manual runs on purpose.
8. No Web app deployment is needed. No Tally Google Sheets integrations are needed.

## Beta member approval workflow

1. New applications are appended once, deduplicated by Tally submission ID and Patreon email.
2. A self-reported email/tier never proves active membership or authorization. The processor matches an existing Member ID against the private **Members** tab and checks `Membership Status=Active Paid`, paid tier and `Eligibility Verified On`.
3. On the new **Beta Applications (PRIVATE)** tab, confirm each candidate's real Patreon account and that the applicant controls the registered email. Set **Identity Verification = Verified** and **Admin Decision = Approve** only after those checks.
4. The next scheduled run assigns the first available unique slot in **Beta 40**, up to 40. The processor refuses duplicate allocations, and places excess qualified applicants on the waitlist.
5. Once an application reaches **Accepted** and has a verified member and unique slot in **Beta 40**, the existing scheduled processor can send a one-time transactional acceptance email with the position, music submission link and next steps. It also checks already-accepted applications that did not previously receive a notification.
6. **Sender lock:** the acceptance notification is permitted only when the *existing installable time trigger* runs as `syncoppsofficial@gmail.com` (`Session.getEffectiveUser().getEmail()`). Otherwise it logs `ACCEPTANCE_SENDER_BLOCKED` and sends nothing. A `replyTo` value or sender display name does not change the actual sender. Verify the trigger owner under the correct Google account before claiming email delivery; do not add duplicate triggers.
7. The private **Beta Acceptance Notices (PRIVATE)** tab records a unique application ID as `Attempted` *before* email submission, then marks `Sent` only if `MailApp.sendEmail()` returns successfully. A failure or interrupted execution must be investigated manually; it is never retried automatically. This conservative at-most-once safeguard prevents duplicates, but a `Sent` entry records API submission rather than proof of inbox delivery.
8. A real song still requires a separate member submission, rights/owner-consent review and explicit catalog publication approval. Beta admission does not publish audio.

## Buyer inquiry safety

- Only actual published/approved songs that also pass current Public Staging, ownership disclosures, playback status, authority review, membership eligibility and private contact consent can receive emails.
- A Tally hidden `song_id` is user-controlled and does not establish authorization. The processor resolves it against the private Songs record, ignores user-supplied artist/title for routing, and never sends to an email address from a buyer form.
- The member-designated licensing email remains private in **Members** and is not written to the public site.
- Intake is idempotent by unique Tally submission ID, with 3 inquiries per buyer per 24 hours, 20 per song per day, 10 outbound messages per run, and Gmail daily quota checks.
- The inquiry is written to the private **Buyer Inquiries** tab before any email is attempted. The system does not automatically retry a partially sent inquiry; operators investigate any `Pending` or `Failed` status instead of risking duplicate notifications.
- No published/approved songs currently exist, so an unexpected live buyer inquiry should be blocked, not delivered.

## Limits and verification still required

- 34 offline checks passed using mocked Apps Script, Tally and Google Sheets services. No live Tally API token, real buyer form submission, successful outbound email or real member acceptance has been tested yet.
- This script uses a polling interval, not an instant webhook. At 5-minute cadence, delivery is not instantaneous.
- The Tally API key is a powerful credential. Restrict Apps Script editing access and revoke/rotate the key if exposed.
- A real approved song and withdrawal must still be verified end-to-end before announcing song-publication automation as fully complete.
