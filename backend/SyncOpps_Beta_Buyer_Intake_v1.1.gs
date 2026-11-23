/**
 * Sync Opps. | Beta Applications + Buyer Licensing Inquiries v1.1
 * Entire source is deliberately safe for a public code repository:
 * NEVER put API tokens, spreadsheet IDs, member emails or credentials here.
 * Private Script Properties required: TALLY_API_KEY, CATALOG_SHEET_ID.
 * NEW, SEPARATE Apps Script project. Do not overwrite the three operational scripts.
 *
 * Run syncOppsBetaBuyerDryRun() manually first. It is READ ONLY.
 * Install exactly ONE 5-minute, Head time trigger for syncOppsProcessBetaBuyer().
 * This function intentionally rejects manual calls to prevent surprise email sends.
 * Tally forms are fetched through the FREE read-only API. No Tally Sheets
 * integrations, webhooks, external services or browser automation required.
 *
 * IMPORTANT: Submission fields are self-reported. Applications are not assigned
 * a beta slot without an existing verified paid member AND separately confirmed
 * identity AND an explicit owner Approve action in the private applications tab.
 * Buyer messages are routed only for an actively Published and QA-approved song
 * and verified recipient, with rate limits and idempotence. No owner email is
 * published. MailApp sends transactional emails only, not marketing.
 */
const SO_BB_V1=Object.freeze({
  sheetProperty:'CATALOG_SHEET_ID', apiProperty:'TALLY_API_KEY',
  betaForm:'YjGvPd', buyerForm:'jeoYaE',
  betaTab:'Beta Applications (PRIVATE)', beta40Tab:'Beta 40',
  acceptanceTab:'Beta Acceptance Notices (PRIVATE)',
  acceptanceSender:'syncoppsofficial@gmail.com',
  memberSongFormUrl:'https://tally.so/r/peo0gV', maxAcceptanceEmailsPerRun:5,
  buyerTab:'Buyer Inquiries', membersTab:'Members', songsTab:'Songs', stagingTab:'Public Staging',
  writerTab:'Writer Splits', publishingTab:'Publishing Splits', masterTab:'Master Splits',
  maxApiPages:10, pageSize:100, maxNewPerRun:40,
  perBuyerDay:3, perSongDay:20, maxEmailPerRun:10,
  intakeFormat:'2025-02-01',
  acceptedTiers:['$5 Standard','$10 Pro'],
  buyerFormUrl:'https://tally.so/r/jeoYaE'
});
function syncOppsBetaBuyerDryRun(){
  const book=soBBBook_(); const forms=soBBForms_();
  const beta=soBBTable_(book,SO_BB_V1.betaTab);
  const buyers=soBBTable_(book,SO_BB_V1.buyerTab);
  const knownBeta=new Set(beta.rows.map(r=>soBBC_(r,beta,'Tally Submission ID')));
  const knownBuyer=new Set(buyers.rows.map(r=>soBBC_(r,buyers,'Inquiry ID')));
  const newBeta=forms.beta.filter(s=>!knownBeta.has(s.id));
  const newBuyers=forms.buyer.filter(s=>!knownBuyer.has('INQ-'+s.id));
  const output={mode:'READ ONLY (no writes, emails or slot assignments)',
    betaSubmissionsSeen:forms.beta.length,betaUnprocessed:newBeta.length,
    buyerSubmissionsSeen:forms.buyer.length,buyerUnprocessed:newBuyers.length,
    currentBetaAssigned:soBBTable_(book,SO_BB_V1.beta40Tab).rows.filter(r=>String(r[1]||'').trim()).length,
    errors:[],next:'Install one time-based trigger only after reviewing this dry-run.'};
  console.log(JSON.stringify(output));return output;
}
function syncOppsProcessBetaBuyer(e){
  // A random user cannot cause the processor to send emails by running it manually.
  if(!e||!e.triggerUid)throw Error('Trigger-only processor. Use syncOppsBetaBuyerDryRun() for manual testing.');
  // Read the complete Tally response BEFORE taking the exclusive write lock.
  // A slow external API cannot block a second scheduled run from safely
  // reading its own data, and no Sheets or emails are touched on fetch failure.
  console.log(JSON.stringify({mode:'LIVE TRIGGER',phase:'TALLY_READ_START'}));
  const forms=soBBForms_();
  console.log(JSON.stringify({mode:'LIVE TRIGGER',phase:'TALLY_READ_COMPLETE'}));
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(5000)){
    // Another execution is processing a snapshot. Do not collide or emit a
    // false failure email: the next scheduled trigger rechecks all submissions.
    console.warn('Sync Opps Beta + Buyer Intake: SKIPPED_BUSY; active intake holds write lock. Next scheduled run will retry.');
    return {mode:'LIVE TRIGGER',status:'SKIPPED_BUSY',writes:0,emails:0};
  }
  try {
    console.log(JSON.stringify({mode:'LIVE TRIGGER',phase:'WRITE_LOCK_ACQUIRED'}));
    const book=soBBBook_();
    const members=soBBTable_(book,SO_BB_V1.membersTab);
    const songs=soBBTable_(book,SO_BB_V1.songsTab);
    const staging=soBBTable_(book,SO_BB_V1.stagingTab);
    const beta=soBBTable_(book,SO_BB_V1.betaTab);
    const beta40=soBBTable_(book,SO_BB_V1.beta40Tab);
    const buyers=soBBTable_(book,SO_BB_V1.buyerTab);
    const writers=soBBTable_(book,SO_BB_V1.writerTab);
    const publishing=soBBTable_(book,SO_BB_V1.publishingTab);
    const masters=soBBTable_(book,SO_BB_V1.masterTab);
    const acceptanceNotices=soBBTable_(book,SO_BB_V1.acceptanceTab);
    // Complete Tally pagination was validated before acquiring this lock.
    const counters={newBeta:0,duplicateApplicants:0,pendingEligibility:0,
      acceptedBeta:0,waitlisted:0,acceptanceSent:0,acceptanceBlocked:0,
      newBuyer:0,buyerSent:0,buyerBlocked:0,emails:0};
    const emailIndex=soBBMemberEmailIndex_(members);
    const seenApps=new Set(beta.rows.map(r=>soBBC_(r,beta,'Tally Submission ID')));
    const seenApplicantEmails=new Set(beta.rows.map(r=>soBBEmail_(soBBC_(r,beta,'Patreon Email (PRIVATE)'))).filter(Boolean));
    const appSubmissions=forms.beta.slice().sort(soBBSort_);
    for(const sub of appSubmissions){
      if(counters.newBeta>=SO_BB_V1.maxNewPerRun)break;
      if(seenApps.has(sub.id))continue;
      const a=soBBAnswers_(forms.betaQuestions,sub);
      const email=soBBEmail_(a['Your Patreon membership email']);
      const claimed=soBBText_(a['Artist or band display name'],120);
      const tier=soBBText_(a['What is your current Patreon membership tier?'],100);
      const duplicate=Boolean(email&&seenApplicantEmails.has(email));
      const match=soBBUniqueMember_(emailIndex,email);
      const valid=!!email && !!claimed && soBBEmailValid_(email) && !duplicate;
      const paid=valid && soBBEligibleMember_(match,members);
      const status=!valid?(duplicate?'Duplicate - Review':'Needs Review'):
        paid?'Eligible - Needs Confirmation':'Pending Eligibility';
      const row={
        'Tally Submission ID':sub.id,'Submitted On':soBBDate_(sub.submittedAt),
        'Patreon Email (PRIVATE)':email,'Artist / Band (Claimed)':claimed,
        'Tier (Claimed)':tier,'Music Link (PRIVATE)':soBBText_(a['Where can we hear your music? (optional)'],700),
        'Questions (PRIVATE)':soBBText_(a['What would you like to know before participating? (optional)'],1800),
        'Member ID (Matched)':match?soBBC_(match,members,'Member ID'):'',
        'Paid Eligibility':paid?'Active Paid':'Unverified',
        'Identity Verification':'Pending','Admin Decision':'Pending','Processing Status':status,
        'Assigned Beta Slot':'','Last Reviewed On':'',
        'Admin Notes (PRIVATE)':duplicate?'Duplicate application by membership email; no new slot reserved.':
          'Membership email alone does not verify applicant identity. Paid eligibility must be confirmed in Patreon.'
      };
      soBBAppend_(beta,row);seenApps.add(sub.id);if(email)seenApplicantEmails.add(email);
      counters.newBeta++;if(duplicate)counters.duplicateApplicants++;
      if(!paid)counters.pendingEligibility++;
    }
    // Process only OWNER-APPROVED applications, verified against CURRENT members.
    // These columns are private, require explicit manual confirmation and are not form-controlled.
    const betaCurrent=soBBTable_(book,SO_BB_V1.betaTab);
    const betaSlots=soBBTable_(book,SO_BB_V1.beta40Tab);
    for(let i=0;i<betaCurrent.rows.length;i++){
      const row=betaCurrent.rows[i], status=soBBC_(row,betaCurrent,'Processing Status');
      if(status==='Accepted'||status==='Declined'||status==='Waitlisted'||status==='Duplicate - Review'||status==='Needs Review')continue;
      if(soBBC_(row,betaCurrent,'Admin Decision')==='Decline'){
        soBBSet_(betaCurrent,i,'Processing Status','Declined');continue;
      }
      if(soBBC_(row,betaCurrent,'Admin Decision')!=='Approve'||
         soBBC_(row,betaCurrent,'Identity Verification')!=='Verified')continue;
      const email=soBBEmail_(soBBC_(row,betaCurrent,'Patreon Email (PRIVATE)'));
      const member=soBBUniqueMember_(emailIndex,email);
      if(!soBBEligibleMember_(member,members)){
        soBBSet_(betaCurrent,i,'Processing Status','Pending Eligibility');continue;
      }
      const memberId=soBBC_(member,members,'Member ID');
      const memberAlready=betaSlots.rows.findIndex(r=>soBBC_(r,betaSlots,'Member ID')===memberId||
        soBBEmail_(soBBC_(r,betaSlots,'Patreon Email (PRIVATE)'))===email);
      if(memberAlready>=0){
        const existingSlot=soBBC_(betaSlots.rows[memberAlready],betaSlots,'Beta Slot');
        soBBSet_(betaCurrent,i,'Assigned Beta Slot',existingSlot);
        soBBSet_(betaCurrent,i,'Processing Status','Accepted');
        continue;
      }
      const available=betaSlots.rows.findIndex(r=>!soBBC_(r,betaSlots,'Member ID'));
      if(available<0){soBBSet_(betaCurrent,i,'Processing Status','Waitlisted');counters.waitlisted++;continue;}
      const slot=soBBC_(betaSlots.rows[available],betaSlots,'Beta Slot');
      if(!(Number(slot)>=1&&Number(slot)<=40))throw Error('Beta 40 capacity grid corrupted. No slot allocated.');
      const now=new Date();
      const rowValues={
        'Member ID':memberId,'Patreon Email (PRIVATE)':email,
        'Artist / Band':soBBC_(member,members,'Artist / Band Display Name'),
        'Invite Status':'Accepted','Invited On':now,'Eligibility Verified':'Yes',
        'Joined Beta On':now,'Songs Submitted (Count)':soBBCountSongs_(songs,memberId)
      };
      soBBPatch_(betaSlots,available,rowValues);
      soBBSet_(betaCurrent,i,'Member ID (Matched)',memberId);
      soBBSet_(betaCurrent,i,'Assigned Beta Slot',slot);
      soBBSet_(betaCurrent,i,'Processing Status','Accepted');
      soBBSet_(betaCurrent,i,'Last Reviewed On',now);
      counters.acceptedBeta++;
      // Notifications are handled separately after the slot is fully recorded.
    }
    // Existing Accepted applications are eligible, too: a code rollout must not
    // silently skip previously accepted members. Never send more than once.
    const noticeIds=new Set(acceptanceNotices.rows.map(r=>
      soBBC_(r,acceptanceNotices,'Tally Submission ID')).filter(Boolean));
    const effectiveSender=typeof Session!=='undefined' && Session.getEffectiveUser
      ? soBBEmail_(Session.getEffectiveUser().getEmail()) : '';
    const senderAuthorized=effectiveSender===SO_BB_V1.acceptanceSender;
    let acceptanceThisRun=0;
    for(const app of betaCurrent.rows){
      if(acceptanceThisRun>=SO_BB_V1.maxAcceptanceEmailsPerRun)break;
      const id=soBBC_(app,betaCurrent,'Tally Submission ID');
      if(!id || noticeIds.has(id))continue;
      const candidate=soBBAcceptanceEligible_(app,betaCurrent,emailIndex,members,betaSlots);
      if(!candidate)continue;
      if(!senderAuthorized){
        console.warn('ACCEPTANCE_SENDER_BLOCKED: installable trigger must run as the approved Sync Opps. sender. No acceptance email sent.');
        counters.acceptanceBlocked++;continue;
      }
      if(counters.emails>=SO_BB_V1.maxEmailPerRun ||
         MailApp.getRemainingDailyQuota()<1){
        console.warn('ACCEPTANCE_QUOTA_BLOCKED: no email attempted; can retry on a later run.');
        counters.acceptanceBlocked++;continue;
      }
      // Claim the unique application BEFORE MailApp. Even if execution stops
      // mid-send, the Attempted record prevents an automatic duplicate.
      const i=soBBAppend_(acceptanceNotices,{
        'Tally Submission ID':id,'Member ID':candidate.memberId,
        'Patreon Email (PRIVATE)':candidate.email,'Beta Slot':candidate.slot,
        'Delivery Status':'Attempted','Attempted On':new Date(),
        'Sent On':'','Admin Notes (PRIVATE)':
          'One-time transactional acceptance attempt claimed before sending. Do not automatically retry.'
      });
      noticeIds.add(id);
      acceptanceThisRun++;
      try{
        MailApp.sendEmail({
          to:candidate.email,
          subject:'You are accepted: Sync Opps. First 40 Catalog Beta',
          body:soBBAcceptanceEmail_(candidate),
          htmlBody:soBBAcceptanceHtml_(candidate),
          name:'Sync Opps.',replyTo:SO_BB_V1.acceptanceSender
        });
        soBBSet_(acceptanceNotices,i,'Delivery Status','Sent');
        soBBSet_(acceptanceNotices,i,'Sent On',new Date());
        counters.acceptanceSent++;counters.emails++;
      }catch(error){
        soBBSet_(acceptanceNotices,i,'Delivery Status','Failed');
        soBBSet_(acceptanceNotices,i,'Admin Notes (PRIVATE)',
          'Send failure, no automatic retry. Review manually: '+
          soBBText_(String(error),450));
        counters.acceptanceBlocked++;
      }
    }
    // One-time owner-requested design review, not a member approval. The private
    // ledger must explicitly contain the unique Test Pending command first.
    // Never send from the wrong Google account or retry an attempted design test.
    const designTestId='DESIGN-TEST-20261123-001';
    const designTestTo='thesyncopps@gmail.com';
    for(let i=0;i<acceptanceNotices.rows.length;i++){
      const record=acceptanceNotices.rows[i];
      if(soBBC_(record,acceptanceNotices,'Tally Submission ID')!==designTestId ||
         soBBC_(record,acceptanceNotices,'Delivery Status')!=='Test Pending' ||
         soBBEmail_(soBBC_(record,acceptanceNotices,'Patreon Email (PRIVATE)'))!==designTestTo)continue;
      if(!senderAuthorized || counters.emails>=SO_BB_V1.maxEmailPerRun ||
         MailApp.getRemainingDailyQuota()<1){
        console.warn('DESIGN_TEST_BLOCKED: approved sender or daily quota unavailable.');
        break;
      }
      const sample={artist:'MacMc'};
      soBBSet_(acceptanceNotices,i,'Delivery Status','Attempted');
      soBBSet_(acceptanceNotices,i,'Attempted On',new Date());
      try{
        MailApp.sendEmail({
          to:designTestTo,
          subject:'[DESIGN TEST] Sync Opps. First 40 Catalog Beta Acceptance',
          body:soBBAcceptanceEmail_(sample),
          htmlBody:soBBAcceptanceHtml_(sample),
          name:'Sync Opps.',replyTo:SO_BB_V1.acceptanceSender
        });
        soBBSet_(acceptanceNotices,i,'Delivery Status','Sent');
        soBBSet_(acceptanceNotices,i,'Sent On',new Date());
        soBBSet_(acceptanceNotices,i,'Admin Notes (PRIVATE)',
          'INTERNAL DESIGN TEST ONLY. Not a real application or beta slot. One-time message sent to approved test inbox.');
        counters.emails++;
      }catch(error){
        soBBSet_(acceptanceNotices,i,'Delivery Status','Failed');
        soBBSet_(acceptanceNotices,i,'Admin Notes (PRIVATE)',
          'INTERNAL DESIGN TEST ONLY. Failed; no automatic retry: '+soBBText_(String(error),300));
      }
      break;
    }
    // Buyer inquiries are accepted from published, approved public songs only.
    const seenBuyer=new Set(buyers.rows.map(r=>soBBC_(r,buyers,'Inquiry ID')));
    for(const sub of forms.buyer.slice().sort(soBBSort_)){
      if(counters.newBuyer>=SO_BB_V1.maxNewPerRun)break;
      const inquiryId='INQ-'+sub.id;
      if(seenBuyer.has(inquiryId))continue;
      const a=soBBAnswers_(forms.buyerQuestions,sub);
      const sid=soBBText_(a.song_id,120);
      const buyerEmail=soBBEmail_(a['Your email address']);
      const buyerName=soBBText_(a['Your name'],120);
      const use=soBBText_(a['How would you use the music? Select all that apply.'],500);
      const media=soBBText_(a['Media Type of Project'],120);
      const message=soBBText_(a['Tell the artist about your project and licensing needs'],4000);
      const feeRaw=String(a['Licensing fee offer in USD (optional)']||'').replace(/[$,\s]/g,'');
      const fee=feeRaw && /^\d+(?:\.\d{1,2})?$/.test(feeRaw)&&Number(feeRaw)>0?Number(feeRaw):'';
      const outcome=soBBBuyerEligible_(sid,buyerEmail,buyerName,message,songs,staging,members,buyers,beta40,writers,publishing,masters);
      const record={
        'Inquiry ID':inquiryId,'Received On':soBBDate_(sub.submittedAt),'Song ID':sid,
        'Song Title':outcome.song?soBBC_(outcome.song,songs,'Song Title'):'',
        'Member ID':outcome.member?soBBC_(outcome.member,members,'Member ID'):'',
        'Buyer Name':buyerName,'Company / Production':soBBText_(a['Company or production (optional)'],200),
        'Buyer Email (PRIVATE)':buyerEmail,'Licensing Fee Offer (USD)':fee,
        'Music Use':use,'Music Use Other':'','Media Type of Project':media,
        'Media Type Other':'','Project / Campaign Name':soBBText_(a['Project or campaign name (optional)'],250),
        'Licensing Inquiry Message':message,
        'Routing Contact Email (PRIVATE)':outcome.allowed?outcome.recipient:'',
        'Delivery Status':outcome.allowed?'Pending':'Blocked','Delivered On':'',
        'Buyer Reply-To (PRIVATE)':buyerEmail,'Spam Review':outcome.allowed?'Clear':'Flagged',
        'Admin Notes (PRIVATE)':outcome.allowed?'Tally submission '+sub.id+'; ready for single transactional routing.':
          'Tally submission '+sub.id+'; BLOCKED: '+outcome.reason
      };
      // Write an immutable intake/duplicate key BEFORE any outbound email.
      const appended=soBBAppend_(buyers,record);
      seenBuyer.add(inquiryId);counters.newBuyer++;
      if(!outcome.allowed){counters.buyerBlocked++;continue;}
      if(counters.emails>=SO_BB_V1.maxEmailPerRun){
        soBBSet_(buyers,appended,'Delivery Status','Blocked');
        soBBSet_(buyers,appended,'Admin Notes (PRIVATE)','Unsent: per-run email cap reached. Manual review.');
        counters.buyerBlocked++;continue;
      }
      // Only submit a mail once. An interrupted run leaves Pending for human review,
      // and the unique inquiry ID suppresses a resend on the next scheduled run.
      const emailBody=soBBBuyerEmail_(record);
      try {
        if(MailApp.getRemainingDailyQuota()<1)throw Error('Google MailApp daily quota exhausted.');
        MailApp.sendEmail({to:outcome.recipient,subject:'Sync Opps. Licensing Inquiry: '+
          soBBHeader_(record['Song Title']),body:emailBody,replyTo:buyerEmail,
          name:'Sync Opps. Ready to License Catalog'});
        soBBSet_(buyers,appended,'Delivery Status','Sent');
        soBBSet_(buyers,appended,'Delivered On',new Date());
        counters.emails++;counters.buyerSent++;
      }catch(err){
        soBBSet_(buyers,appended,'Delivery Status','Failed');
        soBBSet_(buyers,appended,'Admin Notes (PRIVATE)','Sending failed; do not automatically retry: '+
          soBBText_(String(err),400));
        counters.buyerBlocked++;
      }
    }
    console.log(JSON.stringify({mode:'LIVE TRIGGER',...counters}));return counters;
  }finally{lock.releaseLock();}
}
function soBBBook_(){
  const id=PropertiesService.getScriptProperties().getProperty(SO_BB_V1.sheetProperty)||'';
  if(!/^[A-Za-z0-9_-]{25,100}$/.test(id))throw Error('Missing private CATALOG_SHEET_ID Script Property.');
  return SpreadsheetApp.openById(id);
}
function soBBForms_(){
  const key=PropertiesService.getScriptProperties().getProperty(SO_BB_V1.apiProperty)||'';
  if(key.length<12)throw Error('Missing private TALLY_API_KEY Script Property.');
  const beta=soBBFetchForm_(SO_BB_V1.betaForm,key);
  const buyer=soBBFetchForm_(SO_BB_V1.buyerForm,key);
  return {beta:beta.submissions,betaQuestions:beta.questions,
    buyer:buyer.submissions,buyerQuestions:buyer.questions};
}
/**
 * Retry only transient transport failures and temporary HTTP responses.
 * A bounded timeout avoids letting one hung connection consume the entire
 * six-minute Apps Script execution. Nonretryable authorization, malformed
 * responses and pagination failures still halt before any Sheet writes.
 */
function soBBFetchTallyPageWithRetry_(url,key,formId,page){
  const transientHttp=[408,429,500,502,503,504];
  const pausesMs=[1500,4500];
  for(let attempt=1;attempt<=3;attempt++){
    let retryReason='';
    try{
      const rsp=UrlFetchApp.fetch(url,{
        method:'get',muteHttpExceptions:true,followRedirects:false,
        timeoutSeconds:20,
        headers:{Authorization:'Bearer '+key,'tally-version':SO_BB_V1.intakeFormat,
          Accept:'application/json'}
      });
      const status=rsp.getResponseCode();
      if(status===200)return rsp;
      if(!transientHttp.includes(status) || attempt===3)
        throw Error('Tally API '+formId+' returned HTTP '+status);
      retryReason='HTTP '+status;
    }catch(e){
      const msg=String((e&&e.message)||e);
      const transient=/Address unavailable|timed?\s*out|Timeout|Service unavailable|connection reset|connection refused|DNS error|socket/i.test(msg);
      if(!transient || attempt===3)throw e;
      retryReason='temporary network error';
    }
    console.warn('Tally '+formId+' page '+page+': '+retryReason+'; retry '+(attempt+1)+' of 3.');
    Utilities.sleep(pausesMs[attempt-1]);
  }
  throw Error('Tally '+formId+' request could not complete.');
}
function soBBFetchForm_(formId,key){
  let submissions=[], questions=[],page=1,more=false;
  do{
    const url='https://api.tally.so/forms/'+encodeURIComponent(formId)+
      '/submissions?filter=completed&limit='+SO_BB_V1.pageSize+'&page='+page;
    const rsp=soBBFetchTallyPageWithRetry_(url,key,formId,page);
    const body=JSON.parse(rsp.getContentText());
    if(!Array.isArray(body.submissions)||!Array.isArray(body.questions))throw Error('Unexpected Tally API response.');
    if(!questions.length)questions=body.questions;
    submissions=submissions.concat(body.submissions.filter(s=>s&&s.id&&s.isCompleted!==false));
    more=Boolean(body.hasMore);page++;
    if(more && page>SO_BB_V1.maxApiPages)throw Error('Submission pagination exceeded safe limit.');
  }while(more);
  return {submissions,questions};
}
function soBBAnswers_(questions,submission){
  const byId={};
  (questions||[]).forEach(q=>{
    const title=String(q.title||'').trim();
    if(q.id)byId[q.id]=title;
    (q.fields||[]).forEach(f=>{
      if(f.uuid)byId[f.uuid]=String(f.title||title||'').trim();
    });
  });
  // Some Tally hidden fields have their own UUIDs and no standalone title.
  const hidden={
    'df717da1-af43-4d37-9098-32b8d1e5054b':'song_id',
    'c0be1085-ce80-4d70-aa41-bc938377e89d':'song_title',
    'f89b833c-2cee-4712-82eb-eef2efe6842c':'artist'};
  const out={};
  (submission.responses||[]).forEach(r=>{
    // Prefer Tally's display-safe option labels over raw dropdown/checkbox UUIDs.
    // Hidden identifiers still use direct answer fallback if no formatted value exists.
    const raw=r.formattedAnswer!==undefined&&r.formattedAnswer!==null&&r.formattedAnswer!==''
      ?r.formattedAnswer:r.answer;
    const title=hidden[r.questionId]||byId[r.questionId]||String(r.questionTitle||'').trim();
    if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
      Object.keys(raw).forEach(k=>{if(['song_id','song_title','artist'].includes(k))out[k]=soBBText_(raw[k],400);});
    }
    if(!title)return;
    const text=Array.isArray(raw)?raw.map(x=>typeof x==='object'?JSON.stringify(x):String(x)).join(', '):
      raw&&typeof raw==='object'?JSON.stringify(raw):String(raw??'');
    out[title]=out[title]?out[title]+', '+text:text;
    // Some Tally versions return hidden-field values as a single JSON object/string.
    if(title==='song_id'&&text.startsWith('{')){
      try{const parsed=JSON.parse(text);if(parsed.song_id)out.song_id=String(parsed.song_id);}catch(_e){}
    }
  });
  // Defensive schema handling: a hidden song id can be a direct answer with no
  // question metadata. Only accept one unambiguous, explicitly formatted Song ID.
  if(!out.song_id){
    const matches=(submission.responses||[]).map(r=>String(r.answer||r.formattedAnswer||'').trim())
      .filter(s=>/^SONG-[A-Za-z0-9_-]{8,80}$/.test(s));
    if(matches.length===1)out.song_id=matches[0];
  }
  return out;
}
function soBBTable_(book,title){
  const sheet=book.getSheetByName(title);if(!sheet)throw Error('Missing private Sheet tab: '+title);
  const values=sheet.getDataRange().getValues();
  const headers=(values[0]||[]).map(String);if(!headers.length)throw Error('Empty headers in '+title);
  // Do not silently lose physical row indexes when a manually edited queue has gaps.
  const all=values.slice(1),rows=all.filter(row=>row.some(x=>String(x??'').trim()!==''));
  if(rows.length && all.slice(0,rows.length).some(row=>!row.some(x=>String(x??'').trim()!=='')))
    throw Error('Blank row inside queue '+title+'; resolve before processor writes.');
  return {sheet,headers,rows,title};
}
function soBBI_(table,key){
  const i=table.headers.indexOf(key);
  if(i<0)throw Error(table.title+' lacks required column: '+key);
  return i;
}
function soBBC_(row,table,key){return String(row?.[soBBI_(table,key)]??'').trim();}
function soBBAppend_(table,record){
  const row=table.headers.map(h=>Object.prototype.hasOwnProperty.call(record,h)?record[h]:'');
  const physicalRow=table.sheet.getLastRow()+1;
  table.sheet.getRange(physicalRow,1,1,row.length).setValues([row]);
  table.rows.push(row);
  return table.rows.length-1;
}
function soBBSet_(table,idx,key,val){
  const col=soBBI_(table,key);
  // Our processing tables have append-only rows and no blanks between data rows.
  table.sheet.getRange(idx+2,col+1).setValue(val);
  table.rows[idx][col]=val;
}
function soBBPatch_(table,idx,record){
  const row=table.rows[idx].slice();
  for(const [key,val] of Object.entries(record))row[soBBI_(table,key)]=val;
  table.sheet.getRange(idx+2,1,1,table.headers.length).setValues([row]);
  table.rows[idx]=row;
}
function soBBUniqueMember_(index,email){const candidates=index[email]||[];return candidates.length===1?candidates[0]:null;}
function soBBMemberEmailIndex_(members){
  const index={};
  members.rows.forEach(row=>{const key=soBBEmail_(soBBC_(row,members,'Patreon Email (PRIVATE)'));
    if(key)(index[key]||(index[key]=[])).push(row);});return index;
}
function soBBEligibleMember_(row,members){
  if(!row||!members)return false;
  return soBBC_(row,members,'Membership Status')==='Active Paid'&&
    SO_BB_V1.acceptedTiers.includes(soBBC_(row,members,'Patreon Tier'))&&
    !!soBBC_(row,members,'Eligibility Verified On');
}
function soBBCountSongs_(songs,memberId){return songs.rows.filter(row=>soBBC_(row,songs,'Member ID')===memberId).length;}
function soBBBuyerEligible_(songId,buyerEmail,buyerName,message,songs,staging,members,buyers,beta40,writers,publishing,masters){
  const failure=reason=>({allowed:false,reason,song:null,member:null,recipient:''});
  if(!/^SONG-[A-Za-z0-9_-]{8,80}$/.test(songId))return failure('Missing or invalid Song ID');
  if(!soBBEmailValid_(buyerEmail)||!buyerName||!message)return failure('Incomplete buyer identity or message');
  const songsFound=songs.rows.filter(r=>soBBC_(r,songs,'Song ID')===songId);
  const stageFound=staging.rows.filter(r=>soBBC_(r,staging,'Song ID')===songId);
  if(songsFound.length!==1||stageFound.length!==1)return failure('Song not uniquely matched to published QA staging');
  const song=songsFound[0],stage=stageFound[0];
  if(soBBC_(song,songs,'Catalog Status')!=='Published'||
     soBBC_(song,songs,'Review Status')!=='Approved'||
     soBBC_(song,songs,'Member Listing Authorization')!=='Yes'||
     soBBC_(song,songs,'Private Inquiry Routing Consent')!=='Yes'||
     soBBC_(stage,staging,'Final QA Check')!=='Yes'||
     soBBC_(stage,staging,'Ready for Separate Public Export')!=='Yes'||
     !['Full Track','Preview Only'].includes(soBBC_(song,songs,'Playback Status'))||
     !['Member Supplied','Verified'].includes(soBBC_(song,songs,'Rights Status')))
    return failure('Song not approved for current public licensing inquiries');
  const route=soBBC_(song,songs,'Claimed Clearance Route');
  const authority=soBBC_(song,songs,'One-Stop Authority Verification');
  if(!['Self-Controlled','Delegated One-Stop Agent','Additional Approvals'].includes(route)||
     !['Verified','Not Applicable'].includes(authority)||
     (route!=='Self-Controlled'&&authority!=='Verified'))
    return failure('Publishing or one-stop approval route not verified');
  for(const key of ['Song Title','Artist Display Name','Genre','Music Source'])
    if(!soBBC_(stage,staging,key))return failure('Public listing metadata incomplete');
  for(const key of ['Composition Credits / Splits (Consent)',
                    'Publisher Owners / Splits (Consent)',
                    'Master Owners / Splits (Consent)'])
    if(!soBBC_(stage,staging,key))return failure('Consented public ownership disclosure incomplete');
  if(!soBBRightsAllowedV11_(writers,songId,'Writer Credit','Writer Ownership % (0-100)',
       soBBC_(stage,staging,'Composition Credits / Splits (Consent)'),'Writer Legal Name') ||
     !soBBRightsAllowedV11_(publishing,songId,'Publisher / Copyright Owner','Publishing Ownership % (0-100)',
       soBBC_(stage,staging,'Publisher Owners / Splits (Consent)')) ||
     !soBBRightsAllowedV11_(masters,songId,'Master Owner','Master Ownership % (0-100)',
       soBBC_(stage,staging,'Master Owners / Splits (Consent)')))
    return failure('Public ownership consent or verified split matching incomplete');
  const source=soBBC_(stage,staging,'Music Source').toLowerCase();
  if(source!==soBBC_(song,songs,'Music Source').toLowerCase())
    return failure('Public staging music source does not match the private song');
  const hostedReference=soBBC_(song,songs,'Authorized Embed Reference');
  const managed=source.indexOf('managed mp3 preview')>=0;
  let stream=hostedReference||
    soBBC_(stage,staging,'Stream URL / Embed ID')||soBBC_(song,songs,'Stream URL');
  if(managed){
    const assetId=soBBC_(song,songs,'Preview Host Public ID (PRIVATE)');
    if(soBBC_(song,songs,'Preview Host Authorization (PRIVATE)')!=='Approved Preview'||
       !/^sync_opps_catalog_previews\/preview_[a-f0-9]{32}$/i.test(assetId)||
       !hostedReference || !hostedReference.endsWith('/'+assetId+'.mp3') ||
       !/^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_-]+\/video\/upload\/v\d+\/sync_opps_catalog_previews\/preview_[a-f0-9]{32}\.mp3$/i.test(hostedReference))
      return failure('Managed MP3 preview is not authorized or its active Cloudinary asset is missing');
    stream=hostedReference;
  }
  if(!soBBPlayerAllowedV11_(source,stream))
    return failure('Public player source unavailable or invalid');
  const memberId=soBBC_(song,songs,'Member ID');
  const found=members.rows.filter(r=>soBBC_(r,members,'Member ID')===memberId);
  if(found.length!==1||!soBBEligibleMember_(found[0],members))return failure('Member eligibility not verified');
  const member=found[0];
  if(soBBC_(member,members,'Inquiry Routing Consent (Private)')!=='Yes')return failure('Member routing consent missing');
  const accepted=beta40.rows.filter(r=>soBBC_(r,beta40,'Member ID')===memberId);
  // Beta-only eligibility ends Jan 5, 2027 at 00:00 Central (approved public
  // full-member-access date). Other membership, rights and routing gates remain.
  if(new Date().getTime()<Date.parse('2027-01-05T06:00:00Z') &&
     (accepted.length!==1 || soBBC_(accepted[0],beta40,'Invite Status')!=='Accepted' ||
      soBBC_(accepted[0],beta40,'Eligibility Verified')!=='Yes' ||
      soBBEmail_(soBBC_(accepted[0],beta40,'Patreon Email (PRIVATE)'))!==
       soBBEmail_(soBBC_(member,members,'Patreon Email (PRIVATE)'))))
    return failure('Member not accepted into first 40 beta');
  const url=soBBC_(stage,staging,'Buyer Inquiry Form URL (No Public Email)');
  if(!/^https:\/\/tally\.so\/r\/jeoYaE(?:[/?#]|$)/.test(url))return failure('Inquiry form not publicly approved for this song');
  const recipient=soBBEmail_(soBBC_(member,members,'Licensing Email (PRIVATE)'));
  if(!soBBEmailValid_(recipient))return failure('Member licensing contact email unavailable');
  const now=Date.now(),day=24*3600*1000;
  const recent=buyers.rows.filter(r=>{
    const ts=new Date(r[soBBI_(buyers,'Received On')]).getTime();
    return Number.isFinite(ts)&&ts>now-day;
  });
  const buyerCount=recent.filter(r=>soBBEmail_(soBBC_(r,buyers,'Buyer Email (PRIVATE)'))===buyerEmail).length;
  const songCount=recent.filter(r=>soBBC_(r,buyers,'Song ID')===songId).length;
  if(buyerCount>=SO_BB_V1.perBuyerDay||songCount>=SO_BB_V1.perSongDay)
    return failure('Transaction inquiry rate limit');
  return {allowed:true,reason:'',song,member,recipient};
}
function soBBRightsAllowedV11_(table,songId,creditColumn,percentageColumn,staged,legalColumn){
  const entries=table.rows.filter(r=>soBBC_(r,table,'Song ID')===songId);
  const source=String(staged||'').split(/[\n;|]/).map(t=>t.trim()).filter(Boolean);
  if(!entries.length||entries.length!==source.length)return false;
  if(entries.some(r=>soBBC_(r,table,'Approved for Public Display')!=='Yes'))return false;
  const percent=s=>{const x=String(s||'').trim().replace(/%$/,'');return /^(?:100(?:\.0+)?|\d{1,2}(?:\.\d+)?)$/.test(x)?Number(x):null;};
  const name=s=>String(s||'').trim().replace(/\s+/g,' ').toLowerCase();
  const privatePairs=[];
  for(const r of entries){
    const label=soBBC_(r,table,creditColumn)||soBBC_(r,table,legalColumn||creditColumn);
    const n=percent(soBBC_(r,table,percentageColumn));
    if(!label||n===null)return false;
    privatePairs.push([name(label),n]);
  }
  if(Math.abs(privatePairs.reduce((a,x)=>a+x[1],0)-100)>0.01)return false;
  const publicPairs=[];
  for(const row of source){
    const m=row.match(/^(.{2,160}?)[\s,:\-(]*\(?\s*(100(?:\.0+)?|\d{1,2}(?:\.\d+)?)\s*%\s*\)?$/);
    if(!m)return false;
    publicPairs.push([name(m[1].replace(/[\s,:\-(]+$/,'')),Number(m[2])]);
  }
  const sort=(a,b)=>a[0].localeCompare(b[0])||a[1]-b[1];
  privatePairs.sort(sort);publicPairs.sort(sort);
  return privatePairs.every((p,i)=>p[0]===publicPairs[i][0]&&Math.abs(p[1]-publicPairs[i][1])<0.01);
}
function soBBPlayerAllowedV11_(source,stream){
  // Apps Script V8 is not a browser. Do not depend on the browser URL global.
  const raw=String(stream||'').trim();
  if(/[\s<>\"']/.test(raw))return false;
  const match=raw.match(/^https:\/\/([^\/?#@:\s]+)(?::443)?(\/[^?#\s<>\"']*)?(?:[?#][^\s<>\"']*)?$/i);
  if(!match)return false;
  const host=match[1].toLowerCase(),path=match[2]||'/';
  if(source.includes('soundcloud'))return ['soundcloud.com','www.soundcloud.com'].includes(host);
  if(source.includes('spotify'))return host==='open.spotify.com'&&/\/embed\/(track|album|playlist)\//i.test(path);
  if(source.includes('youtube')||source.includes('you tube'))return ['www.youtube.com','www.youtube-nocookie.com'].includes(host)&&/\/embed\//i.test(path);
  if(source.includes('bandcamp'))return ['bandcamp.com','www.bandcamp.com'].includes(host)&&/\/EmbeddedPlayer\//i.test(path);
  if(source.includes('apple'))return host==='embed.music.apple.com';
  if(source.includes('disco'))return ['disco.ac','www.disco.ac'].includes(host);
  return (source.includes('mp3')||source.includes('audio'))&&/\.mp3$/i.test(path);
}
function soBBAcceptanceEligible_(row,apps,emailIndex,members,betaSlots){
  // An accepted status alone never authorizes a message.
  if(soBBC_(row,apps,'Processing Status')!=='Accepted' ||
     soBBC_(row,apps,'Admin Decision')!=='Approve' ||
     soBBC_(row,apps,'Identity Verification')!=='Verified' ||
     soBBC_(row,apps,'Paid Eligibility')!=='Active Paid')return null;
  const email=soBBEmail_(soBBC_(row,apps,'Patreon Email (PRIVATE)'));
  if(!soBBEmailValid_(email))return null;
  const member=soBBUniqueMember_(emailIndex,email);
  if(!soBBEligibleMember_(member,members))return null;
  const memberId=soBBC_(member,members,'Member ID');
  if(!memberId || soBBC_(row,apps,'Member ID (Matched)')!==memberId)return null;
  const slot=soBBC_(row,apps,'Assigned Beta Slot');
  if(!/^(?:[1-9]|[1-3][0-9]|40)$/.test(slot))return null;
  const matches=betaSlots.rows.filter(r=>soBBC_(r,betaSlots,'Beta Slot')===slot&&
    soBBC_(r,betaSlots,'Member ID')===memberId&&
    soBBEmail_(soBBC_(r,betaSlots,'Patreon Email (PRIVATE)'))===email&&
    soBBC_(r,betaSlots,'Invite Status')==='Accepted'&&
    soBBC_(r,betaSlots,'Eligibility Verified')==='Yes');
  if(matches.length!==1)return null;
  const displayName=soBBHeader_(soBBC_(row,apps,'Artist / Band (Claimed)')||
    soBBC_(member,members,'Artist / Band Display Name'));
  return {email,memberId,slot,artist:displayName||'Artist'};
}
function soBBAcceptanceEmail_(member){
  // Plain-text alternative for mail clients that do not display HTML.
  return 'Congratulations, '+member.artist+'!\n\n'+
    'Your application for the Sync Opps. First 40 Ready to License Catalog Beta has been approved.\n\n'+
    'NEXT STEP: Submit your music\n'+SO_BB_V1.memberSongFormUrl+'\n\n'+
    'Use your verified Patreon membership email. Include an authorized music link or MP3 preview (up to 10 MB) and accurate songwriter, publishing and master ownership details.\n\n'+
    'Each song is reviewed before public playback. Approved music or previews can be played by anyone in our public catalog. We will share the catalog with our existing licensing partners and promote it through paid advertising targeting music buyers.\n\n'+
    'You retain your rights and 100% of licensing fees. Participation does not guarantee publication, buyer inquiries or licensing placements.\n\n'+
    'The Sync Opps. team';
}
function soBBAcceptanceHtmlEscape_(value){
  // The applicant name originates in a public Tally form and is not trusted HTML.
  return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function soBBAcceptanceHtml_(member){
  // Table-based email styling follows the public Ready to License site's warm
  // cream, orange-ribbon, dark editorial heading and circular S identity.
  // All elements use inline styles for common mail-client support. The orange
  // ribbon has a solid-color fallback if an email client ignores gradients.
  const artist=soBBAcceptanceHtmlEscape_(member.artist);
  const formUrl=soBBAcceptanceHtmlEscape_(SO_BB_V1.memberSongFormUrl);
  return [
    '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="UTF-8"></head>',
    '<body style="margin:0;padding:0;background:#f9f4ef;font-family:Arial,Helvetica,sans-serif;color:#1e1815;">',
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;background-color:#f9f4ef;"><tr><td align="center" style="padding:28px 12px 36px;">',
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;max-width:600px;background:#fffdfa;border:1px solid #f0e1d7;border-radius:14px;overflow:hidden;">',
    '<tr><td style="padding:23px 28px;background:#fffdfa;">',
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr>',
    '<td valign="middle" style="padding-right:13px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" valign="middle" width="48" height="48" style="width:48px;height:48px;border:3px solid #ffffff;border-radius:50%;background:#fbe6da;color:#ee8142;font-size:34px;font-weight:900;line-height:48px;box-shadow:0 2px 9px #f0d2c3;">S</td></tr></table></td>',
    '<td valign="middle" style="font-size:23px;font-weight:900;letter-spacing:-1px;color:#1a1513;white-space:nowrap;">Sync Opps.</td>',
    '<td valign="middle" style="padding-left:14px;font-size:13px;font-style:italic;color:#695b54;white-space:nowrap;">Ready to License.</td>',
    '</tr></table></td></tr>',
    '<tr><td style="padding:31px 30px 34px;background-color:#f5c49d;background-image:linear-gradient(180deg,#f1d0b5 0%,#f7b47d 26%,#f8b486 48%,#f9d3b6 78%,#f4cfb3 100%);">',
    '<p style="margin:0 0 14px;font-size:11px;font-weight:800;letter-spacing:2px;color:#87360e;">SYNC OPPS. FIRST 40 CATALOG BETA</p>',
    '<h1 style="margin:0;font-size:38px;line-height:1.16;letter-spacing:-1.5px;font-weight:900;color:#1a1513;">You&#39;re accepted.</h1>',
    '</td></tr>',
    '<tr><td style="padding:30px 30px 23px;background:#fffdfa;">',
    '<h2 style="margin:0 0 12px;font-size:27px;line-height:1.24;letter-spacing:-.7px;color:#1a1513;font-weight:900;">Congratulations, '+artist+'!</h2>',
    '<p style="margin:0 0 25px;font-size:15px;line-height:1.7;color:#34302e;">Your application for the <strong>Sync Opps. First 40 Ready to License Catalog Beta</strong> has been approved.</p>',
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#fff0e7;border:1px solid #fbe2d2;border-radius:13px;"><tr><td style="padding:25px 23px 23px;">',
    '<p style="margin:0 0 9px;font-size:12px;line-height:1.3;font-weight:800;letter-spacing:1.4px;color:#b84911;">NEXT STEP</p>',
    '<h3 style="margin:0 0 20px;font-size:20px;line-height:1.35;font-weight:900;letter-spacing:-.4px;color:#201814;">Submit your music to the catalog.</h3>',
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td align="center" style="background:#b94505;border-radius:28px;">',
    '<a href="'+formUrl+'" style="display:inline-block;padding:13px 24px;background:#b94505;border-radius:28px;color:#ffffff;font-size:15px;line-height:1.4;font-weight:bold;text-decoration:none;">Submit Your Music &rarr;</a>',
    '</td></tr></table>',
    '<p style="margin:19px 0 0;font-size:13px;line-height:1.65;color:#3c332e;">Use your verified Patreon email. Include an authorized streaming link or MP3 preview (up to 10 MB) and accurate songwriter, publishing and master ownership details.</p>',
    '</td></tr></table>',
    '<hr style="height:1px;border:0;background:#f1d8c8;margin:27px 0 25px;">',
    '<h3 style="margin:0 0 13px;font-size:23px;line-height:1.3;letter-spacing:-.5px;font-weight:900;color:#1a1513;">What happens next?</h3>',
    '<p style="margin:0 0 16px;font-size:14px;line-height:1.75;color:#3b3530;">Every submission is reviewed before public playback. Approved music or previews can be heard by anyone in our public catalog. We will share the catalog with our licensing partners and promote it through paid advertising targeting music buyers.</p>',
    '<p style="margin:0 0 23px;font-size:14px;line-height:1.75;color:#3b3530;">You keep your rights and 100% of licensing fees. Participation does not guarantee publication, buyer inquiries or licensing placements.</p>',
    '<p style="margin:0;font-size:15px;line-height:1.65;color:#27201b;font-style:italic;font-weight:bold;">The Sync Opps. team</p>',
    '</td></tr>',
    '<tr><td style="padding:19px 26px 22px;text-align:center;background:#f8dfce;border-top:1px solid #f2d3c1;">',
    '<p style="margin:0;font-size:12px;line-height:1.6;color:#5a4b44;">Having trouble with the button? <a href="'+formUrl+'" style="color:#a43f0b;text-decoration:underline;font-weight:bold;">Open the submission form</a>.</p>',
    '</td></tr>',
    '</table></td></tr></table></body></html>'
  ].join('');
}
function soBBBuyerEmail_(r){
 return 'A potential music licensing buyer has submitted an inquiry through the Sync Opps. Ready to License Catalog.\n\n'+
  'Song: '+r['Song Title']+'\nSong ID: '+r['Song ID']+'\n'+
  'Buyer: '+r['Buyer Name']+'\nBuyer email: '+r['Buyer Email (PRIVATE)']+'\n'+
  'Company/production: '+(r['Company / Production']||'Not provided')+'\n'+
  'Project: '+(r['Project / Campaign Name']||'Not provided')+'\n'+
  'Project media: '+(r['Media Type of Project']||'Not provided')+'\n'+
  'Intended music use: '+(r['Music Use']||'Not provided')+'\n'+
  'Nonbinding licensing fee offer (USD): '+(r['Licensing Fee Offer (USD)']||'Not provided')+'\n\n'+
  'Message:\n'+r['Licensing Inquiry Message']+'\n\n'+
  'Reply directly to the buyer if you wish to discuss this inquiry. You and the relevant rights holders negotiate and execute any licenses directly. Sync Opps. makes no guarantee of licensing or buyer authenticity and takes no commission. Verify all rights, restrictions and approvals independently.';
}
function soBBEmail_(s){return String(s||'').trim().toLowerCase().slice(0,254);}
function soBBEmailValid_(s){
  if(!s||s.includes('..')||/[\r\n\s]/.test(s))return false;
  if(!/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9.-]+$/.test(s))return false;
  const d=s.split('@')[1],labels=d.split('.');
  return labels.length>=2&&labels.every(k=>k.length>=1&&k.length<=63&&
    /^[A-Za-z0-9]/.test(k)&&/[A-Za-z0-9]$/.test(k)&&/^[A-Za-z0-9-]+$/.test(k))&&
    /^[A-Za-z]{2,24}$/.test(labels[labels.length-1]);
}
function soBBText_(s,n){
  const v=String(s??'').replace(/[\u0000-\u001F\u007F]/g,' ').trim().slice(0,n||500);
  // Strings from Tally are untrusted. Prevent formula injection in Google Sheets.
  return /^[=+@-]/.test(v) ? String.fromCharCode(39)+v : v;
}
function soBBHeader_(s){return soBBText_(s,130).replace(/[\r\n]/g,' ');}
function soBBDate_(v){const d=new Date(v);return Number.isFinite(d.getTime())?d:new Date();}
function soBBSort_(a,b){return new Date(a.submittedAt||0)-new Date(b.submittedAt||0);}
