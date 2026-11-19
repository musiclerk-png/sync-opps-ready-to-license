/**
 * Sync Opps. | One-time internal MP3 preflight, November 19, 2026.
 * Add as a separate .gs FILE inside the EXISTING Sync Opps Catalog Intake
 * Apps Script project. Do not create another project, deployment or trigger.
 *
 * READ ONLY: validates the private Tally MP3 and real Cloudinary API access.
 * Does not upload, host, delete, email, publish or change any Google Sheet.
 * Remove this helper file after testing. Never log private Tally URLs or keys.
 */
function syncOppsInternalMp3Preflight() {
  const submissionId = 'NqjZQzQ';
  const expectedSongId = 'SONG-0F5A8037976169613EA5';
  const ss = SpreadsheetApp.openById(SYNC_OPPS_CONFIG.spreadsheetId);
  const songs = syncOppsPreviewTable_(ss, 'Songs');
  const matches = songs.rows.filter(s =>
    syncOppsPreviewC_(s, 'Song ID') === expectedSongId &&
    syncOppsPreviewC_(s, 'Tally Submission ID') === submissionId);
  if (matches.length !== 1)
    throw new Error('Internal test song not uniquely present in existing Songs tab.');
  const song = matches[0];
  if (syncOppsPreviewC_(song, 'Music Source') !== 'Managed MP3 Preview' ||
      syncOppsPreviewC_(song, 'Catalog Status') !== 'Hidden' ||
      syncOppsPreviewC_(song, 'Preview Host Authorization (PRIVATE)') !== 'Pending' ||
      syncOppsPreviewC_(song, 'Stream URL') ||
      syncOppsPreviewC_(song, 'Authorized Embed Reference') ||
      syncOppsPreviewC_(song, 'Preview Host Public ID (PRIVATE)'))
    throw new Error('Internal test song is not in the expected private, unhosted state.');

  // Read private Tally attachment; uses the existing 10 MB + MP3-byte checks.
  const raw = syncOppsPreviewTable_(ss, 'Tally Raw Responses');
  const mp3 = syncOppsPreviewBlob_(raw, submissionId, 1);
  const byteCount = mp3.getBytes().length;

  // Authenticated Cloudinary Admin API call; uses existing Free credit guard.
  // This is NOT an upload and does NOT exercise public streaming.
  const quota = syncOppsPreviewUsageGuard_();
  const report = {
    mode: 'INTERNAL READ-ONLY PREFLIGHT',
    submissionId: submissionId,
    hiddenSongVerified: true,
    privateMp3ReadAndSignatureVerified: true,
    privateMp3Bytes: byteCount,
    cloudinaryAuthenticatedAndUnder80Percent: true,
    cloudinaryCreditsUsedPercent: quota.creditsUsedPercent,
    publicUploadAttempted: false,
    songsPublished: 0,
    spreadsheetWrites: 0,
    newTriggersCreated: 0
  };
  Logger.log(JSON.stringify(report));
  return report;
}
