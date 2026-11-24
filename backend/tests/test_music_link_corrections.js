const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const tables={};
const copy=v=>JSON.parse(JSON.stringify(v));
function table(title,headers,records){tables[title]={title,headers,rows:records.map(r=>headers.map(h=>r[h]??''))};}
function rec(t,i){return Object.fromEntries(t.headers.map((h,j)=>[h,t.rows[i][j]]));}
const sent=[];let sender='syncoppsofficial@gmail.com',sendThrows=false;
const c=vm.createContext({console,Date,JSON,Set,Map,Utilities:{DigestAlgorithm:{SHA_256:1},Charset:{UTF_8:1},computeDigest:(_,s)=>Array.from(crypto.createHash('sha256').update(s).digest()),getUuid:()=>crypto.randomUUID()},SpreadsheetApp:{flush:()=>{}},Session:{getEffectiveUser:()=>({getEmail:()=>sender})},MailApp:{getRemainingDailyQuota:()=>100,sendEmail:m=>{sent.push(m);if(sendThrows)throw Error('uncertain');}},soBBTable_:(_,n)=>{if(!tables[n])throw Error('Missing '+n);return tables[n]},soBBI_:(t,k)=>{const i=t.headers.indexOf(k);assert.ok(i>=0,k);return i},soBBC_:(r,t,k)=>String(r[t.headers.indexOf(k)]??'').trim(),soBBPatch_:(t,i,r)=>{for(const [k,v] of Object.entries(r)){const j=t.headers.indexOf(k);assert.ok(j>=0,k);t.rows[i][j]=v}},soBBEmail_:s=>String(s||'').trim().toLowerCase(),soBBEmailValid_:s=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s),soBBSort_:(a,b)=>a.submittedAt-b.submittedAt});
vm.runInContext(fs.readFileSync('backend/SyncOpps_MusicLinkCorrections_v1.0.gs','utf8'),c);
const run=s=>vm.runInContext(s,c),cfg=run('SO_LC');
const id='SONG-TEST123456',email='member@example.com',orig='https://soundcloud.com/test/original',replacement='https://soundcloud.com/test/replacement';
const song={'Song ID':id,'Member ID':'M-1','Tally Submission ID':'S-1','Music Source':'SoundCloud','Stream URL':orig,'Authorized Embed Reference':'','Preview Host Public ID (PRIVATE)':'','Review Status':'Under Review','Catalog Status':'Hidden','Member Listing Authorization':'Yes','Rights Status':'Verified','Playback Status':'Not Tested','Last Stream Check':'','Updated On':'','Song Title':'Synthetic Track'};
const member={'Member ID':'M-1','Patreon Email (PRIVATE)':email,'Membership Status':'Active Paid','Patreon Tier':'$5 Standard','Eligibility Verified On':'2026-11-24'};
const beta={'Member ID':'M-1','Patreon Email (PRIVATE)':email,'Invite Status':'Accepted','Eligibility Verified':'Yes'};
const stage={'Song ID':id,'Final QA Check':'Yes','Ready for Separate Public Export':'Yes','Music Source':'SoundCloud','Stream URL / Embed ID':orig};
const request={'Song ID':id,'Playback Issue (PRIVATE)':'Player blocked','Admin Action':'Send Request'};
function init(overrides={},members=[member],slots=[beta],requests=[request]){sent.length=0;sender='syncoppsofficial@gmail.com';sendThrows=false;table('Songs',Object.keys(song),[{...song,...overrides}]);table('Members',Object.keys(member),members);table('Beta 40',Object.keys(beta),slots);table('Public Staging',Object.keys(stage),[stage]);table(cfg.tab,Array.from(cfg.headers),requests);}
function process(subs=[],allow=true){c.qaForm={submissions:subs};c.qaAllow=allow;return run('soLCProcess_({},qaForm,qaAllow)');}
function q(){return rec(tables[cfg.tab],0)}
function s(){return rec(tables.Songs,0)}
function action(a){c.qaAction=a;run("soBBPatch_(soBBTable_({},SO_LC.tab),0,{'Admin Action':qaAction})")}
function response(token,overrides={},subid='CORR-1'){const a={token,song:id,email,platform:'SoundCloud',link:replacement,consent:cfg.consentText,...overrides};return {id:subid,isCompleted:true,submittedAt:Date.now(),responses:Object.entries(a).map(([k,v])=>({questionId:cfg.fields[k],formattedAnswer:v}))};}
function token(){return new URL(sent[0].body.match(/https:\/\/tally\.so\/r\/\S+/)[0]).searchParams.get('request_token')}
init();assert.equal(process([],false).sent,0);assert.equal(sent.length,0);
sender='wrong@example.com';assert.equal(process().sent,0);sender='syncoppsofficial@gmail.com';
assert.equal(process().sent,1);assert.equal(sent[0].to,email);assert.equal(q().Status,'Awaiting Corrected Link');assert.equal(s()['Catalog Status'],'Hidden');assert.equal(s()['Stream URL'],orig);const tk=token();assert.match(tk,/^LC-[a-f0-9]{64}$/);assert.notEqual(q()['Token Hash (PRIVATE)'],tk);assert.equal(process().sent,0);
for(const a of [{song:'SONG-OTHER'},{email:'other@example.com'},{link:'http://example.com/no'},{link:'https://user:pass@example.com/a'},{consent:'false'},{platform:'unknown'},{token:'LC-'+'a'.repeat(64)}])assert.equal(process([response(tk,a)]).received,0);
assert.equal(process([response(tk)]).received,1);assert.equal(q().Status,'Correction Received');assert.equal(q()['Token Hash (PRIVATE)'],'');assert.equal(s()['Stream URL'],orig);assert.equal(process([response(tk)]).received,0);action('Apply Corrected Link');assert.equal(process().applied,1);assert.equal(s()['Catalog Status'],'Hidden');assert.equal(s()['Rights Status'],'Verified');assert.equal(s()['Stream URL'],replacement);assert.equal(s()['Playback Status'],'Not Tested');assert.equal(s()['Review Status'],'Under Review');assert.equal(rec(tables['Public Staging'],0)['Final QA Check'],'No');assert.equal(rec(tables['Public Staging'],0)['Stream URL / Embed ID'],'');assert.equal(process().applied,0);
console.log('PASS: send approval, sender, token matching, wrong member/song, consent, invalid URL, duplicate, candidate quarantine, explicit apply, staging reset and hidden rights-preserving update');
for(const o of [{'Catalog Status':'Published'},{'Catalog Status':'Paused'},{'Music Source':'Managed MP3 Preview'},{'Preview Host Public ID (PRIVATE)':'existing'},{'Member Listing Authorization':'No'}]){init(o);assert.equal(process().sent,0);}
init({},[{...member,'Membership Status':'Inactive'}]);assert.equal(process().sent,0);
init({},[member],[{...beta,'Patreon Email (PRIVATE)':'other@example.com'}]);assert.equal(process().sent,0);
init({},[member,member]);assert.equal(process().sent,0);
init({},[member],[beta],[request,request]);assert.equal(process().sent,0);
init();sendThrows=true;assert.equal(process().uncertain,1);assert.equal(q().Status,'Delivery Uncertain');assert.equal(process().sent,0);assert.equal(sent.length,1);
init();process();const expiredToken=token();c.expired=String(Date.now()-1);run("soBBPatch_(soBBTable_({},SO_LC.tab),0,{'Expires On':expired})");assert.equal(process([response(expiredToken)]).received,0);assert.equal(q().Status,'Expired');
init();process();const stale=token();run("soBBPatch_(soBBTable_({},'Songs'),0,{'Stream URL':'https://soundcloud.com/test/changed'})");assert.equal(process([response(stale)]).received,0);
console.log('PASS: published/paused/managed exclusions, paid and identity gates, duplicate records, ambiguous send no retry, expiry, stale source protection');
console.log('No actual sheets, email, member records or live catalog touched.');
