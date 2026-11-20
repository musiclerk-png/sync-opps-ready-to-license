'use strict';
// Entirely synthetic, in-memory regression tests. No network, Sheets or email.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','SyncOpps_Beta_Buyer_Intake_v1.1.gs'),'utf8');
const sid='SONG-ABCD12345678',mid='MEM-TEST12345678', memberEmail='member@example.test',buyerEmail='buyer@example.test';
const asset='sync_opps_catalog_previews/preview_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const cloud='https://res.cloudinary.com/testcloud/video/upload/v123/'+asset+'.mp3';
const questions=[
{id:'qname',title:'Your name'},{id:'qemail',title:'Your email address'},
{id:'qmsg',title:'Tell the artist about your project and licensing needs'},
{id:'qmedia',title:'Media Type of Project'},
{id:'quse',title:'How would you use the music? Select all that apply.'}
];
const buyerSubmission={id:'SYNTHBUYER001',isCompleted:true,submittedAt:new Date().toISOString(),responses:[
{questionId:'df717da1-af43-4d37-9098-32b8d1e5054b',answer:sid},
{questionId:'qname',answer:'Synthetic Buyer'},{questionId:'qemail',answer:buyerEmail},
{questionId:'qmsg',answer:'Noncommercial software-only routing test'},
{questionId:'qmedia',answer:'Film'},{questionId:'quse',answer:'Sync in film'}]};
const definitions={
'Songs':[{'Song ID':sid,'Song Title':'Synthetic Authorized Track','Member ID':mid,'Catalog Status':'Published','Review Status':'Approved','Member Listing Authorization':'Yes','Private Inquiry Routing Consent':'Yes','Playback Status':'Preview Only','Rights Status':'Verified','Claimed Clearance Route':'Self-Controlled','One-Stop Authority Verification':'Verified','Music Source':'Managed MP3 Preview','Authorized Embed Reference':cloud,'Stream URL':'','Preview Host Authorization (PRIVATE)':'Approved Preview','Preview Host Public ID (PRIVATE)':asset}],
'Public Staging':[{'Song ID':sid,'Song Title':'Synthetic Authorized Track','Artist Display Name':'Synthetic Artist','Genre':'Indie','Music Source':'Managed MP3 Preview','Stream URL / Embed ID':cloud,'Composition Credits / Splits (Consent)':'Writer 100%','Publisher Owners / Splits (Consent)':'Publisher 100%','Master Owners / Splits (Consent)':'Master 100%','Final QA Check':'Yes','Ready for Separate Public Export':'Yes','Buyer Inquiry Form URL (No Public Email)':'https://tally.so/r/jeoYaE'}],
'Members':[{'Member ID':mid,'Patreon Email (PRIVATE)':memberEmail,'Artist / Band Display Name':'Synthetic Artist','Membership Status':'Active Paid','Patreon Tier':'$5 Standard','Eligibility Verified On':'2026-11-20','Inquiry Routing Consent (Private)':'Yes','Licensing Email (PRIVATE)':'rights@example.test'}],
'Beta 40':[{'Beta Slot':'1','Member ID':mid,'Patreon Email (PRIVATE)':memberEmail,'Invite Status':'Accepted','Eligibility Verified':'Yes'}],
'Writer Splits':[{'Song ID':sid,'Writer Credit':'Writer','Writer Legal Name':'Writer','Writer Ownership % (0-100)':'100%','Approved for Public Display':'Yes'}],
'Publishing Splits':[{'Song ID':sid,'Publisher / Copyright Owner':'Publisher','Publishing Ownership % (0-100)':'100%','Approved for Public Display':'Yes'}],
'Master Splits':[{'Song ID':sid,'Master Owner':'Master','Master Ownership % (0-100)':'100%','Approved for Public Display':'Yes'}],
'Buyer Inquiries':[], 'Beta Applications (PRIVATE)':[]
};
const inquiryHeaders=['Inquiry ID','Received On','Song ID','Song Title','Member ID','Buyer Name','Company / Production','Buyer Email (PRIVATE)','Licensing Fee Offer (USD)','Music Use','Music Use Other','Media Type of Project','Media Type Other','Project / Campaign Name','Licensing Inquiry Message','Routing Contact Email (PRIVATE)','Delivery Status','Delivered On','Buyer Reply-To (PRIVATE)','Spam Review','Admin Notes (PRIVATE)'];
const betaHeaders=['Tally Submission ID','Submitted On','Patreon Email (PRIVATE)','Artist / Band (Claimed)','Tier (Claimed)','Music Link (PRIVATE)','Questions (PRIVATE)','Member ID (Matched)','Paid Eligibility','Identity Verification','Admin Decision','Processing Status','Assigned Beta Slot','Last Reviewed On','Admin Notes (PRIVATE)'];
function setup(overrides={}) {
 let sends=[],quota=10,writeCount=0;
 const db=structuredClone(definitions);
 if(overrides.hidden)db.Songs[0]['Catalog Status']='Hidden';
 if(overrides.unverifiedMember)db.Members[0]['Membership Status']='Unverified';
 if(overrides.noHostAuth)db.Songs[0]['Preview Host Authorization (PRIVATE)']='Pending';
 if(overrides.fakeHost)db.Songs[0]['Authorized Embed Reference']='https://evil.example/testcloud/video/upload/v123/'+asset+'.mp3';
 if(overrides.withdrawn)db.Songs[0]['Catalog Status']='Withdrawn';
 const headers={...Object.fromEntries(Object.entries(db).map(([name,arr])=>[name,arr.length?Object.keys(arr[0]):[]])), 'Buyer Inquiries':inquiryHeaders,'Beta Applications (PRIVATE)':betaHeaders};
 function table(name){
   const h=headers[name];let data=db[name].map(o=>h.map(k=>o[k]??''));
   return {getDataRange(){return {getValues(){return [h,...data.map(x=>x.slice())]}}},getLastRow(){return data.length+1},getRange(row,col,n=1,m=1){return{setValues(v){assert.equal(v.length,n);for(let i=0;i<n;i++){while(data.length<row-1+i)data.push(h.map(()=>''));for(let j=0;j<m;j++)data[row-2+i][col-1+j]=v[i][j]}writeCount++;return this},setValue(value){while(data.length<row-1)data.push(h.map(()=>''));data[row-2][col-1]=value;writeCount++;return this}}},export(){return data.map(r=>Object.fromEntries(h.map((key,i)=>[key,r[i]])))}};
 }
 const sheets=Object.fromEntries(Object.keys(db).map(k=>[k,table(k)]));
 const nowDate=new Date().toISOString();
 const ctx={
 Date,console:{log(){}},PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='TALLY_API_KEY'?'TESTTOKEN123456789':'SHEET_ID_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'})},
 SpreadsheetApp:{openById:()=>({getSheetByName:n=>sheets[n]||null})},
 UrlFetchApp:{fetch:url=>{
 const buyer=url.includes('/jeoYaE/');const body=buyer?{submissions:[buyerSubmission],questions,hasMore:false}:{submissions:[],questions:[],hasMore:false};
 return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(body)};
 }},
 LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
 MailApp:{getRemainingDailyQuota:()=>quota,sendEmail:opts=>{if(overrides.failEmail)throw Error('Simulated SMTP failure');sends.push(opts)}},
 };
 const c=vm.createContext(ctx);vm.runInContext(source,c,{filename:'buyer-intake.gs'});
 return {run:()=>vm.runInContext("syncOppsProcessBetaBuyer({triggerUid:'SYNTHETIC_TEST_ONLY'})",c),dry:()=>vm.runInContext('syncOppsBetaBuyerDryRun()',c),manual:()=>vm.runInContext('syncOppsProcessBetaBuyer()',c),sheets,send:()=>sends.slice(),writes:()=>writeCount};
}
let tested=0;function test(name,fn){fn();tested++;console.log('PASS '+name)}
test('no manual-trigger privilege',()=>{const x=setup();assert.throws(()=>x.manual(),/Trigger-only/);assert.equal(x.send().length,0);assert.equal(x.writes(),0)});
test('dry-run does not mutate or send',()=>{const x=setup();const r=x.dry();assert.equal(r.buyerUnprocessed,1);assert.equal(x.send().length,0);assert.equal(x.writes(),0)});
test('approved synthetic inquiry routes only once',()=>{const x=setup();const r=x.run();assert.equal(r.buyerSent,1);assert.equal(x.send().length,1);assert.equal(x.send()[0].to,'rights@example.test');assert.equal(x.send()[0].replyTo,buyerEmail);assert.equal(x.sheets['Buyer Inquiries'].export()[0]['Delivery Status'],'Sent');assert.equal(x.run().newBuyer,0);assert.equal(x.send().length,1)});
test('hidden song blocked with no email',()=>{const x=setup({hidden:true});assert.equal(x.run().buyerBlocked,1);assert.equal(x.send().length,0);assert.equal(x.sheets['Buyer Inquiries'].export()[0]['Delivery Status'],'Blocked')});
test('withdrawn song blocked with no email',()=>{const x=setup({withdrawn:true});assert.equal(x.run().buyerBlocked,1);assert.equal(x.send().length,0)});
test('unverified paid member blocked',()=>{const x=setup({unverifiedMember:true});assert.equal(x.run().buyerBlocked,1);assert.equal(x.send().length,0)});
test('pending Cloudinary approval blocked',()=>{const x=setup({noHostAuth:true});assert.equal(x.run().buyerBlocked,1);assert.equal(x.send().length,0)});
test('lookalike Cloudinary path on wrong host blocked',()=>{const x=setup({fakeHost:true});assert.equal(x.run().buyerBlocked,1);assert.equal(x.send().length,0)});
test('failed email persists failed, no automatic resend',()=>{const x=setup({failEmail:true});assert.equal(x.run().buyerBlocked,1);assert.equal(x.sheets['Buyer Inquiries'].export()[0]['Delivery Status'],'Failed');assert.equal(x.send().length,0);assert.equal(x.run().newBuyer,0)});
console.log('TOTAL '+tested+' synthetic intake-routing and idempotency scenarios passed');
