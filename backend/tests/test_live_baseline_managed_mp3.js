const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const folder=path.join(__dirname,'..');
const publicCode=fs.readFileSync(path.join(folder,'SyncOpps_PublicCatalogFeed_v1.1.gs'),'utf8');
const buyerCode=fs.readFileSync(path.join(folder,'SyncOpps_Beta_Buyer_Intake_v1.1.gs'),'utf8');
const cloudinary='https://res.cloudinary.com/testcloud/video/upload/v123/sync_opps_catalog_previews/preview_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.mp3';
const assetId='sync_opps_catalog_previews/preview_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const sid='SONG-ABCD12345678',mid='MEM-TEST12345678';
let db={};
const pctx=vm.createContext({PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'TEST_SHEET_ID_STRING_LONG_ENOUGH_TO_PASS'})},SpreadsheetApp:{openById:()=>({getSheetByName:name=>db[name]?({getDataRange:()=>({getDisplayValues:()=>[Object.keys(db[name][0]||{}),...db[name].map(x=>Object.values(x))]})}):null})},console,Date,encodeURIComponent,ContentService:{MimeType:{JAVASCRIPT:'javascript'},createTextOutput:txt=>({txt,setMimeType(){return this;}})}});
vm.runInContext(publicCode,pctx);
const bctx=vm.createContext({console,Date});vm.runInContext(buyerCode,bctx);
function fixture(source='Managed MP3 Preview'){
 return {
 'Public Staging':[{'Song ID':sid,'Song Title':'Sample Track','Artist Display Name':'Example Artist','Genre':'Cinematic','Music Source':source,'Stream URL / Embed ID':source==='Managed MP3 Preview'?cloudinary:'https://soundcloud.com/test/track','Duration':'3:12','Mood Tags':'Hopeful','Great For Tags':'Dramatic Scene','Instrumental Available':'Yes','Explicit Lyrics':'No','Composition Credits / Splits (Consent)':'Example Writer 100%','Publisher Owners / Splits (Consent)':'Example Publishing 100%','Master Owners / Splits (Consent)':'Example Records 100%','Rights Disclosure':'Direct artist authorization','Licensing Restrictions':'None','Buyer Contact Method (Private Form)':'Private form','Buyer Inquiry Form URL (No Public Email)':'https://tally.so/r/jeoYaE','Final QA Check':'Yes','Ready for Separate Public Export':'Yes'}],
 Songs:[{'Song ID':sid,'Member ID':mid,'Catalog Status':'Published','Review Status':'Approved','Member Listing Authorization':'Yes','Private Inquiry Routing Consent':'Yes','Playback Status':'Preview Only','Rights Status':'Verified','Claimed Clearance Route':'Self-Controlled','One-Stop Authority Verification':'Verified','Stream URL':'','Authorized Embed Reference':source==='Managed MP3 Preview'?cloudinary:'','Music Source':source,'Preview Host Authorization (PRIVATE)':'Approved Preview','Preview Host Public ID (PRIVATE)':assetId}],
 Members:[{'Member ID':mid,'Patreon Email (PRIVATE)':'member@private.test','Membership Status':'Active Paid','Patreon Tier':'$5 Standard','Eligibility Verified On':'2026-11-18','Inquiry Routing Consent (Private)':'Yes','Licensing Email (PRIVATE)':'artist@private.test'}],
 'Beta 40':[{'Beta Slot':'1','Member ID':mid,'Patreon Email (PRIVATE)':'member@private.test','Invite Status':'Accepted','Eligibility Verified':'Yes'}],
 'Writer Splits':[{'Song ID':sid,'Writer Credit':'Example Writer','Writer Legal Name':'Example Writer','Writer Ownership % (0-100)':'100.00%','Approved for Public Display':'Yes'}],
 'Publishing Splits':[{'Song ID':sid,'Publisher / Copyright Owner':'Example Publishing','Publishing Ownership % (0-100)':'100.00%','Approved for Public Display':'Yes'}],
 'Master Splits':[{'Song ID':sid,'Master Owner':'Example Records','Master Ownership % (0-100)':'100.00%','Approved for Public Display':'Yes'}]
 };
}
function run(){
 const feed=vm.runInContext('soPublicSnapshotV1_()',pctx);
 const table=n=>({headers:Object.keys(db[n][0]),rows:db[n].map(x=>Object.values(x)),title:n});
 bctx.__args=[sid,'buyer@example.com','Buyer','Film licensing inquiry',table('Songs'),table('Public Staging'),table('Members'),{headers:['Received On','Buyer Email (PRIVATE)','Song ID'],rows:[],title:'Buyer Inquiries'},table('Beta 40'),table('Writer Splits'),table('Publishing Splits'),table('Master Splits')];
 const buyer=vm.runInContext('soBBBuyerEligible_(...__args)',bctx);
 assert.equal(feed.songs.length===1,buyer.allowed,'Public feed and buyer route inconsistent');
 return {feed,buyer};
}
let count=0;
function test(name,kind,mutate,allow){db=structuredClone(fixture(kind));if(mutate)mutate(db);const {feed,buyer}=run();assert.equal(feed.songs.length,allow?1:0,'Feed '+name);assert.equal(buyer.allowed,allow,'Buyer '+name+': '+buyer.reason);if(allow){assert(!JSON.stringify(feed).includes('@private.test'),'Private email exposed');assert.equal(feed.songs[0].player.type,kind==='Managed MP3 Preview'?'mp3':kind.toLowerCase().includes('dropbox')?'dropbox':kind.toLowerCase().includes('google drive')?'gdrive':'soundcloud');}console.log('PASS '+name);count++;}
test('approved managed MP3 + exact active Cloudinary ID','Managed MP3 Preview',null,true);
test('pending hosting authorization', 'Managed MP3 Preview',d=>d.Songs[0]['Preview Host Authorization (PRIVATE)']='Pending',false);
test('deleted host status not approved','Managed MP3 Preview',d=>d.Songs[0]['Preview Host Authorization (PRIVATE)']='Do Not Host',false);
test('revocation clears active Cloudinary ID','Managed MP3 Preview',d=>d.Songs[0]['Preview Host Public ID (PRIVATE)']='',false);
test('revocation clears authorized reference but leaves staging URL','Managed MP3 Preview',d=>d.Songs[0]['Authorized Embed Reference']='',false);
test('private ID differs from staged Cloudinary URL','Managed MP3 Preview',d=>d.Songs[0]['Preview Host Public ID (PRIVATE)']='sync_opps_catalog_previews/preview_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',false);
test('Cloudinary ID wrong folder','Managed MP3 Preview',d=>d.Songs[0]['Preview Host Public ID (PRIVATE)']='other/preview_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',false);
test('private approved URL has wrong host','Managed MP3 Preview',d=>d.Songs[0]['Authorized Embed Reference']='https://storage.tally.so/test.mp3',false);

test('lookalike Cloudinary domain refused','Managed MP3 Preview',d=>d.Songs[0]['Authorized Embed Reference']='https://res.cloudinary.com.evil.example/testcloud/video/upload/v123/sync_opps_catalog_previews/preview_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.mp3',false);
test('attacker hosted fake Cloudinary path refused','Managed MP3 Preview',d=>d.Songs[0]['Authorized Embed Reference']='https://evil.example/testcloud/video/upload/v123/sync_opps_catalog_previews/preview_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.mp3',false);
test('Cloudinary wrong resource type refused','Managed MP3 Preview',d=>d.Songs[0]['Authorized Embed Reference']='https://res.cloudinary.com/testcloud/image/upload/v123/sync_opps_catalog_previews/preview_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.mp3',false);
test('Cloudinary wrong delivery path refused','Managed MP3 Preview',d=>d.Songs[0]['Authorized Embed Reference']='https://res.cloudinary.com/testcloud/video/authenticated/v123/sync_opps_catalog_previews/preview_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.mp3',false);
test('Cloudinary malformed unversioned path refused','Managed MP3 Preview',d=>d.Songs[0]['Authorized Embed Reference']='https://res.cloudinary.com/testcloud/video/upload/sync_opps_catalog_previews/preview_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.mp3',false);
test('staging switches managed source to SoundCloud','Managed MP3 Preview',d=>{d['Public Staging'][0]['Music Source']='SoundCloud';d['Public Staging'][0]['Stream URL / Embed ID']='https://soundcloud.com/test/track';},false);
test('approved normal SoundCloud unaffected','SoundCloud',null,true);
const dropboxLink='https://www.dropbox.com/scl/fi/abcDEFG123456/owner-authorized-song.wav?rlkey=real-link-key&dl=0';
const driveLink='https://drive.google.com/file/d/1X2y3Z4aBcDeFgHiJkLmNoPqRstuVwxy/preview';
function previewLink(d,url){d['Public Staging'][0]['Stream URL / Embed ID']=url;d.Songs[0]['Stream URL']=url;}
test('Dropbox owner-authorized audio remains subject to existing rights gates','Dropbox MP3',d=>previewLink(d,dropboxLink),true);
test('Dropbox paused track suppresses player and inquiry','Dropbox MP3',d=>{previewLink(d,dropboxLink);d.Songs[0]['Catalog Status']='Paused';},false);
test('Dropbox unapproved master owner suppresses publication','Dropbox MP3',d=>{previewLink(d,dropboxLink);d['Master Splits'][0]['Approved for Public Display']='No';},false);
test('Dropbox folder and URL spoofing fail closed','Dropbox MP3',d=>previewLink(d,'https://www.dropbox.com/home/song.mp3'),false);
test('Dropbox lookalike hostname fails closed','Dropbox MP3',d=>previewLink(d,'https://dropbox.com.attacker.example/scl/fi/abc/song.mp3'),false);
test('Google Drive approved individual file supports buyer route','Google Drive MP3',d=>previewLink(d,driveLink),true);
test('Google Drive folder rejected','Google Drive MP3',d=>previewLink(d,'https://drive.google.com/drive/folders/1X2y3Z4aBcDeFgHiJkLmNoPqRstuVwxy'),false);
test('Google Drive wrong-host preview rejected','Google Drive MP3',d=>previewLink(d,'https://drive.google.com.attacker.example/file/d/1X2y3Z4aBcDeFgHiJkLmNoPqRstuVwxy/preview'),false);
test('Google Drive withdrawn track suppresses buyer route','Google Drive MP3',d=>{previewLink(d,driveLink);d.Songs[0]['Catalog Status']='Withdrawn';},false);

test('SoundCloud staged source cannot masquerade as managed','SoundCloud',d=>d['Public Staging'][0]['Music Source']='Managed MP3 Preview',false);
test('withdrawn track suppresses both','Managed MP3 Preview',d=>d.Songs[0]['Catalog Status']='Withdrawn',false);
test('paused track suppresses both','Managed MP3 Preview',d=>d.Songs[0]['Catalog Status']='Paused',false);
test('hidden track suppresses both','Managed MP3 Preview',d=>d.Songs[0]['Catalog Status']='Hidden',false);
test('unverified paid membership suppresses both','Managed MP3 Preview',d=>d.Members[0]['Membership Status']='Unverified',false);
test('beta slot unaccepted suppresses both','Managed MP3 Preview',d=>d['Beta 40'][0]['Invite Status']='Pending',false);
test('writer public consent missing suppresses both','Managed MP3 Preview',d=>d['Writer Splits'][0]['Approved for Public Display']='No',false);
test('publishing public consent missing suppresses both','Managed MP3 Preview',d=>d['Publishing Splits'][0]['Approved for Public Display']='No',false);
test('master public consent missing suppresses both','Managed MP3 Preview',d=>d['Master Splits'][0]['Approved for Public Display']='No',false);
test('incomplete rights shares suppress both','Managed MP3 Preview',d=>d['Writer Splits'][0]['Writer Ownership % (0-100)']='75%',false);
test('buyer inquiry form mismatch suppresses both','Managed MP3 Preview',d=>d['Public Staging'][0]['Buyer Inquiry Form URL (No Public Email)']='https://tally.so/r/other',false);
test('one-stop unverified suppresses both','Managed MP3 Preview',d=>d.Songs[0]['One-Stop Authority Verification']='Pending Review',false);

// BatchGet synthetic parity and fail-closed tests. No production spreadsheet access.
{
 db=structuredClone(fixture());
 const baseline=JSON.parse(JSON.stringify(vm.runInContext('soPublicSnapshotV1_()',pctx)));
 const names=['Public Staging','Songs','Members','Beta 40','Writer Splits','Publishing Splits','Master Splits'];
 let requests=0;
 pctx.ScriptApp={getOAuthToken:()=> 'synthetic-token-no-real-scopes'};
 const formattedResponse=(overrideNames=names)=>({
   valueRanges:overrideNames.map(name=>({
     range:"'"+name+"'!A1:ZZ100",
     majorDimension:'ROWS',
     values:[Object.keys(db[name][0]),...db[name].map(row=>Object.values(row))]
   }))
 });
 pctx.UrlFetchApp={fetch:(url,opts)=>{
   requests++;
   assert.equal(new URL(url).hostname,'sheets.googleapis.com');
   assert.equal(new URL(url).pathname,'/v4/spreadsheets/TEST_SHEET_ID_STRING_LONG_ENOUGH_TO_PASS/values:batchGet');
   assert.equal(new URL(url).searchParams.get('valueRenderOption'),'FORMATTED_VALUE');
   assert.equal(new URL(url).searchParams.get('majorDimension'),'ROWS');
   assert.deepEqual(new URL(url).searchParams.getAll('ranges'),names.map(n=>"'"+n+"'"));
   assert.equal(opts.headers.Authorization,'Bearer synthetic-token-no-real-scopes');
   assert.equal(opts.followRedirects,false);
   return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(formattedResponse())};
 }};
 const batched=JSON.parse(JSON.stringify(vm.runInContext('soPublicSnapshotV1_()',pctx)));
 assert.deepEqual(batched,baseline,'Batch read must match legacy public payload including ownership and buyer routing');
 assert.equal(requests,1,'One API read must replace seven individual reads');
 console.log('PASS approved catalog batchGet parity and single-request behavior');
 db.Songs[0]['Catalog Status']='Withdrawn';
 assert.equal(vm.runInContext('soPublicSnapshotV1_()',pctx).songs.length,0,'No cached withdrawn song in batchGet');
 db=structuredClone(fixture());
 db['Master Splits'][0]['Approved for Public Display']='No';
 assert.equal(vm.runInContext('soPublicSnapshotV1_()',pctx).songs.length,0,'BatchGet cannot bypass master consent');
 db=structuredClone(fixture());
 pctx.UrlFetchApp.fetch=()=>({getResponseCode:()=>403,getContentText:()=>''});
 const denied=JSON.parse(JSON.stringify(vm.runInContext('soPublicSnapshotV1_()',pctx)));
 assert.deepEqual(denied,baseline,'Scope/enablement error must fallback to full fresh legacy checks');
 db.Songs[0]['Catalog Status']='Withdrawn';
 assert.equal(vm.runInContext('soPublicSnapshotV1_()',pctx).songs.length,0,'Denied API fallback cannot return withdrawn song');
 db=structuredClone(fixture());
 pctx.UrlFetchApp.fetch=()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify({valueRanges:[{range:"'Songs'!A1",values:[]} ]})});
 assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext('soPublicSnapshotV1_()',pctx))),baseline,
   'Malformed incomplete API response must use existing live reader instead');
 db=structuredClone(fixture());
 pctx.UrlFetchApp.fetch=()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify(formattedResponse(names.slice().reverse()))});
 assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext('soPublicSnapshotV1_()',pctx))),baseline,
   'Misordered API range data must be rejected and freshly re-read');
 db=structuredClone(fixture());
 pctx.UrlFetchApp.fetch=()=>{throw Error('synthetic remote network failure');};
 assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext('soPublicSnapshotV1_()',pctx))),baseline,
   'Network failure must use fresh eligible data, not a stored snapshot');
 // The optional probe must not change normal buyer-facing JSONP results.
 db=structuredClone(fixture());
 pctx.UrlFetchApp.fetch=()=>({
   getResponseCode:()=>200,
   getContentText:()=>JSON.stringify(formattedResponse())
 });
 const parseJsonp=txt=>{
   const prefix='window.syncOppsApprovedFeedV1(';
   assert.ok(txt.startsWith(prefix)&&txt.endsWith(');'),'Exact approved JSONP wrapper required');
   return JSON.parse(txt.slice(prefix.length,-2));
 };
 const normal=parseJsonp(vm.runInContext('doGet({parameter:{}})',pctx).txt);
 assert.equal(normal.readDiagnostics,undefined,'Normal visitor response has no performance metadata');
 assert.equal(normal.songs.length,1);
 const probe=parseJsonp(vm.runInContext('doGet({parameter:{benchmark:"1"}})',pctx).txt);
 assert.equal(probe.readDiagnostics.path,'batch');
 assert.equal(probe.readDiagnostics.fallbackReason,'none');
 assert.ok(Number.isFinite(probe.readDiagnostics.serverMs)&&probe.readDiagnostics.serverMs>=0);
 assert.ok(!JSON.stringify(probe).includes('@private.test'));
 pctx.UrlFetchApp.fetch=()=>({getResponseCode:()=>403,getContentText:()=>''});
 const legacyProbe=parseJsonp(vm.runInContext('doGet({parameter:{benchmark:"1"}})',pctx).txt);
 assert.equal(legacyProbe.readDiagnostics.path,'legacy');
 assert.equal(legacyProbe.readDiagnostics.fallbackReason,'HTTP_403');
 assert.equal(legacyProbe.songs.length,1);
 pctx.UrlFetchApp.fetch=()=>({getResponseCode:()=>403,getContentText:()=>
   JSON.stringify({error:{message:'Google Sheets API has not been used in project, is disabled',status:'PERMISSION_DENIED'}})});
 const disabledProbe=parseJsonp(vm.runInContext('doGet({parameter:{benchmark:"1"}})',pctx).txt);
 assert.equal(disabledProbe.readDiagnostics.fallbackReason,'API_DISABLED');
 pctx.UrlFetchApp.fetch=()=>({getResponseCode:()=>403,getContentText:()=>
   JSON.stringify({error:{details:[{reason:'ACCESS_TOKEN_SCOPE_INSUFFICIENT'}]}})});
 const scopeProbe=parseJsonp(vm.runInContext('doGet({parameter:{benchmark:"1"}})',pctx).txt);
 assert.equal(scopeProbe.readDiagnostics.fallbackReason,'OAUTH_SCOPE');
 delete pctx.ScriptApp;
 delete pctx.UrlFetchApp;
 console.log('PASS batchGet revoked rights, withdrawal, 403, incomplete, order and transport fail-closed');
 console.log('PASS optional nonprivate batch versus legacy timing probes');
}

function checkSoulPocketReadOnlyPreflight(opts={}){
  const code=fs.readFileSync(path.join(folder,'SyncOpps_Internal_MP3_Preflight.gs'),'utf8');
  const tables={
    Songs:[{'Song ID':'SONG-F385434E4A218F46868E','Tally Submission ID':'jej0M1Q',
       'Member ID':'MEM-12216320AA80D27AD67C','Song Title':'Soul Pocket Groove',
       'Artist Display Name':'MacMc','Music Source':'Managed MP3 Preview',
       'Catalog Status':'Hidden','Preview Host Authorization (PRIVATE)':'Pending',
       'Authorized Embed Reference':'','Stream URL':'','Preview Host Public ID (PRIVATE)':''}],
    Members:[{'Member ID':'MEM-12216320AA80D27AD67C','Patreon Tier':'$10 Pro',
       'Membership Status':'Active Paid'}],
    'Beta 40':[{'Member ID':'MEM-12216320AA80D27AD67C','Invite Status':'Accepted'}],
    'Tally Raw Responses':[{'Submission ID':'jej0M1Q'}]
  };
  if(opts.invalidMember)tables.Members[0]['Membership Status']='Unverified';
  if(opts.invalidStatus)tables.Songs[0]['Catalog Status']='Published';
  const ops=[];
  const ctx=vm.createContext({
    SYNC_OPPS_CONFIG:{spreadsheetId:'SYNTHETIC_PRIVATE_SHEET'},
    SpreadsheetApp:{openById:()=>({})},
    syncOppsPreviewTable_:(_,tab)=>({rows:tables[tab]}),
    syncOppsPreviewC_:(row,key)=>String((row||{})[key]||'').trim(),
    syncOppsPreviewEligibility_:()=>!opts.badBeta,
    syncOppsPreviewBlob_:(_,sid,slot)=>{ops.push('read:'+sid+':'+slot);
       if(opts.badMp3)throw Error('MP3 signature invalid');
       return {getBytes:()=>Array(1024).fill(73)};},
    syncOppsPreviewUsageGuard_:()=>{ops.push('checkQuota');
       if(opts.badQuota)throw Error('Cloudinary quota unavailable');
       return {creditsUsedPercent:1};},
    Logger:{log:(txt)=>ops.push('log:'+txt)}
  });
  vm.runInContext(code,ctx);
  let result,err;
  try{result=vm.runInContext('syncOppsSoulPocketGroovePreflight()',ctx)}
  catch(e){err=e}
  return {result,err,ops};
}
{
  const success=checkSoulPocketReadOnlyPreflight();
  assert.equal(success.err,undefined);
  assert.equal(success.result.submissionId,'jej0M1Q');
  assert.equal(success.result.songId,'SONG-F385434E4A218F46868E');
  assert.equal(success.result.privateMp3ReadAndSignatureVerified,true);
  assert.equal(success.result.verifiedPaidBetaMember,true);
  assert.equal(success.result.publicUploadAttempted,false);
  assert.equal(success.result.spreadsheetWrites,0);
  assert.equal(success.result.newTriggersCreated,0);
  assert.equal(success.ops.filter(v=>v.startsWith('read:')).length,1);
  assert.equal(success.ops.filter(v=>v==='checkQuota').length,1);
  for(const altered of [{invalidMember:true},{invalidStatus:true},{badBeta:true},
                        {badMp3:true},{badQuota:true}]){
    const check=checkSoulPocketReadOnlyPreflight(altered);
    assert.ok(check.err,'unsafe preflight inputs must fail closed');
    assert.equal(check.ops.some(v=>/upload|publish|sendEmail|setValue/.test(v)),false);
  }
  console.log('SOUL POCKET PRIVATE PREFLIGHT: safe and fail-closed cases passed');
}
console.log('TOTAL '+count+' approved and fail-closed cases passed');
