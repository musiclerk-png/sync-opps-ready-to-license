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


/**
 * Optional internal owner-triggered LIVE Cloudinary round-trip.
 *
 * Not called by the intake trigger or by the development bridge.
 * This deliberately makes a temporary PUBLIC Cloudinary URL for the
 * owner's own technical test MP3. Do NOT run without the owner's explicit
 * approval of that temporary public exposure. A successfully destroyed
 * asset can remain on CDN caches briefly while invalidation propagates.
 *
 * No Google Sheets or public feed writes; no member or rights bypasses;
 * no new triggers. Only PRIVATE Script Properties keep a recovery marker.
 */
const SO_INTERNAL_MP3_TEST = Object.freeze({
  submissionId:'NqjZQzQ',
  songId:'SONG-0F5A8037976169613EA5',
  pendingKey:'SO_INTERNAL_MP3_TEMP_ASSET_ID',
  deletedIdKey:'SO_INTERNAL_MP3_LAST_DELETED_ID',
  deletedUrlKey:'SO_INTERNAL_MP3_LAST_DELETED_URL'
});

function syncOppsInternalCloudinaryRoundTrip() {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(25000))throw Error('Another internal MP3 test is already running.');
  try {
    const props=PropertiesService.getScriptProperties();
    if(props.getProperty(SO_INTERNAL_MP3_TEST.pendingKey))
      throw Error('A previous temporary Cloudinary asset needs cleanup first. Run syncOppsInternalCloudinaryRecoverPending.');

    // This is strictly a technical test of the owner's Hidden internal sample.
    const ss=SpreadsheetApp.openById(SYNC_OPPS_CONFIG.spreadsheetId);
    const songs=syncOppsPreviewTable_(ss,'Songs');
    const matches=songs.rows.filter(s=>
      syncOppsPreviewC_(s,'Song ID')===SO_INTERNAL_MP3_TEST.songId &&
      syncOppsPreviewC_(s,'Tally Submission ID')===SO_INTERNAL_MP3_TEST.submissionId);
    if(matches.length!==1)throw Error('The internal test song must exist exactly once.');
    const song=matches[0];
    if(syncOppsPreviewC_(song,'Music Source')!=='Managed MP3 Preview' ||
       syncOppsPreviewC_(song,'Catalog Status')!=='Hidden' ||
       syncOppsPreviewC_(song,'Preview Host Authorization (PRIVATE)')!=='Pending' ||
       syncOppsPreviewC_(song,'Stream URL') ||
       syncOppsPreviewC_(song,'Authorized Embed Reference') ||
       syncOppsPreviewC_(song,'Preview Host Public ID (PRIVATE)'))
      throw Error('The test song is not Hidden, Pending, and unhosted. No upload attempted.');

    const raw=syncOppsPreviewTable_(ss,'Tally Raw Responses');
    const blob=syncOppsPreviewBlob_(raw,SO_INTERNAL_MP3_TEST.submissionId,1);
    syncOppsPreviewUsageGuard_();
    const auth=syncOppsPreviewCredentials_();
    const nonce=Utilities.getUuid().replace(/-/g,'').toLowerCase();
    if(!/^[a-f0-9]{32}$/.test(nonce))throw Error('Failed to generate valid unique preview ID.');
    const publicId=SYNC_OPPS_MP3_HOST.folder+'/preview_'+nonce;
    const timestamp=String(Math.floor(Date.now()/1000));
    const signature=syncOppsPreviewSign_({public_id:publicId,timestamp:timestamp},auth.secret);

    // Persist the exact future asset ID BEFORE the upload. If Apps Script stops
    // unexpectedly, the owner can run the separate recovery function.
    props.setProperty(SO_INTERNAL_MP3_TEST.pendingKey,publicId);
    props.deleteProperty(SO_INTERNAL_MP3_TEST.deletedIdKey);
    props.deleteProperty(SO_INTERNAL_MP3_TEST.deletedUrlKey);

    let uploadConfirmed=false,playbackStatus=null,destroyResult='',testError='',cleanupError='';
    try {
      const response=UrlFetchApp.fetch(
        'https://api.cloudinary.com/v1_1/'+encodeURIComponent(auth.cloud)+'/video/upload',
        {method:'post',payload:{file:blob,public_id:publicId,
           timestamp:timestamp,api_key:auth.key,signature:signature},
         muteHttpExceptions:true});
      if(response.getResponseCode()<200||response.getResponseCode()>=300)
        throw Error('Upload rejected, HTTP '+response.getResponseCode());
      const body=JSON.parse(response.getContentText());
      const url=String(body.secure_url||'');
      if(body.public_id!==publicId||body.resource_type!=='video'||
         body.format!=='mp3'||
         !url.startsWith('https://res.cloudinary.com/'+auth.cloud+'/video/upload/') ||
         !url.endsWith('/'+publicId+'.mp3'))
        throw Error('Cloudinary upload response identity or MP3 URL did not match expected asset.');
      uploadConfirmed=true;
      props.setProperty(SO_INTERNAL_MP3_TEST.deletedIdKey,publicId);
      props.setProperty(SO_INTERNAL_MP3_TEST.deletedUrlKey,url);

      // Use a small Range request to check unsigned, signed-out HTTP playback.
      // The real deployment must separately test actual HTML player playback.
      const playback=UrlFetchApp.fetch(url,{
        method:'get',headers:{Range:'bytes=0-1023'},
        muteHttpExceptions:true,followRedirects:false});
      playbackStatus=playback.getResponseCode();
      if(playbackStatus!==200&&playbackStatus!==206)
        throw Error('Unsigned preview range request failed, HTTP '+playbackStatus);
    }catch(e) {
      testError=String(e).slice(0,250);
    }finally{
      try {
        destroyResult=syncOppsPreviewCloudinaryDestroy_(publicId);
        if(uploadConfirmed && destroyResult!=='ok')
          throw Error('Cloudinary did not confirm deletion of a successfully uploaded asset.');
        props.deleteProperty(SO_INTERNAL_MP3_TEST.pendingKey);
      }catch(e){
        cleanupError=String(e).slice(0,250);
        // Never clear the pending ID if cleanup was not confirmed.
      }
    }

    const report={
      mode:'INTERNAL TEMPORARY CLOUDINARY ROUND-TRIP',
      songWasHidden:true,
      temporaryPublicUploadConfirmed:uploadConfirmed,
      unsignedMp3HttpStatus:playbackStatus,
      cloudinaryDestroyResult:destroyResult,
      assetRecoveryPending:!!props.getProperty(SO_INTERNAL_MP3_TEST.pendingKey),
      cdnInvalidationMayTakeMinutes:uploadConfirmed,
      songListingsPublished:0,
      spreadsheetWrites:0,
      newTriggersCreated:0,
      testError:testError||null,
      cleanupError:cleanupError||null
    };
    Logger.log(JSON.stringify(report));
    if(testError||cleanupError)
      throw Error('Internal Cloudinary round-trip did not pass. Read the sanitized report and check recovery marker.');
    return report;
  }finally{lock.releaseLock();}
}

/** Retry cleanup only for the exact private temporary preview ID recorded above. */
function syncOppsInternalCloudinaryRecoverPending() {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(25000))throw Error('Another internal MP3 test is running.');
  try {
    const props=PropertiesService.getScriptProperties();
    const id=String(props.getProperty(SO_INTERNAL_MP3_TEST.pendingKey)||'');
    if(!id){Logger.log('No pending temporary Cloudinary test asset.');return {pending:false};}
    if(!/^sync_opps_catalog_previews\/preview_[a-f0-9]{32}$/i.test(id))
      throw Error('Unexpected temporary asset recovery ID. No delete attempted.');
    const result=syncOppsPreviewCloudinaryDestroy_(id);
    if(result!=='ok'&&result!=='not found')
      throw Error('Cloudinary recovery deletion not confirmed.');
    props.deleteProperty(SO_INTERNAL_MP3_TEST.pendingKey);
    const report={recoveryPending:false,cloudinaryDestroyResult:result,cdnInvalidationMayTakeMinutes:true};
    Logger.log(JSON.stringify(report));
    return report;
  }finally{lock.releaseLock();}
}

/** Post-deletion CDN check. May need repeating after cache invalidation propagates. */
function syncOppsInternalCloudinaryVerifyPurge() {
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty(SO_INTERNAL_MP3_TEST.pendingKey))
    throw Error('Temporary asset cleanup still pending. Run recovery first.');
  const id=String(props.getProperty(SO_INTERNAL_MP3_TEST.deletedIdKey)||'');
  const url=String(props.getProperty(SO_INTERNAL_MP3_TEST.deletedUrlKey)||'');
  const cloud=syncOppsPreviewCredentials_().cloud;
  if(!/^sync_opps_catalog_previews\/preview_[a-f0-9]{32}$/i.test(id)||
     !url.startsWith('https://res.cloudinary.com/'+cloud+'/video/upload/')||
     !url.endsWith('/'+id+'.mp3'))
    throw Error('No valid prior deleted temporary test asset to verify.');
  const response=UrlFetchApp.fetch(url,{
    method:'get',headers:{Range:'bytes=0-1023'},
    muteHttpExceptions:true,followRedirects:false});
  const status=response.getResponseCode();
  const report={mode:'POST-DELETE CDN CHECK',httpStatus:status,
    unsignedAssetUnavailable:[401,403,404,410].includes(status),
    cacheMayStillBePropagating:[200,206].includes(status),
    spreadsheetWrites:0};
  Logger.log(JSON.stringify(report));
  return report;
}


/**
 * READ ONLY: member beta test song "Soul Pocket Groove".
 * No public upload, rights status change, spreadsheet write, email or trigger.
 * Temporary one-time private MP3 preflight prior to independent rights review.
 */
function syncOppsSoulPocketGroovePreflight() {
  const submissionId='jej0M1Q';
  const songId='SONG-F385434E4A218F46868E';
  const memberId='MEM-12216320AA80D27AD67C';
  const ss=SpreadsheetApp.openById(SYNC_OPPS_CONFIG.spreadsheetId);
  const songs=syncOppsPreviewTable_(ss,'Songs');
  const members=syncOppsPreviewTable_(ss,'Members');
  const beta=syncOppsPreviewTable_(ss,'Beta 40');
  const raw=syncOppsPreviewTable_(ss,'Tally Raw Responses');
  const matching=songs.rows.filter(r=>
    syncOppsPreviewC_(r,'Song ID')===songId &&
    syncOppsPreviewC_(r,'Tally Submission ID')===submissionId &&
    syncOppsPreviewC_(r,'Member ID')===memberId);
  if(matching.length!==1)throw Error('Soul Pocket Groove must exist once under its verified beta member');
  const song=matching[0];
  if(syncOppsPreviewC_(song,'Song Title')!=='Soul Pocket Groove' ||
     syncOppsPreviewC_(song,'Artist Display Name')!=='MacMc' ||
     syncOppsPreviewC_(song,'Music Source')!=='Managed MP3 Preview' ||
     syncOppsPreviewC_(song,'Catalog Status')!=='Hidden' ||
     syncOppsPreviewC_(song,'Preview Host Authorization (PRIVATE)')!=='Pending' ||
     syncOppsPreviewC_(song,'Authorized Embed Reference') ||
     syncOppsPreviewC_(song,'Stream URL') ||
     syncOppsPreviewC_(song,'Preview Host Public ID (PRIVATE)'))
    throw Error('Song is not in its original private pre-approval, unhosted state');
  const matchMember=members.rows.filter(r=>syncOppsPreviewC_(r,'Member ID')===memberId);
  if(matchMember.length!==1 ||
     syncOppsPreviewC_(matchMember[0],'Patreon Tier')!=='$10 Pro' ||
     syncOppsPreviewC_(matchMember[0],'Membership Status')!=='Active Paid' ||
     !syncOppsPreviewEligibility_(song,members,beta))
    throw Error('Paid-member and beta authorization did not verify');
  const media=syncOppsPreviewBlob_(raw,submissionId,1);
  const bytes=media.getBytes().length;
  const quota=syncOppsPreviewUsageGuard_();
  const report={
    mode:'SOUL POCKET GROOVE PRIVATE READ-ONLY PREFLIGHT',
    submissionId:submissionId,
    songId:songId,
    privateMp3ReadAndSignatureVerified:true,
    privateMp3Bytes:bytes,
    verifiedPaidBetaMember:true,
    hiddenAndUnhosted:true,
    cloudinaryAuthenticatedAndUnder80Percent:true,
    cloudinaryCreditsUsedPercent:quota.creditsUsedPercent,
    ownerRightsReviewStillRequired:true,
    publicUploadAttempted:false,
    songsPublished:0,
    spreadsheetWrites:0,
    emailsSent:0,
    newTriggersCreated:0
  };
  Logger.log(JSON.stringify(report));
  return report;
}
