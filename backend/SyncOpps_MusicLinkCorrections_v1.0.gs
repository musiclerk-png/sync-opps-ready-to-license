/**
 * Optional music link correction workflow, intended for the existing private
 * Beta + Buyer Apps Script project. Disabled until installed and explicitly enabled.
 * No new script project, public feed access, credentials or automatic publication.
 * One request per hidden streaming song, one-time token, existing member identity.
 */
const SO_LC = Object.freeze({
  formId:'KpVK1K', formUrl:'https://tally.so/r/KpVK1K',
  tab:'Music Link Corrections (PRIVATE)', enableProperty:'SO_LINK_CORRECTIONS_ENABLED',
  sender:'syncoppsofficial@gmail.com', maxPerRun:5, ttlMs:14*86400000,
  headers:['Song ID','Playback Issue (PRIVATE)','Admin Action','Status','Member ID','Original Fingerprint','Token Hash (PRIVATE)','Requested On','Expires On','Correction Submission ID','Corrected Platform','Corrected Link (PRIVATE)','Received On','Applied On','Admin Notes (PRIVATE)'],
  fields:{token:'06e89e17-0ffb-465f-87d7-fc10065d644f',song:'60b83fca-4f00-4f1e-9d85-fb5f5ef344f1',email:'0654132e-e1a6-473a-b7a5-e8e93ec61316',platform:'89c291aa-ee19-47ae-8b77-a2c767b216ef',link:'2f2f8392-af5f-4ae0-81f7-d378eedfd0ea',consent:'71e9e94b-b61a-4235-a331-0cf288c6cf14'},
  consentText:'I authorize public listening to this corrected music link after approval and confirm that the song and its rights information have not changed.',
  platforms:['SoundCloud','Bandcamp','Spotify','YouTube','Apple Music','DISCO','Artist Website','Direct MP3','Dropbox audio','Google Drive audio']
});
function soLCText_(v){return String(v??'').trim();}
function soLCHash_(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(s),Utilities.Charset.UTF_8).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');}
function soLCFingerprint_(s){return soLCHash_(JSON.stringify([s['Song ID'],s['Member ID'],s['Tally Submission ID'],s['Music Source'],s['Stream URL'],s['Authorized Embed Reference']]));}
function soLCRecord_(table,row){return Object.fromEntries(table.headers.map((h,i)=>[h,soLCText_(row[i])]));}
function soLCUnique_(table,key,value){const hits=table.rows.map((row,i)=>({row,i})).filter(x=>soBBC_(x.row,table,key)===value);return hits.length===1?{i:hits[0].i,row:soLCRecord_(table,hits[0].row)}:null;}
function soLCEligible_(song,member,beta){
  return !!song&&!!member&&!!beta&&song['Catalog Status']==='Hidden'&&
    !song['Preview Host Public ID (PRIVATE)']&&
    !/managed mp3|upload authorized mp3/i.test(song['Music Source'])&&
    !/withdraw|removed|archive|reject|pause/i.test(song['Review Status'])&&
    song['Member Listing Authorization']==='Yes'&&
    member['Member ID']===song['Member ID']&&member['Membership Status']==='Active Paid'&&
    ['$5 Standard','$10 Pro'].includes(member['Patreon Tier'])&&!!member['Eligibility Verified On']&&
    soBBEmailValid_(soBBEmail_(member['Patreon Email (PRIVATE)']))&&
    beta['Member ID']===member['Member ID']&&beta['Invite Status']==='Accepted'&&beta['Eligibility Verified']==='Yes';
}
function soLCUrlValid_(s){
  // No server-side fetch of member-provided URLs. Actual provider and playback
  // checks remain mandatory; a safe-shaped HTTPS URL alone is NOT approval.
  return typeof s==='string'&&s.length<=2500&&/^https:\/\/[a-z0-9.-]+(?::443)?(?:[/?#][^\s<>"'\\]*)?$/i.test(s)&&
    !/^https:\/\/(?:localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(s);
}
function soLCAnswers_(sub){
  const map={},fields=SO_LC.fields;
  for(const r of (sub.responses||[])){
    const value=r.formattedAnswer!==undefined&&r.formattedAnswer!==null&&r.formattedAnswer!==''?r.formattedAnswer:r.answer;
    for(const [k,id] of Object.entries(fields)){
      if(r.questionId===id||r.questionId===({email:'94f0cc73-6f60-4a4f-9a6e-9bdc88f909ef',link:'88cd22a9-23d8-4e7e-beb5-7348cabe67a2',consent:'3a5a2f41-9f1b-453e-8c5f-9a030ecc4279'}[k]||'')){
        if(map[k]!==undefined)throw Error('Duplicate correction field');
        map[k]=Array.isArray(value)?value.map(String).join(', '):soLCText_(value);
      }
    }
    // Tally may bundle hidden fields in one object; trust only exact names.
    if(r.questionId==='75bf13ed-2c51-4ab7-90d4-c9e80dfe69f9'){
      let v=value;if(typeof v==='string'){try{v=JSON.parse(v);}catch(_){v=null;}}
      if(v&&typeof v==='object'&&!Array.isArray(v)){
        for(const [k,key] of [['token','request_token'],['song','song_id']]){
          if(v[key]!==undefined){if(map[k]!==undefined)throw Error('Duplicate hidden field');map[k]=soLCText_(v[key]);}
        }
      }
    }
  }
  return map;
}
function soLCValidate_(q,a,song,member,beta,now){
  if(q.Status!=='Awaiting Corrected Link'||!soLCEligible_(song,member,beta))return false;
  if(!a.token||!/^LC-[a-f0-9]{64}$/i.test(a.token)||soLCHash_(a.token)!==q['Token Hash (PRIVATE)'])return false;
  if(!Number.isFinite(Number(q['Expires On']))||Number(q['Expires On'])<=now)return false;
  if(a.song!==q['Song ID']||song['Song ID']!==q['Song ID']||q['Member ID']!==member['Member ID'])return false;
  if(soLCFingerprint_(song)!==q['Original Fingerprint'])return false;
  if(soBBEmail_(a.email)!==soBBEmail_(member['Patreon Email (PRIVATE)']))return false;
  if(!SO_LC.platforms.includes(a.platform)||!soLCUrlValid_(a.link))return false;
  return a.consent===SO_LC.consentText||a.consent==='true'||a.consent==='TRUE'||a.consent==='3a5a2f41-9f1b-453e-8c5f-9a030ecc4279';
}
function soLCSafeCell_(v){const s=soLCText_(v);return /^[=+@-]/.test(s)?"'"+s:s;}
function soLCTargets_(q,songs,members,beta){
  const s=soLCUnique_(songs,'Song ID',q['Song ID']);
  const m=s&&soLCUnique_(members,'Member ID',s.row['Member ID']);
  const b=m&&soLCUnique_(beta,'Member ID',m.row['Member ID']);
  return {s,m,b,ok:!!(s&&m&&b&&soLCEligible_(s.row,m.row,b.row))};
}
function soLCMessage_(song,issue,token){
  const params=[['request_token',token],['song_id',song['Song ID']],['song_title',song['Song Title']],['issue',issue]].map(([k,v])=>k+'='+encodeURIComponent(v)).join('&');
  return 'Hi,\n\nWhile reviewing your submission of "'+song['Song Title']+'" for our Ready to License Catalog, we discovered an issue with your music link.\n\nIssue: '+issue+'\n\nPlease use the link below to test and provide a corrected music link.\n\n'+SO_LC.formUrl+'?'+params+'\n\nYou do not need to resubmit your song or rights information.\n\nThanks,\nSync Opps.';
}
function soLCProcess_(book,form,allowSend){
  const queue=soBBTable_(book,SO_LC.tab),songs=soBBTable_(book,'Songs'),members=soBBTable_(book,'Members'),beta=soBBTable_(book,'Beta 40'),staging=soBBTable_(book,'Public Staging');
  SO_LC.headers.forEach(h=>soBBI_(queue,h));
  const counts={sent:0,received:0,applied:0,blocked:0,uncertain:0};
  const now=Date.now();
  // Only an explicit admin action may send. Ambiguous sends are never retried.
  for(let i=0;i<queue.rows.length;i++){
    if(counts.sent>=SO_LC.maxPerRun)break;
    const q=soLCRecord_(queue,queue.rows[i]);
    if(q['Admin Action']!=='Send Request'||q.Status)continue;
    const t=soLCTargets_(q,songs,members,beta),issue=q['Playback Issue (PRIVATE)'];
    const duplicate=queue.rows.some((row,j)=>j!==i&&soBBC_(row,queue,'Song ID')===q['Song ID']&&!['Applied','Cancelled','Expired','Rejected'].includes(soBBC_(row,queue,'Status')));
    if(!t.ok||!issue||issue.length>500||duplicate){counts.blocked++;continue;}
    if(!allowSend||Session.getEffectiveUser().getEmail().toLowerCase()!==SO_LC.sender||MailApp.getRemainingDailyQuota()<1)continue;
    const token='LC-'+(Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,'');
    // Mark sending before email. A crash leaves Sending for manual reconciliation.
    soBBPatch_(queue,i,{'Admin Action':'','Status':'Sending','Member ID':t.m.row['Member ID'],'Original Fingerprint':soLCFingerprint_(t.s.row),'Token Hash (PRIVATE)':soLCHash_(token),'Requested On':String(now),'Expires On':String(now+SO_LC.ttlMs)});
    SpreadsheetApp.flush();
    try{
      MailApp.sendEmail({to:soBBEmail_(t.m.row['Patreon Email (PRIVATE)']),subject:'Sync Opps. | Music Link Correction Needed',body:soLCMessage_(t.s.row,issue,token),name:'Sync Opps.'});
    }catch(_){soBBPatch_(queue,i,{'Status':'Delivery Uncertain','Admin Notes (PRIVATE)':'Manual reconciliation required. No automatic resend.'});counts.uncertain++;continue;}
    soBBPatch_(queue,i,{'Status':'Awaiting Corrected Link'});
    soBBPatch_(songs,t.s.i,{'Review Status':'Awaiting Corrected Link'});
    counts.sent++;
  }
  const used=new Set(queue.rows.map(r=>soBBC_(r,queue,'Correction Submission ID')).filter(Boolean));
  const subs=(form.submissions||[]).slice().sort(soBBSort_);
  for(const sub of subs){
    if(counts.received>=SO_LC.maxPerRun)break;
    if(!sub.id||used.has(sub.id)||sub.isCompleted===false)continue;
    let a;try{a=soLCAnswers_(sub);}catch(_){continue;}
    const matches=queue.rows.map((row,i)=>({q:soLCRecord_(queue,row),i})).filter(x=>x.q.Status==='Awaiting Corrected Link'&&a.token&&x.q['Token Hash (PRIVATE)']===soLCHash_(a.token));
    if(matches.length!==1)continue;
    const {q,i}=matches[0],t=soLCTargets_(q,songs,members,beta);
    if(!t.ok||!soLCValidate_(q,a,t.s.row,t.m.row,t.b.row,now)){counts.blocked++;continue;}
    soBBPatch_(queue,i,{'Status':'Correction Received','Correction Submission ID':sub.id,'Corrected Platform':a.platform,'Corrected Link (PRIVATE)':soLCSafeCell_(a.link),'Received On':String(now),'Token Hash (PRIVATE)':'','Admin Action':''});
    used.add(sub.id);counts.received++;
  }
  // Candidate acceptance is a separate admin action. Never publish or grant
  // rights/hosting. Existing approval process must recheck playback & staging.
  for(let i=0;i<queue.rows.length;i++){
    const q=soLCRecord_(queue,queue.rows[i]);
    if(q['Admin Action']!=='Apply Corrected Link'||q.Status!=='Correction Received')continue;
    const t=soLCTargets_(q,songs,members,beta);
    if(!t.ok||soLCFingerprint_(t.s.row)!==q['Original Fingerprint']||!SO_LC.platforms.includes(q['Corrected Platform'])||!soLCUrlValid_(q['Corrected Link (PRIVATE)'])){counts.blocked++;continue;}
    const stages=staging.rows.map((row,j)=>({row,j})).filter(x=>soBBC_(x.row,staging,'Song ID')===q['Song ID']);
    if(stages.length>1){counts.blocked++;continue;}
    for(const st of stages)soBBPatch_(staging,st.j,{'Final QA Check':'No','Ready for Separate Public Export':'No'});
    // One row write: hidden status remains hidden, rights columns unchanged.
    soBBPatch_(songs,t.s.i,{'Music Source':q['Corrected Platform'],'Stream URL':q['Corrected Link (PRIVATE)'],'Authorized Embed Reference':'','Playback Status':'Not Tested','Review Status':'Under Review','Last Stream Check':'','Updated On':new Date()});
    soBBPatch_(queue,i,{'Status':'Applied','Admin Action':'','Applied On':String(now),'Admin Notes (PRIVATE)':'Returned to review. Playback and final publication approvals still required.'});
    counts.applied++;
  }
  return counts;
}
function syncOppsMusicLinkCorrectionsDryRun(){
  const book=soBBBook_(),queue=soBBTable_(book,SO_LC.tab);
  SO_LC.headers.forEach(h=>soBBI_(queue,h));
  const key=PropertiesService.getScriptProperties().getProperty(SO_BB_V1.apiProperty);
  if(!key)throw Error('Tally API key unavailable');
  const form=soBBFetchForm_(SO_LC.formId,key);
  return {mode:'READ ONLY',requests:queue.rows.length,completedResponses:form.submissions.length,emails:0,writes:0};
}
function soLCOnExistingTrigger_(e){
  if(!e||!e.triggerUid)return {status:'NOT_TRIGGER'};
  if(PropertiesService.getScriptProperties().getProperty(SO_LC.enableProperty)!=='true')return {status:'DISABLED'};
  const key=PropertiesService.getScriptProperties().getProperty(SO_BB_V1.apiProperty);
  if(!key)throw Error('Tally API key unavailable');
  const form=soBBFetchForm_(SO_LC.formId,key);
  const lock=LockService.getScriptLock();if(!lock.tryLock(5000))return {status:'BUSY'};
  try{return soLCProcess_(soBBBook_(),form,true);}finally{lock.releaseLock();}
}
