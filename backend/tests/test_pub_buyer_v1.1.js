const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const sourceFile=name=>{
  const local=path.join(__dirname,name);
  const parent=path.join(__dirname,'..',name);
  return fs.readFileSync(fs.existsSync(local)?local:parent,'utf8');
};
const publicCode=sourceFile('SyncOpps_PublicCatalogFeed_v1.1.gs');
const buyerCode=sourceFile('SyncOpps_Beta_Buyer_Intake_v1.1.gs');
let data={};
const PRIVATE_SHEET_ID='TEST_SHEET_ID_STRING_LONG_ENOUGH_TO_PASS';
const pubCtx=vm.createContext({
  PropertiesService:{getScriptProperties:()=>({getProperty:()=>PRIVATE_SHEET_ID})},
  SpreadsheetApp:{openById:()=>({getSheetByName:name=>data[name]?({getDataRange:()=>({getDisplayValues:()=>[Object.keys(data[name][0]||{}),...data[name].map(x=>Object.values(x))]})}):null})},
  console, URL, Date, encodeURIComponent, ContentService:{MimeType:{JAVASCRIPT:'javascript'},createTextOutput:txt=>({txt,setMimeType(){return this}})}
});
vm.runInContext(publicCode,pubCtx);
const buyerCtx=vm.createContext({console,URL,Date});vm.runInContext(buyerCode,buyerCtx);
const songId='SONG-ABCD12345678';
const mock={
  'Public Staging':[{'Song ID':songId,'Song Title':'Sample Track','Artist Display Name':'Example Artist','Genre':'Indie Rock','Music Source':'SoundCloud','Stream URL / Embed ID':'https://soundcloud.com/example/sample','Duration':'3:12','Mood Tags':'Hopeful','Great For Tags':'Dramatic Scene','Instrumental Available':'No','Explicit Lyrics':'No','Composition Credits / Splits (Consent)':'Example Writer 100%','Publisher Owners / Splits (Consent)':'Example Publishing 100%','Master Owners / Splits (Consent)':'Example Records 100%','Rights Disclosure':'Direct artist authorization','Licensing Restrictions':'None','Buyer Contact Method (Private Form)':'Private form','Buyer Inquiry Form URL (No Public Email)':'https://tally.so/r/jeoYaE','Final QA Check':'Yes','Ready for Separate Public Export':'Yes'}],
  Songs:[{'Song ID':songId,'Member ID':'MEM-TEST12345678','Catalog Status':'Published','Review Status':'Approved','Member Listing Authorization':'Yes','Private Inquiry Routing Consent':'Yes','Playback Status':'Full Track','Rights Status':'Verified','Claimed Clearance Route':'Self-Controlled','One-Stop Authority Verification':'Not Applicable','Stream URL':'https://soundcloud.com/example/sample','Authorized Embed Reference':''}],
  Members:[{'Member ID':'MEM-TEST12345678','Patreon Email (PRIVATE)':'member@private.test','Membership Status':'Active Paid','Patreon Tier':'$5 Standard','Eligibility Verified On':'2026-11-18','Inquiry Routing Consent (Private)':'Yes','Licensing Email (PRIVATE)':'artist@private.test'}],
  'Beta 40':[{'Beta Slot':'1','Member ID':'MEM-TEST12345678','Patreon Email (PRIVATE)':'member@private.test','Invite Status':'Accepted','Eligibility Verified':'Yes'}],
  'Writer Splits':[{'Song ID':songId,'Writer Credit':'Example Writer','Writer Legal Name':'Example Writer','Writer Ownership % (0-100)':'100.00%','Approved for Public Display':'Yes'}],
  'Publishing Splits':[{'Song ID':songId,'Publisher / Copyright Owner':'Example Publishing','Publishing Ownership % (0-100)':'100.00%','Approved for Public Display':'Yes'}],
  'Master Splits':[{'Song ID':songId,'Master Owner':'Example Records','Master Ownership % (0-100)':'100.00%','Approved for Public Display':'Yes'}]
};
const clone=x=>JSON.parse(JSON.stringify(x));
function setMock(input){data=clone(input);}
function feed(){return vm.runInContext('soPublicSnapshotV1_()',pubCtx);}
function buyer(){
  const table=name=>({rows:data[name].map(r=>Object.values(r)),headers:Object.keys(data[name][0]),title:name});
  const buyers={headers:['Received On','Buyer Email (PRIVATE)','Song ID'],rows:[],title:'Buyer Inquiries'};
  buyerCtx.__args=[songId,'buyer@example.com','Buyer','Test film music inquiry',table('Songs'),table('Public Staging'),table('Members'),buyers,table('Beta 40'),table('Writer Splits'),table('Publishing Splits'),table('Master Splits')];
  return vm.runInContext('soBBBuyerEligible_(...__args)',buyerCtx);
}
let passed=0;
function t(name,adjust,expected){setMock(mock);if(adjust)adjust(data);const f=feed(),b=buyer();assert.equal(f.songs.length,expected,'public feed mismatch: '+name);assert.equal(b.allowed,expected===1,'buyer routing mismatch: '+name+' ('+b.reason+')');if(expected===1){let raw=JSON.stringify(f);assert(!raw.includes('member@private.test'));assert(!raw.includes('artist@private.test'));assert.equal(f.songs[0].buyerInquiryUrl,'https://tally.so/r/jeoYaE?song_id=SONG-ABCD12345678&song_title=Sample%20Track&artist=Example%20Artist');}passed++;console.log('PASS '+name)}

t('fully reviewed first-40 track publishes and is routable',null,1);
t('status Paused removes track from fresh public feed',d=>d.Songs[0]['Catalog Status']='Paused',0);
t('status Withdrawn removes track from fresh public feed',d=>d.Songs[0]['Catalog Status']='Withdrawn',0);
t('song Hidden blocks',d=>d.Songs[0]['Catalog Status']='Hidden',0);
t('beta slot not accepted blocks',d=>d['Beta 40'][0]['Invite Status']='Pending',0);
t('no beta slot blocks',d=>d['Beta 40'][0]['Member ID']='MEM-DIFFERENT',0);
t('duplicate beta slot blocks',d=>d['Beta 40'].push({...d['Beta 40'][0]}),0);
t('wrong assigned Patreon address blocks',d=>d['Beta 40'][0]['Patreon Email (PRIVATE)']='other@private.test',0);
t('writer display consent absent blocks',d=>d['Writer Splits'][0]['Approved for Public Display']='No',0);
t('publishing display consent absent blocks',d=>d['Publishing Splits'][0]['Approved for Public Display']='No',0);
t('master display consent absent blocks',d=>d['Master Splits'][0]['Approved for Public Display']='No',0);
t('stage discloses mismatched writer blocks',d=>d['Public Staging'][0]['Composition Credits / Splits (Consent)']='Other Writer 100%',0);
t('private underlying shares total 75 blocks',d=>d['Writer Splits'][0]['Writer Ownership % (0-100)']='75%',0);
t('wrong staged split percentage blocks',d=>d['Public Staging'][0]['Composition Credits / Splits (Consent)']='Example Writer 90%',0);
t('QA flag No blocks',d=>d['Public Staging'][0]['Final QA Check']='No',0);
t('duplicate staging record blocks',d=>d['Public Staging'].push({...d['Public Staging'][0]}),0);
t('membership unverified blocks',d=>d.Members[0]['Membership Status']='Unverified',0);
t('invalid player domain blocks',d=>d['Public Staging'][0]['Stream URL / Embed ID']='https://evil.com/song',0);
t('buyer inquiry unapproved form URL blocks',d=>d['Public Staging'][0]['Buyer Inquiry Form URL (No Public Email)']='https://tally.so/r/notOurForm',0);
t('authority unverifiable blocks',d=>{d.Songs[0]['Claimed Clearance Route']='Delegated One-Stop Agent';d.Songs[0]['One-Stop Authority Verification']='Pending Review';},0);
console.log('TOTAL '+passed+' mock positive/negative/withdrawal cases passed');
