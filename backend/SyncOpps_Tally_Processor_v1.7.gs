/**
 * Sync Opps. Ready to License | Tally Submission Processor v1.7 (approved MP3 intake quarantine and owner-confirmed corrections)
 * Built for the EXISTING private catalog Google Sheet. No new Sheets or forms.
 * IMPORTANT: Installing this source does not create a trigger or publish tracks.
 * Keep the existing installed trigger. To update the existing Apps Script project,
 * replace its source, dry-run a new upload only, and do not create another trigger.
 */
const SYNC_OPPS_CONFIG = Object.freeze({
  spreadsheetId: '11lXX93sRVuya9B1HEsRNOOK8Rsjzp7ItkNoidsGRaqE',
  excludedSubmissionIds: ['EqRNax2', 'Yj6xAQ5'],
  rawTab: 'Tally Raw Responses',
  correctionTab: 'Intake Corrections (PRIVATE)',
  tabs: {
    members: 'Members', songs: 'Songs', writers: 'Writer Splits',
    publishers: 'Publishing Splits', masters: 'Master Splits',
    intake: 'Tally Intake', review: 'Review Log', qa: 'Split QA'
  },
  requiredConsentPrefix: [
    'Rights and Catalog Authorization (',
    'Participation Terms Acknowledgment (',
    'Contact and Privacy Acknowledgment ('
  ]
});

function syncOppsDryRun() {
  return syncOppsExecute_(true);
}

function syncOppsProcessIntake() {
  const outcome=syncOppsExecute_(false);
  // Reuse this existing trigger to revoke public CDN assets after verified
  // pause/withdrawal; public feed and buyer routing already fail closed.
  try { outcome.hostedPreviewWithdrawals=syncOppsRevokeHostedPreviews_(); }
  catch(e){ Logger.log('PREVIEW WITHDRAWAL CHECK FAILED: '+String(e)); }
  return outcome;
}

function syncOppsExecute_(dryRun) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw new Error('Another Sync Opps. intake run is underway.');
  try {
    const ss = SpreadsheetApp.openById(SYNC_OPPS_CONFIG.spreadsheetId);
    const repo = syncOppsLoadRepository_(ss);
    const raw = repo.raw;
    const report = {mode: dryRun ? 'DRY RUN (no writes)' : 'MANUAL PROCESS',
      scanned: 0, excludedTest: 0, accepted: 0, needsReview: 0,
      blocked: 0, skippedExisting: 0, correctionsApplied: 0, errors: []};
    for (let i = 1; i < raw.length; i++) {
      const response = syncOppsAssoc_(raw[0], raw[i]);
      const sid = syncOppsField_(response, 'Submission ID').trim();
      if (!sid) continue;
      report.scanned++;
      if (SYNC_OPPS_CONFIG.excludedSubmissionIds.includes(sid)) {
        report.excludedTest++;
        continue; // NEVER add test member/song/intake rows
      }
      try {
        const correctionResult = syncOppsApplyCorrections_(repo,response,sid);
        const prepared = syncOppsPrepare_(correctionResult.response);
        prepared.correctionCount = correctionResult.applied;
        const intakeId = syncOppsFindIntake_(repo, sid);
        if (!prepared.valid) {
          report.blocked++;
          if (!dryRun) syncOppsUpsertIntake_(repo, prepared, 'Needs Normalization', prepared.problems.join(' | '));
          Logger.log('BLOCKED ' + sid + ': ' + prepared.problems.join('; '));
          continue;
        }
        if (intakeId !== null) {
          const status = syncOppsReadStatus_(repo, intakeId, 'Processing Status');
          const noteIndex = repo.headers.intake.indexOf('Admin Notes (PRIVATE)');
          const note = noteIndex < 0 ? '' : String(repo.rows.intake[intakeId][noteIndex] || '');
          // A completed import can remain In Review while awaiting rights clearance.
          // Never rewrite it on a later run. A crashed/partial import has the
          // Needs Normalization status and can still resume missing child rows.
          const fullyImportedReview = status === 'In Review' &&
            note.startsWith('Import complete.') &&
            prepared.songs.every(s => syncOppsFindIndex_(repo, 'songs', 'Song ID', s.songId) >= 0);
          if (status === 'Processed' || fullyImportedReview) {
            report.skippedExisting++;
            continue;
          }
        }
        if (!dryRun) syncOppsImport_(repo, prepared);
        report.correctionsApplied += correctionResult.applied;
        report.accepted++;
        if (prepared.reviewIssues.length) report.needsReview++;
        Logger.log((dryRun ? 'PREVIEW ' : 'IMPORTED ') + sid + ' (' + prepared.songs.length +
          ' song(s)); issues: ' + (prepared.reviewIssues.join('; ') || 'none; manual approval still required'));
      } catch (e) {
        report.blocked++;
        report.errors.push({submissionId: sid, error: String(e)});
        Logger.log('ERROR ' + sid + ': ' + e.stack);
        if (!dryRun) {
          try { syncOppsUpsertIntake_(repo, {submissionId:sid, receivedOn:response['Submitted at'] || '',
            patreonEmail:syncOppsField_(response,'Patreon Membership Email'),
            memberId:'', songs:[], reviewIssues:[]}, 'Needs Normalization', 'Exception: ' + String(e)); }
          catch (logError) { Logger.log('Failed to log processing error: ' + logError); }
        }
      }
    }
    Logger.log(JSON.stringify(report));
    return report;
  } finally { lock.releaseLock(); }
}

function syncOppsLoadRepository_(ss) {
  const repo = {raw: null, corrections: [], sheets: {}, headers: {}, rows: {}};
  const rawSheet = ss.getSheetByName(SYNC_OPPS_CONFIG.rawTab);
  if (!rawSheet) throw new Error('Missing tab: ' + SYNC_OPPS_CONFIG.rawTab);
  // Tally mm:ss fields can be stored in Sheets as TIME serials. getValues() turns
  // them into 1899 Date objects; use visible strings for source answers instead.
  // Consent checks accept the resulting "TRUE" strings.
  repo.raw = rawSheet.getDataRange().getDisplayValues();
  if (!repo.raw.length) throw new Error('Raw response tab has no headers.');
  const correctionsSheet = ss.getSheetByName(SYNC_OPPS_CONFIG.correctionTab);
  if (!correctionsSheet) throw new Error('Missing private correction tab: ' + SYNC_OPPS_CONFIG.correctionTab);
  const correctionValues = correctionsSheet.getDataRange().getDisplayValues();
  const correctionHeaders = correctionValues[0] || [];
  const correctionColumns = ['Submission ID','Song Slot','Tally Field Label','Original Submitted Value','Corrected Value',
    'Confirmation Source','Confirmed Date','Apply Correction','Scope / Notes (PRIVATE)'];
  correctionColumns.forEach(h=>{if(!correctionHeaders.includes(h))throw new Error('Missing private correction header: '+h);});
  repo.corrections = correctionValues.slice(1).filter(r=>r.some(v=>String(v).trim())).map(r=>syncOppsAssoc_(correctionHeaders,r));
  const requiredRaw = ['Submission ID','Patreon Membership Email','Song 1: Title','Song 1: Streamable Music Link'];
  requiredRaw.forEach(x => {if (repo.raw[0].indexOf(x) < 0) throw new Error('Missing expected Tally raw header: '+x);});
  Object.keys(SYNC_OPPS_CONFIG.tabs).forEach(k => {
    const sheet = ss.getSheetByName(SYNC_OPPS_CONFIG.tabs[k]);
    if (!sheet) throw new Error('Missing destination tab: ' + SYNC_OPPS_CONFIG.tabs[k]);
    repo.sheets[k] = sheet;
    const data = sheet.getDataRange().getValues();
    repo.headers[k] = (data[0] || []).map(String);
    repo.rows[k] = data.slice(1);
    if (!repo.headers[k].length || !repo.headers[k][0]) throw new Error('Missing headers: '+k);
  });
  // Verify schema instead of silently using wrong column positions.
  const required = {members:['Member ID','Patreon Email (PRIVATE)'],
    songs:['Song ID','Member ID','Catalog Status','Review Status',
      'Claimed Clearance Route','One-Stop Authority Verification','One-Stop Agency Details (PRIVATE)'],
    writers:['Song ID','Writer Legal Name','Writer Ownership % (0-100)'],
    publishers:['Song ID','Publisher / Copyright Owner','Publishing Ownership % (0-100)'],
    masters:['Song ID','Master Owner','Master Ownership % (0-100)'],
    intake:['Tally Submission ID','Processing Status'],
    review:['Song ID','Action'],qa:['Song ID','Writer Total %']};
  Object.keys(required).forEach(k=>required[k].forEach(col=>{
    if (!repo.headers[k].includes(col)) throw new Error('Schema mismatch in '+k+': '+col);
  }));
  return repo;
}

function syncOppsAssoc_(headers, values) {
  // Tally can insert a replacement question beside an old field with the SAME
  // visible header. Preserve the single nonblank answer, regardless of order.
  // If both contain DIFFERENT nonblank answers, fail closed rather than guess.
  const o = {};
  headers.forEach((h, i) => {
    const key = String(h).trim();
    if (!key) return;
    const incoming = values[i] == null ? '' : values[i];
    if (!Object.prototype.hasOwnProperty.call(o, key)) {
      o[key] = incoming;
      return;
    }
    const previous = String(o[key]).trim();
    const current = String(incoming).trim();
    if (previous && current && previous !== current) {
      throw new Error('Conflicting values for duplicated Tally header: ' + key);
    }
    if (current) o[key] = incoming;
  });
  return o;
}
/**
 * Apply owner-confirmed intake DATA corrections in memory, never to Tally Raw Responses.
 * The correction log stores exact before/after evidence and an explicit YES flag.
 * This is NOT a legal rights, licensing agency, or publication approval.
 */
function syncOppsApplyCorrections_(repo, response, submissionId) {
  const allowedFields = [
    'Song 1: Publishers and Publishing Shares',
    'Song 1: Master Rights Owners and Shares',
    'Song 2: Publishers and Publishing Shares (if different)',
    'Song 2: Master Owners and Shares (if different)'
  ];
  const corrected = Object.assign({},response);
  const seen = new Set();
  let applied = 0;
  (repo.corrections || []).forEach(entry => {
    if (syncOppsField_(entry,'Submission ID') !== submissionId) return;
    const flag = syncOppsField_(entry,'Apply Correction').toUpperCase();
    if (flag === 'NO') return;
    if (flag !== 'YES') throw new Error('Correction must specify YES or NO for '+submissionId);
    const field = syncOppsField_(entry,'Tally Field Label');
    if (!allowedFields.includes(field)) throw new Error('Correction field not allowed for '+submissionId+': '+field);
    const slot = field.startsWith('Song 1:')?'1':'2';
    if (syncOppsField_(entry,'Song Slot') !== slot) throw new Error('Correction song slot mismatch: '+submissionId);
    if (seen.has(field)) throw new Error('Duplicate active correction: '+submissionId+' / '+field);
    seen.add(field);
    const original = syncOppsField_(entry,'Original Submitted Value');
    const replacement = syncOppsField_(entry,'Corrected Value');
    const source = syncOppsField_(entry,'Confirmation Source');
    const confirmed = syncOppsField_(entry,'Confirmed Date');
    if (!original || !replacement || !source || !/^\d{4}-\d{2}-\d{2}$/.test(confirmed))
      throw new Error('Incomplete owner-confirmed correction evidence for '+submissionId+' / '+field);
    if (syncOppsField_(response,field) !== original)
      throw new Error('Original Tally value changed; correction stopped for '+submissionId+' / '+field);
    const kind = field.includes('Publishers')?'Publisher':'Master';
    const parsed = syncOppsParseOwners_(replacement,kind);
    if (parsed.issues.length || Math.abs(syncOppsSum_(parsed.rows)-100)>0.001)
      throw new Error('Corrected ownership cannot be normalized as 100% for '+submissionId+' / '+field);
    corrected[field] = replacement;
    applied++;
  });
  return {response:corrected, applied};
}

function syncOppsField_(row, label) {
  const val = row[label];
  return (val == null ? '' : String(val)).trim();
}
function syncOppsConsent_(row, prefix) {
  // Older Tally checkbox column headers may remain after a label changes.
  // Accept the TRUE cell among matching consent columns, never the label alone.
  return Object.keys(row).some(k=>k.startsWith(prefix) &&
    (row[k] === true || String(row[k]).trim().toUpperCase() === 'TRUE'));
}
function syncOppsHasYes_(val) { return /^yes\b/i.test(String(val).trim()); }
function syncOppsSong1FullAuthority_(row, right) {
  // The existing Song 1 composition and master question TITLES were rewritten
  // to clarify one-stop clearance. Tally then renamed the raw export headers.
  // Handle both header versions, without treating a renamed YES as missing.
  const labels = right === 'composition' ? [
    'Song 1: Can you independently authorize 100% of the composition rights for one-stop clearance, either through ownership or authorization from all necessary rights holders, without additional approvals?',
    'Song 1: Can you authorize 100% of the composition rights?'
  ] : [
    'Song 1: Can you independently authorize 100% of the master recording rights for one-stop clearance, either through ownership or authorization from all necessary rights holders, without additional approvals?',
    'Song 1: Can you authorize 100% of the master recording?'
  ];
  // If two versions coexist in future, do not silently ignore an explicit NO.
  const answers = labels.map(x=>syncOppsField_(row,x)).filter(Boolean);
  return answers.length > 0 && answers.every(syncOppsHasYes_);
}

function syncOppsIsSecond_(value) {
  return /^(yes|add another|add a second)/i.test(String(value).trim());
}
function syncOppsParseTags_(v, limit) {
  const parts = String(v||'').split(/\s*,\s*|\s*;\s*/).map(x=>x.trim()).filter(Boolean);
  return {items:parts.slice(0,limit), overflow:parts.length>limit};
}
function syncOppsStableId_(prefix, raw) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(raw));
  return prefix + '-' + bytes.slice(0,10).map(x=>('0'+(x<0?x+256:x).toString(16)).slice(-2)).join('').toUpperCase();
}
function syncOppsParseOwners_(raw, kind) {
  const text = String(raw || '').trim();
  if (!text) return {rows:[], issues:[kind+' ownership details missing']};
  const parts = text.split(/(?:\r?\n|\s*;\s*|\s*\|\s*)+/).map(x=>x.trim()).filter(Boolean);
  const rows = [], issues = [];
  for (let p = 0; p < parts.length; p++) {
    // Do not invent percentages or co-owner splits from prose.
    const fields = parts[p].split(',').map(x=>x.trim());
    const percentMatches = parts[p].match(/(?:^|[^\d])(?:100|\d{1,2})(?:\.\d+)?\s*%/g) || [];
    const percentField = fields.find(x=>/^\d{1,3}(?:\.\d+)?\s*%$/.test(x));
    const amount = percentField == null ? NaN : Number(percentField.replace('%','').trim());
    const owner = fields[0] || '';
    if (!owner || !Number.isFinite(amount) || amount < 0 || amount > 100 || percentMatches.length !== 1) {
      issues.push(kind+' entry '+(p+1)+' could not be safely parsed: '+parts[p]);
      continue;
    }
    rows.push({owner:owner, pct:amount,
      extra:fields.filter((x,i)=>i>0 && x!==percentField)});
  }
  if (!rows.length) issues.push(kind+' ownership not structured; needs manual review');
  return {rows:rows, issues:issues};
}
function syncOppsSum_(rows) {
  return Math.round(rows.reduce((a,r)=>a+r.pct,0)*1000)/1000;
}
function syncOppsPrepare_(row) {
  const submissionId = syncOppsField_(row,'Submission ID');
  const email = syncOppsField_(row,'Patreon Membership Email').toLowerCase();
  const artist = syncOppsField_(row,'Artist / Band Display Name');
  const contactName = syncOppsField_(row,'Licensing Contact Name');
  const contactEmail = syncOppsField_(row,'Licensing Contact Email').toLowerCase();
  const receivedOn = row['Submitted at'] || '';
  const problems = [], reviewIssues = [];
  if (!artist) problems.push('Artist name missing');
  if (!/^\S+@\S+\.\S+$/.test(email)) problems.push('Patreon membership email missing/invalid');
  if (!contactName || !/^\S+@\S+\.\S+$/.test(contactEmail)) problems.push('Licensing contact missing/invalid');
  SYNC_OPPS_CONFIG.requiredConsentPrefix.forEach(x=>{
    if (!syncOppsConsent_(row,x)) problems.push('Required consent missing: '+x);
  });
  const wantsSecond = syncOppsIsSecond_(syncOppsField_(row,'Would you like to add a second song in this submission?'));
  const hasSecond = !!syncOppsField_(row,'Song 2: Title');
  if (wantsSecond && !hasSecond) problems.push('Second song selected but no Song 2 title');
  if (!wantsSecond && hasSecond) problems.push('Second song data present without second song selection');
  const memberId = syncOppsStableId_('MEM',email);
  const slots = wantsSecond ? [1,2] : [1];
  const songs = [];
  slots.forEach(slot=>{
    const pre = 'Song '+slot+': ';
    const title = syncOppsField_(row,pre+'Title');
    const genre = syncOppsField_(row,pre+'Genre');
    const provider = syncOppsField_(row,pre+'Streaming Platform');
    const link = syncOppsField_(row,pre+(slot===1?'Streamable Music Link':'Streaming Link'));
    const uploaded = provider === 'Upload authorized MP3 preview (up to 10 MB)';
    // Tally's signed attachment URL is a private bearer token and is intentionally
    // NOT copied to Songs.Stream URL, Public Staging, GitHub or the public feed.
    // The original Tally Raw Responses tab holds the attachment for owner review.
    const uploadField = syncOppsField_(row,pre+'Upload authorized MP3 preview');
    if (!title || !genre || !provider ||
        (uploaded ? (!uploadField || !!link) : !/^https:\/\/\S+$/i.test(link))) {
      problems.push('Song '+slot+': title, genre and one valid listening route are required; upload needs a private file and no link');
      return;
    }
    const mood = syncOppsParseTags_(syncOppsField_(row,pre+'Mood (choose up to 3)'),3);
    const uses = syncOppsParseTags_(syncOppsField_(row,pre+'Great For (choose up to 5)'),5);
    if (mood.overflow || uses.overflow) problems.push('Song '+slot+': too many Mood or Great For values');
    const sameRights = slot===2 && syncOppsHasYes_(syncOppsField_(row,'Song 2: Same composition and master owners and splits as Song 1?'));
    let writers, publishers, masters, sampleText, approvalText, restrictions;
    if (slot===1 || sameRights) {
      writers = syncOppsField_(row,'Song 1: Writers, Individual Shares, PRO and IPI');
      publishers = syncOppsField_(row,'Song 1: Publishers and Publishing Shares');
      masters = syncOppsField_(row,'Song 1: Master Rights Owners and Shares');
    } else {
      writers = syncOppsField_(row,'Song 2: Writers and Individual Shares (if different)');
      publishers = syncOppsField_(row,'Song 2: Publishers and Publishing Shares (if different)');
      masters = syncOppsField_(row,'Song 2: Master Owners and Shares (if different)');
    }
    if (slot===1) {
      sampleText = syncOppsField_(row,'Song 1: Samples / Interpolations / Third-party Material');
      approvalText = 'Composition: '+syncOppsField_(row,'Song 1: Required Co-writer / Publisher Approvals')+
        '; Master: '+syncOppsField_(row,'Song 1: Additional Master Approvals / Contact');
      restrictions = syncOppsField_(row,'Song 1: Licensing Restrictions / Exclusions');
    } else {
      sampleText = syncOppsField_(row,'Song 2: Samples, Restrictions and Approval Requirements');
      approvalText = sampleText; restrictions = sampleText;
    }
    // Same RIGHTS ownership does not imply equal restrictions or clearance on a different recording.
    const parsed = {writers:syncOppsParseOwners_(writers,'Writer'),
      publishers:syncOppsParseOwners_(publishers,'Publisher'),
      masters:syncOppsParseOwners_(masters,'Master')};
    const issues = [];
    if (uploaded) issues.push('MP3 uploaded to private Tally storage. Validate file bytes and permission, prepare a separate owner-approved public preview host, then verify signed-out playback. Never expose the Tally attachment URL.');
    Object.keys(parsed).forEach(k=>{
      issues.push(...parsed[k].issues);
      if (Math.abs(syncOppsSum_(parsed[k].rows)-100)>0.001) issues.push(k+' percentages total '+syncOppsSum_(parsed[k].rows)+'%, not 100%');
    });
    // Rights ownership and authority to grant licenses are separate facts.
    // New Tally questions state whether a member controls 100% directly,
    // claims a delegated one-stop mandate, or needs another owner's approval.
    // No claim automatically verifies legal clearance or causes publication.
    const authorityAnswer = syncOppsField_(row,pre+'One-Stop Licensing Authority');
    const agencyDetails = syncOppsField_(row,pre+'One-Stop Agency Authority Details (PRIVATE)');
    const verificationNotes = [];
    let clearanceRoute = 'Not Declared (Legacy)';
    let oneStopVerification = 'Not Claimed';
    const ownText = 'Yes, I own or directly control 100% of the composition and master rights';
    const agentText = 'Yes, I am authorized by all necessary rights holders to independently license 100% of both rights as a one-stop agent without further approval';
    const approvalTextOption = 'No, additional rights-holder approval is required';
    if (authorityAnswer === ownText) {
      clearanceRoute = 'Self-Controlled';
      oneStopVerification = 'Pending Review';
      verificationNotes.push('Self-controlled one-stop claim is pending independent verification');
    } else if (authorityAnswer === agentText) {
      clearanceRoute = 'Delegated One-Stop Agent';
      oneStopVerification = 'Pending Review';
      if (!agencyDetails || /^(none|no|n\/a|not applicable)$/i.test(agencyDetails)) {
        issues.push('Delegated one-stop authority details missing; identify mandate, scope and rights holders');
        oneStopVerification = 'Needs Information';
      } else {
        verificationNotes.push('Delegated one-stop agency claim pending verification of mandate and scope');
      }
    } else if (authorityAnswer === approvalTextOption) {
      clearanceRoute = 'Additional Approvals';
      oneStopVerification = 'Not Applicable';
      issues.push('Additional rights-holder approvals are required before clearance');
    } else if (authorityAnswer) {
      issues.push('Unrecognized one-stop authority declaration; requires manual review');
      oneStopVerification = 'Needs Information';
    } else {
      // Retain old responses exactly as legacy submissions. In particular,
      // a pre-v1.4 Song 2 with different owner splits must not be assumed
      // one-stop just because the shares add to 100%.
      if ((slot===1 || sameRights) &&
        (!syncOppsSong1FullAuthority_(row,'composition') ||
         !syncOppsSong1FullAuthority_(row,'master'))) {
        issues.push('Full composition/master authority not affirmed in legacy response');
      }
      if (slot===2 && !sameRights)
        issues.push('Legacy Song 2 authority not declared; individual manual verification required');
    }
    // Flag conflicting legacy Song 1 answers; do not silently override them
    // with a newer assertion of one-stop control.
    if (slot===1 && (clearanceRoute==='Self-Controlled' || clearanceRoute==='Delegated One-Stop Agent') &&
      (!syncOppsSong1FullAuthority_(row,'composition') ||
       !syncOppsSong1FullAuthority_(row,'master'))) {
      issues.push('New one-stop declaration conflicts with prior composition/master authority answers');
    }
    if (sampleText && !/^(none|no|n\/a|not applicable)$/i.test(sampleText)) issues.push('Third-party/restriction information requires review');
    if (restrictions && !/^(none|no|n\/a|not applicable)$/i.test(restrictions)) issues.push('Licensing restrictions require review');
    reviewIssues.push(...issues.map(i=>'Song '+slot+': '+i),
      ...verificationNotes.map(i=>'Song '+slot+': '+i));
    songs.push({slot, clearanceRoute, oneStopVerification, agencyDetails, verificationNotes,
      songId:syncOppsStableId_('SONG',submissionId+':'+slot),
      title, genre, provider:uploaded?'Managed MP3 Preview':provider, link:uploaded?'':link,
      duration:syncOppsField_(row,pre+'Duration (mm:ss)'),
      vocal:syncOppsField_(row,pre+'Vocal Type'),
      instrumental:syncOppsField_(row,pre+'Instrumental Version Available?'),
      explicit:syncOppsField_(row,pre+'Explicit Lyrics?'),
      isrc:syncOppsField_(row,pre+'ISRC (optional)'), iswc:syncOppsField_(row,pre+'ISWC (optional)'),
      mood:mood.items, uses:uses.items, parsed, issues, writers, publishers, masters,
      sampleText, restrictions, approvalText});
  });
  return {valid:!problems.length, problems, reviewIssues, submissionId, email, artist,
    contactName,contactEmail,website:syncOppsField_(row,'Artist Website (optional)'),
    receivedOn,memberId,songs};
}

function syncOppsSafe_(value) {
  if (value == null) return '';
  if (typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) return value;
  const s = String(value).replace(/\u0000/g,'').slice(0,45000);
  // Prevent spreadsheet formula execution from untrusted Tally text.
  return /^[\s]*[=+\-@]/.test(s) || /^[\t\r\n]/.test(s) ? "'"+s : s;
}
function syncOppsAdd_(repo, tab, map) {
  const hdr = repo.headers[tab];
  const row = hdr.map(k=>syncOppsSafe_(Object.prototype.hasOwnProperty.call(map,k)?map[k]:''));
  repo.sheets[tab].appendRow(row);
  repo.rows[tab].push(row);
  return repo.rows[tab].length-1; // zero-based within data rows
}
function syncOppsSetCell_(repo,tab,dataIndex,field,value) {
  const ci = repo.headers[tab].indexOf(field);
  if (ci<0 || dataIndex<0) throw new Error('Missing update field '+tab+'/'+field);
  repo.sheets[tab].getRange(dataIndex+2,ci+1).setValue(syncOppsSafe_(value));
  repo.rows[tab][dataIndex][ci] = syncOppsSafe_(value);
}
function syncOppsFindIndex_(repo, tab, field, val) {
  const ci=repo.headers[tab].indexOf(field);
  if(ci<0)throw new Error('Unknown lookup column '+tab+'/'+field);
  return repo.rows[tab].findIndex(row=>String(row[ci]).trim()===String(val).trim());
}
function syncOppsFindIntake_(repo,sid) {
  const i=syncOppsFindIndex_(repo,'intake','Tally Submission ID',sid);
  return i<0?null:i;
}
function syncOppsReadStatus_(repo,idx,field) {
  const ci=repo.headers.intake.indexOf(field);
  if (ci<0) throw new Error('Missing intake status column: '+field);
  return (repo.rows.intake[idx] && repo.rows.intake[idx][ci]) || '';
}
function syncOppsUpsertIntake_(repo, p, status, note) {
  const sid=p.submissionId;
  let idx=syncOppsFindIndex_(repo,'intake','Tally Submission ID',sid);
  const data={'Tally Submission ID':sid,'Received On':p.receivedOn,
    'Patreon Email (PRIVATE)':p.patreonEmail||p.email||'', 'Member ID':p.memberId||'',
    'Songs in Submission':p.songs.length, 'Form Version':'peo0gV (beta)',
    'Processing Status':status,'Processed On':new Date(),
    'Admin Notes (PRIVATE)':note};
  if(idx<0) idx=syncOppsAdd_(repo,'intake',data);
  else {
    ['Member ID','Songs in Submission','Processing Status','Processed On','Admin Notes (PRIVATE)'].forEach(f=>syncOppsSetCell_(repo,'intake',idx,f,data[f]));
  }
  return idx;
}
function syncOppsEnsureOne_(repo, tab, keyField, keyValue, values) {
  const exists=syncOppsFindIndex_(repo,tab,keyField,keyValue);
  if(exists>=0)return false;
  syncOppsAdd_(repo,tab,values);return true;
}
function syncOppsSplitValues_(songId,kind,r) {
  const base={'Song ID':songId,'Approval Required':'Unknown','Approval Confirmed':'No',
    'Approved for Public Display':'No'};
  if(kind==='writers')return Object.assign(base,{
    'Writer Legal Name':r.owner,'Writer Credit':r.owner,'Writer Ownership % (0-100)':r.pct,
    'PRO':r.extra[0]||'','IPI Number':r.extra[1]||''});
  if(kind==='publishers')return Object.assign(base,{
    'Publisher / Copyright Owner':r.owner,'Publishing Ownership % (0-100)':r.pct,
    'Publisher PRO':r.extra[0]||'','Publisher IPI':r.extra[1]||''});
  return Object.assign(base,{'Master Owner':r.owner,'Master Ownership % (0-100)':r.pct,
    'Label / Master Administrator':r.extra[0]||''});
}
function syncOppsEnsureSplits_(repo,kind,songId,ownerRows) {
  // Count-based comparison preserves repeated identical entries and heals partial imports.
  const hdr=repo.headers[kind], idCol=hdr.indexOf('Song ID');
  const target=ownerRows.map(r=>hdr.map(k=>syncOppsSafe_(syncOppsSplitValues_(songId,kind,r)[k]||'')));
  const rowSig=row=>JSON.stringify(row.map(x=>x instanceof Date?x.toISOString():x));
  const counts=new Map();
  repo.rows[kind].filter(row=>String(row[idCol])===songId).forEach(row=>{
    const sig=rowSig(row);counts.set(sig,(counts.get(sig)||0)+1);
  });
  target.forEach((row)=>{
    const sig=rowSig(row),count=counts.get(sig)||0;
    if(count>0)counts.set(sig,count-1);
    else syncOppsAdd_(repo,kind,syncOppsAssoc_(hdr,row));
  });
}
function syncOppsImport_(repo,p) {
  // First record marks an import as in progress. A failed run can be retried safely.
  syncOppsUpsertIntake_(repo,p,'Needs Normalization','In progress; do not treat as published');
  syncOppsEnsureOne_(repo,'members','Member ID',p.memberId,{
    'Member ID':p.memberId,'Patreon Email (PRIVATE)':p.email,
    'Artist / Band Display Name':p.artist,'Licensing Contact Name':p.contactName,
    'Licensing Email (PRIVATE)':p.contactEmail,'Buyer Contact Method (Private)':'Private Inquiry Form',
    'Inquiry Routing Consent (Private)':'Yes','Patreon Tier':'',
    'Membership Status':'Unverified','Artist Website':p.website,
    'Created On':new Date(),'Updated On':new Date(),
    'Admin Notes (PRIVATE)':'Member submitted via Tally. Paid membership not independently verified.'});
  p.songs.forEach(s=>{
    const needs=s.issues.length>0;
    syncOppsEnsureOne_(repo,'songs','Song ID',s.songId,{
      'Song ID':s.songId,'Member ID':p.memberId,'Tally Submission ID':p.submissionId,
      'Preview Host Authorization (PRIVATE)':s.provider==='Managed MP3 Preview'?'Pending':'',
      'Submitted On':p.receivedOn,'Song Title':s.title,'Artist Display Name':p.artist,
      'Genre':s.genre,'Music Source':s.provider,'Stream URL':s.link,
      'Duration mm:ss':s.duration,'Vocal Type':s.vocal,'Instrumental Available':s.instrumental,
      'Explicit Lyrics':s.explicit,'ISRC':s.isrc,'ISWC':s.iswc,
      'Mood 1':s.mood[0]||'','Mood 2':s.mood[1]||'','Mood 3':s.mood[2]||'',
      'Great For 1':s.uses[0]||'','Great For 2':s.uses[1]||'',
      'Great For 3':s.uses[2]||'','Great For 4':s.uses[3]||'',
      'Great For 5':s.uses[4]||'',
      'Samples / Third-Party Material':s.sampleText,
      'Licensing Restrictions':s.restrictions,
      'Member Listing Authorization':'Yes',
      'Playback Status':'Not Tested',
      'Rights Status':needs?'Needs Clarification':'Member Supplied',
      'Review Status':needs?'Needs Information':'Under Review',
      'Catalog Status':'Hidden','Private Inquiry Routing Consent':'Yes',
      'Claimed Clearance Route':s.clearanceRoute,
      'One-Stop Authority Verification':s.oneStopVerification,
      'One-Stop Agency Details (PRIVATE)':s.agencyDetails,
      'Updated On':new Date(),
      'Admin Notes (PRIVATE)':'Normalized ownership strings (owner-confirmed intake corrections may apply). Writer: '+s.writers+
        '; Publisher: '+s.publishers+'; Master: '+s.masters+
        '; Additional approval details: '+s.approvalText+
        '; Claimed route: '+s.clearanceRoute+
        '; One-stop authority verification: '+s.oneStopVerification+
        '; Owner-confirmed intake corrections applied: '+(p.correctionCount||0)+
        '; Agency authority scope (PRIVATE): '+s.agencyDetails+
        '; Review issues: '+(s.issues.join(' | ')||'Manual rights/identity verification still required.')+
        '; Review notes: '+s.verificationNotes.join(' | ')});
    Object.keys(s.parsed).forEach(k=>syncOppsEnsureSplits_(repo,k,s.songId,s.parsed[k].rows));
    const total=(kind)=>syncOppsSum_(s.parsed[kind].rows);
    const good=(kind)=>s.parsed[kind].issues.length===0 && Math.abs(total(kind)-100)<=.001;
    syncOppsEnsureOne_(repo,'qa','Song ID',s.songId,{
      'Song ID':s.songId,
      'Writer Total %':total('writers'),'Writer Check':good('writers')?'PASS':'REVIEW',
      'Publisher Total %':total('publishers'),'Publisher Check':good('publishers')?'PASS':'REVIEW',
      'Master Total %':total('masters'),'Master Check':good('masters')?'PASS':'REVIEW',
      'Rights QA Note':'Arithmetic only; not proof of legal rights clearance. Claimed route: '+
        s.clearanceRoute+'; authority: '+s.oneStopVerification+'; '+s.issues.join(' | ')});
    const hasReview=repo.rows.review.some(r=>String(r[repo.headers.review.indexOf('Song ID')])===s.songId &&
      String(r[repo.headers.review.indexOf('Action')])==='Tally Import');
    if(!hasReview)syncOppsAdd_(repo,'review',{
      'Logged On':new Date(),'Song ID':s.songId,'Member ID':p.memberId,
      'Action':'Tally Import','Status Before':'','Status After':needs?'Needs Information':'Under Review',
      'Reviewed By':'Automated Intake','Evidence / Notes (PRIVATE)':
        'NOT APPROVED FOR PUBLICATION. Claimed route: '+s.clearanceRoute+
        '; verification: '+s.oneStopVerification+
        '. Membership, playback, licensing authority and private inquiry routing require manual review.'});
  });
  syncOppsUpsertIntake_(repo,p,p.reviewIssues.length?'In Review':'Processed',
    'Import complete. '+p.songs.length+' song(s). Catalog Status is Hidden. Owner-confirmed intake data corrections: '+(p.correctionCount||0)+'. '+
    (p.reviewIssues.length?p.reviewIssues.join(' | '):'Manual member/rights/playback approval still required.'));
}


/* ==========================================================================
 * Approved MP3 Preview Host Bridge | Cloudinary Free Plan | November 18 2026
 * Add to the EXISTING Sync Opps Catalog Intake Apps Script project, not a new
 * project or trigger. Tally uploads remain private until explicit admin review.
 * Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in
 * this existing project's Script Properties. NEVER put credentials in Sheets.
 *
 * MP3 file source: the private Tally Raw Responses tab ONLY.
 * Public CDN URL: Songs.Authorized Embed Reference ONLY after approval.
 * Cloudinary asset ID: Songs.Preview Host Public ID (PRIVATE).
 * Admin decision: Songs.Preview Host Authorization (PRIVATE) must equal
 * "Approved Preview" after actual member rights and preview consent review.
 *
 * One-click manual Apps Script function for hosting:
 *   syncOppsHostAuthorizedMp3Previews
 * Existing intake trigger checks confirmed pause/withdrawal and revokes files:
 *   syncOppsProcessIntake -> syncOppsRevokeHostedPreviews_
 * This is a software bridge, NOT proof of a functioning live Cloudinary account.
 * ==========================================================================
 */
const SYNC_OPPS_MP3_HOST = Object.freeze({
  folder: 'sync_opps_catalog_previews',
  maxBytes: 10 * 1024 * 1024,
  stagingBatchMax: 3,
  betaAccessEndUTC: '2027-01-05T06:00:00Z'
});
function syncOppsPreviewTable_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error('Missing existing private sheet: '+name);
  const values = sh.getDataRange().getDisplayValues();
  const h = (values[0]||[]).map(String);
  return {sheet:sh,headers:h,rows:values.slice(1).map(v=>syncOppsAssoc_(h,v))};
}
function syncOppsPreviewC_(row,key) { return String((row||{})[key]||'').trim(); }
function syncOppsPreviewCredentials_() {
  const p=PropertiesService.getScriptProperties();
  const cloud=(p.getProperty('CLOUDINARY_CLOUD_NAME')||'').trim();
  const key=(p.getProperty('CLOUDINARY_API_KEY')||'').trim();
  const secret=(p.getProperty('CLOUDINARY_API_SECRET')||'').trim();
  if(!cloud||!key||!secret||!/^[A-Za-z0-9_-]+$/.test(cloud))
    throw Error('Cloudinary free-account Script Properties are not configured');
  return {cloud:cloud,key:key,secret:secret};
}
function syncOppsPreviewSha1_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1,s,Utilities.Charset.UTF_8)
    .map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
}
function syncOppsPreviewSign_(params,secret) {
  const query=Object.keys(params).sort().map(k=>k+'='+String(params[k])).join('&');
  return syncOppsPreviewSha1_(query+secret);
}
function syncOppsPreviewSet_(tab,rowIndex,updates) {
  Object.keys(updates).forEach(key=>{
    const col=tab.headers.indexOf(key);
    if(col<0)throw Error('Missing private Songs column: '+key);
    tab.sheet.getRange(rowIndex+2,col+1).setValue(updates[key]);
  });
}
function syncOppsPreviewEligibility_(song,mem,beta) {
  const memberId=syncOppsPreviewC_(song,'Member ID');
  const matches=mem.rows.filter(v=>syncOppsPreviewC_(v,'Member ID')===memberId);
  if(matches.length!==1) return false;
  const m=matches[0];
  if(syncOppsPreviewC_(m,'Membership Status')!=='Active Paid' ||
     !['$5 Standard','$10 Pro'].includes(syncOppsPreviewC_(m,'Patreon Tier')) ||
     !syncOppsPreviewC_(m,'Eligibility Verified On'))return false;
  if(new Date().getTime()<Date.parse(SYNC_OPPS_MP3_HOST.betaAccessEndUTC)){
    const slots=beta.rows.filter(v=>syncOppsPreviewC_(v,'Member ID')===memberId);
    if(slots.length!==1 || syncOppsPreviewC_(slots[0],'Invite Status')!=='Accepted' ||
       syncOppsPreviewC_(slots[0],'Eligibility Verified')!=='Yes' ||
       syncOppsPreviewC_(slots[0],'Patreon Email (PRIVATE)').toLowerCase()!==
       syncOppsPreviewC_(m,'Patreon Email (PRIVATE)').toLowerCase())return false;
  }
  return true;
}
function syncOppsPreviewBlob_(raw,submissionId,slot) {
  const rows=raw.rows.filter(r=>syncOppsPreviewC_(r,'Submission ID')===submissionId);
  if(rows.length!==1)throw Error('Exactly one private Tally submission required');
  const field='Song '+slot+': Upload authorized MP3 preview';
  const privateCell=syncOppsPreviewC_(rows[0],field);
  const matches=privateCell.match(/https:\/\/storage\.tally\.so\/[^\s<>"']+/gi)||[];
  if(matches.length!==1)throw Error('Missing or unsupported private Tally upload attachment reference');
  // Remove ordinary trailing punctuation of a pasted link, if any.
  const url=matches[0].replace(/[),;]+$/,'');
  if(!/^https:\/\/storage\.tally\.so\/[^@\s<>"']+/i.test(url))
    throw Error('Private attachment storage hostname invalid');
  const response=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:true});
  if(response.getResponseCode()!==200)
    throw Error('Private Tally upload cannot be downloaded; secure attachment kept in review');
  const blob=response.getBlob();
  const bytes=blob.getBytes();
  if(!bytes.length||bytes.length>SYNC_OPPS_MP3_HOST.maxBytes)
    throw Error('Uploaded MP3 is empty or exceeds 10MB');
  // Basic binary MP3 signature validation, NOT malware scanning or legal QA.
  const b0=bytes[0]&255,b1=(bytes[1]||0)&255,b2=(bytes[2]||0)&255;
  const hasID3=(b0===73 && b1===68 && b2===51);
  const hasMpeg=(b0===255 && (b1&224)===224 && (b1&24)!==8);
  if(!hasID3&&!hasMpeg)throw Error('Attachment is not recognizable MP3 binary');
  return blob.setName('preview.mp3');
}
function syncOppsPreviewUsageGuard_() {
  const auth=syncOppsPreviewCredentials_();
  const response=UrlFetchApp.fetch(
    'https://api.cloudinary.com/v1_1/'+encodeURIComponent(auth.cloud)+'/usage',
    {headers:{Authorization:'Basic '+Utilities.base64Encode(auth.key+':'+auth.secret)},
     muteHttpExceptions:true}
  );
  if(response.getResponseCode()!==200)
    throw Error('Free hosting quota cannot be verified. No upload attempted.');
  const credits=JSON.parse(response.getContentText()).credits||{};
  const percent=Number(credits.used_percent);
  if(!Number.isFinite(percent)||percent<0)
    throw Error('Hosting credits unavailable. No upload attempted.');
  if(percent>=80)throw Error('Free hosting credits at 80 percent or above. Upload held.');
  return {creditsUsedPercent:percent};
}
function syncOppsPreviewCloudinaryUpload_(blob) {
  // Fail closed before upload if quota data is missing or near Free Plan limit.
  syncOppsPreviewUsageGuard_();
  const auth=syncOppsPreviewCredentials_();
  const timestamp=Math.floor(Date.now()/1000);
  // Public ID path works in both dynamic and legacy Cloudinary folder modes.
  const publicId=SYNC_OPPS_MP3_HOST.folder+'/preview_'+Utilities.getUuid().replace(/-/g,'');
  const params={public_id:publicId,timestamp:timestamp};
  const resp=UrlFetchApp.fetch(
    'https://api.cloudinary.com/v1_1/'+encodeURIComponent(auth.cloud)+'/video/upload',
    {method:'post',payload:{
      file:blob,public_id:publicId,timestamp:String(timestamp),api_key:auth.key,
      signature:syncOppsPreviewSign_(params,auth.secret)
    },muteHttpExceptions:true}
  );
  if(resp.getResponseCode()<200||resp.getResponseCode()>=300)
    throw Error('Cloudinary MP3 upload failed (HTTP '+resp.getResponseCode()+')');
  const body=JSON.parse(resp.getContentText());
  const url=String(body.secure_url||'');
  const expected='https://res.cloudinary.com/'+auth.cloud+'/video/upload/';
  if(!url.startsWith(expected) ||
     !new RegExp('/v[0-9]+/'+SYNC_OPPS_MP3_HOST.folder+'/preview_[a-f0-9]{32}\\.mp3$','i').test(url) ||
     body.resource_type!=='video'||body.public_id!==publicId)
    throw Error('Cloudinary returned an unrecognized asset URL. Check the account for an orphaned asset.');
  return {url:url,id:publicId};
}
function syncOppsPreviewCloudinaryDestroy_(publicId) {
  const auth=syncOppsPreviewCredentials_();
  if(!new RegExp('^'+SYNC_OPPS_MP3_HOST.folder+'/preview_[a-f0-9]{32}$','i').test(publicId))
    throw Error('Unrecognized Sync Opps preview asset ID');
  const timestamp=Math.floor(Date.now()/1000);
  const params={public_id:publicId,timestamp:timestamp,invalidate:'true'};
  const resp=UrlFetchApp.fetch(
    'https://api.cloudinary.com/v1_1/'+encodeURIComponent(auth.cloud)+'/video/destroy',
    {method:'post',payload:{public_id:publicId,timestamp:String(timestamp),
      api_key:auth.key,invalidate:'true',
      signature:syncOppsPreviewSign_(params,auth.secret)},muteHttpExceptions:true}
  );
  if(resp.getResponseCode()<200||resp.getResponseCode()>=300)
    throw Error('Cloudinary preview revocation failed (HTTP '+resp.getResponseCode()+')');
  const result=String(JSON.parse(resp.getContentText()).result||'');
  if(result!=='ok'&&result!=='not found')throw Error('Cloudinary preview revocation not confirmed');
  return result;
}
function syncOppsHostAuthorizedMp3Previews() {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(25000))throw Error('Another catalog operation is underway');
  try {
    const ss=SpreadsheetApp.openById(SYNC_OPPS_CONFIG.spreadsheetId);
    const songs=syncOppsPreviewTable_(ss,'Songs');
    const members=syncOppsPreviewTable_(ss,'Members');
    const beta=syncOppsPreviewTable_(ss,'Beta 40');
    const raw=syncOppsPreviewTable_(ss,'Tally Raw Responses');
    const report={hosted:0,skipped:0,errors:[]};
    for(let i=0;i<songs.rows.length&&report.hosted<SYNC_OPPS_MP3_HOST.stagingBatchMax;i++){
      const s=songs.rows[i];
      if(syncOppsPreviewC_(s,'Music Source')!=='Managed MP3 Preview'||
         syncOppsPreviewC_(s,'Preview Host Authorization (PRIVATE)')!=='Approved Preview'||
         syncOppsPreviewC_(s,'Preview Host Public ID (PRIVATE)'))continue;
      const songId=syncOppsPreviewC_(s,'Song ID');
      try {
        if(syncOppsPreviewC_(s,'Catalog Status')!=='Hidden' ||
           syncOppsPreviewC_(s,'Member Listing Authorization')!=='Yes' ||
           !syncOppsPreviewEligibility_(s,members,beta)){
          report.skipped++;continue;
        }
        const sid=syncOppsPreviewC_(s,'Tally Submission ID');
        const slot=[1,2].find(n=>syncOppsStableId_('SONG',sid+':'+n)===songId);
        if(!slot)throw Error('Song and private upload submission IDs do not match');
        // Explicit manual Songs approval is mandatory BEFORE any asset goes public.
        const blob=syncOppsPreviewBlob_(raw,sid,slot);
        const hosted=syncOppsPreviewCloudinaryUpload_(blob);
        syncOppsPreviewSet_(songs,i,{
          'Authorized Embed Reference':hosted.url,
          'Preview Host Public ID (PRIVATE)':hosted.id,
          'Preview Host Updated On (PRIVATE)':new Date()
        });
        report.hosted++;
      }catch(e){report.errors.push({songId:songId,error:String(e)});}
    }
    Logger.log('Preview hosting (private review): '+JSON.stringify(report));
    return report;
  }finally{lock.releaseLock();}
}
function syncOppsRevokeHostedPreviews_() {
  const ss=SpreadsheetApp.openById(SYNC_OPPS_CONFIG.spreadsheetId);
  const songs=syncOppsPreviewTable_(ss,'Songs');
  const report={revoked:0,errors:[]};
  for(let i=0;i<songs.rows.length;i++){
    const s=songs.rows[i];
    const id=syncOppsPreviewC_(s,'Preview Host Public ID (PRIVATE)');
    if(!id)continue;
    if(!['Paused','Withdrawn'].includes(syncOppsPreviewC_(s,'Catalog Status')) &&
       syncOppsPreviewC_(s,'Preview Host Authorization (PRIVATE)')!=='Withdraw / Delete')continue;
    const songId=syncOppsPreviewC_(s,'Song ID');
    try {
      syncOppsPreviewCloudinaryDestroy_(id);
      syncOppsPreviewSet_(songs,i,{
        'Authorized Embed Reference':'',
        'Preview Host Public ID (PRIVATE)':'',
        'Preview Host Authorization (PRIVATE)':'Do Not Host',
        'Preview Host Updated On (PRIVATE)':new Date()
      });
      report.revoked++;
    } catch(e) {report.errors.push({songId:songId,error:String(e)});}
  }
  if(report.revoked||report.errors.length)
    Logger.log('MP3 preview withdrawal check: '+JSON.stringify(report));
  return report;
}
