# Sync Opps. Apps Script Development Bridge v0.1

**Status: built and locally syntax/safety tested. NOT yet installed, authorized, armed or executed against live Apps Script projects.** This bridge adapts the previously used FoundBuyer Drive-driven Apps Script API design while keeping all four existing Sync Opps. production projects intact.

## What it does

- One **standalone management project** called `Sync Opps Dev Bridge`, separate from the four existing production projects. Do not insert it into Catalog Intake and do not duplicate any of the four.
- Initially reads the four existing Apps Script projects through the official Google Apps Script API. It inventories named script files, SHA256 fingerprints and the existing Public Catalog Feed deployment.
- Writes `Sync Opps Dev Bridge Status.json` into the **existing private Sync Opps. Ready to License DEV Google Drive folder**. It does not copy full code or private Script Properties into the status.
- Installs at most one **DISARMED** one-minute management-project trigger. No production triggers, source code, versions, deployments, Cloudinary credentials, member records or public songs are changed by initial setup.
- Only after successful read-only review and an explicit owner call to `SO_bridgeArm`, accepts owner-owned and validated `READY` requests through that same existing Drive folder.
- Changes just one explicitly named `SERVER_JS` file in the pinned target project. All other files, including `appsscript.json`, are preserved. Source must be a specific immutable 40-character GitHub commit and the correct allowlisted backend path, with a matching SHA256.
- Checks the existing live file hash before modification, saves a complete pre-change private source/deployment snapshot, processes one bounded phase per trigger run, verifies HEAD afterward, and attempts safe rollback and disarm on failure.
- For **Public Catalog Feed only**, optional existing-deployment update creates a version and updates the **same** web app deployment and URL. This is not done for intake, removal, or beta/buyer scripts.
- Never creates a new production deployment or adds another production time trigger.

## One-time installation

1. In Google Apps Script, create **one separate** standalone project named `Sync Opps Dev Bridge`. Existing four production projects must remain unchanged. This management project is the only new Apps Script project needed.
2. Open [the bridge source](SyncOpps_Dev_Bridge_v0.1.gs), click **Raw**, copy everything into the management project's `Code.gs`, and save.
3. In Project Settings enable **Show appsscript.json manifest file in editor**. Replace the management project's `appsscript.json` with the **entire contents** of [this bridge manifest](SyncOpps_Dev_Bridge_appsscript.json). Save. The required scopes cover Drive, script.projects, script.deployments, external requests and the bridge trigger.
4. In the **management project only**, Project Settings > Script Properties, add exactly:
   - Property: `SO_BRIDGE_FOLDER_ID`
   - Value: the **folder ID from the existing** `Sync Opps. Ready to License DEV` Google Drive folder URL (the text after `/folders/`). Do not create a new Drive folder.
5. To use `script.googleapis.com` from an Apps Script project, associate the management project with an appropriate **standard Google Cloud project**, and enable **Google Apps Script API** there. In [Google Apps Script user settings](https://script.google.com/home/usersettings), enable **Google Apps Script API** for the authorized account. The user's earlier FoundBuyer bridge already required this setup. Changing the Cloud project of a working production script is NOT required or advised. [Google's API enablement instructions](https://developers.google.com/apps-script/api/how-tos/enable).
6. In the management project's function dropdown, run `SO_bridgeInstallReadOnly` once and authorize Google's requested permissions. The initial read-only inventory should populate the status file in the existing development Drive folder. The management bridge remains **DISARMED**.
7. **Stop and review its status file**. Confirm exactly one match each for:
   - Sync Opps Catalog Intake
   - Sync Opps Song Removal
   - Sync Opps Public Catalog Feed
   - Sync Opps Beta + Buyer Intake

   It should identify every current Script ID and Code SHA; the feed deployment must match the previously established canonical `/exec` URL. The bridge never reads secret Script Properties from production projects.

8. If Google Drive's script search fails to find one or more projects, add their existing Script IDs **only to this bridge's Script Properties**, using `SO_BRIDGE_TARGET_ID_INTAKE`, `SO_BRIDGE_TARGET_ID_REMOVAL`, `SO_BRIDGE_TARGET_ID_FEED`, and/or `SO_BRIDGE_TARGET_ID_BETA_BUYER`. Each fallback Script ID is checked via Apps Script API against that project's actual title. Run `SO_bridgeInstallReadOnly` again, and do not arm if any project remains missing or ambiguous.
9. **After** the owner and development operator review `Status.json` and confirm the four existing targets, run `SO_bridgeArm` exactly once. This arms only the single bridge trigger; it does not deploy anything. No further routine code pasting should be necessary.

## Future deployment queue format

The development operator saves a plaintext JSON file under the existing private folder named `Sync Opps Dev Bridge Request <request_id>.json`. This is a documented example, **not** a live request. Do not use this placeholder until the bridge's real status supplies the target Script ID, current code SHA, and deployed version.

```json
{
  "schema_version": 1,
  "request_id": "intake-update-20261119-001",
  "status": "READY",
  "action": "UPDATE_HEAD",
  "project": "intake",
  "target_script_id": "<CURRENT PINNED INTAKE SCRIPT ID>",
  "target_file": "Code",
  "expected_head_sha256": "<SHA256 REPORTED BY LIVE BRIDGE STATUS>",
  "github_commit": "<IMMUTABLE 40-CHARACTER COMMIT>",
  "repo_path": "backend/SyncOpps_Tally_Processor_v1.7.gs",
  "source_sha256": "<SHA256 OF SOURCE AT THAT COMMIT>",
  "approval": "APPROVED_SOURCE_CHANGE"
}
```

For a Public Catalog Feed source AND deployment update, change `project` to `feed`, `action` to `UPDATE_EXISTING_FEED`, choose the allowlisted feed file and source path, add `deployment_id` with the existing deployment ID and `expected_deployed_version` from the live status. The bridge verifies the canonical endpoint URL before and after deployment. No new deployment is allowed.

The worker reads a single oldest READY request and advances in phases on successive one-minute runs. It writes a private backup, result and status. A failed request is renamed as Failed and disarms the bridge. An unfinished rollback or an external code change requires manual review before rearming. Code changes are subject to owner approval and must never bypass member, rights or buyer safety rules.

## Scope restrictions and rollback

- **Never** insert Cloudinary API keys or other secrets into source, the public GitHub repository or Drive requests. Existing production Script Properties remain untouched.
- `InternalMP3Preflight` may be added to Catalog Intake through a separate allowlisted source path once the bridge is armed; it runs only when deliberately executed, and is **not** a reason to relax paid-member/publication gates.
- `removal` is inventoried now; its approved source must first exist at the allowlisted repository path before a removal code change can be requested.
- Do not change beta acceptance, private rights checks, Cloudinary authorization or publication statuses as part of a deployment bridge test.
- Rollback is best effort, with a saved snapshot. Source changes made concurrently by another operator are **not** overwritten automatically.
- The first 40 paid-member beta remains targeted for **November 23, 2026**, subject to actual safety validation. Broader eligible paid-member access remains planned for **January 5, 2027**.

**Important:** GitHub code and documentation alone do not provide Apps Script API authorization. The bridge becomes useful only after the owner completes installation, approves scopes and the read-only status passes.
