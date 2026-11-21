'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const URLImpl=require('node:url').URL;
const html=fs.readFileSync('index.html','utf8');
const match=html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match,'Site app script missing');
new Function(match[1]);
const checks=[];
function check(name,value){assert.ok(value,name);checks.push(name);}
check('Buyer hero displayed',html.includes('Find the right song for your next project.'));
check('Clear licensing steps',html.includes('How Music Licensing Works'));
check('Four buyer search inputs', ['searchInput','genreInput','moodInput','useInput'].every(x=>html.includes('id="'+x+'"'))&&!html.includes('sourceInput'));
check('No sample catalog records',!html.includes('Golden Hour Drive')&&!html.includes('const tracks='));
check('Approved feed still used',html.includes("await readLiveFeed(cfg.endpoint||'')"));
check('No static catalog fallback remains',!html.includes("cfg.mode==='static'")&&!html.includes("fetch('./catalog.json'"));
check('Only schema-v1 live config and feed payloads are accepted',html.includes("cfg?.schemaVersion!==1 || cfg.mode!=='live'")&&html.includes("obj.schemaVersion!==1 || !Array.isArray(obj.songs)"));
check('Feed failures hide catalog',html.includes("}catch(e){ SONGS=[];"));
check('Periodic withdrawal suppression retained',html.includes('window.setInterval(refreshCatalogOnReturn,30000)'));
const trusted=match[1].slice(match[1].indexOf('const TRUSTED_IFRAMES'),match[1].indexOf('function safeUrl('));
const helper=match[1].slice(match[1].indexOf('function safeUrl('),match[1].indexOf('async function readLiveFeed('));
const normalizeSong=new Function('URL',trusted+helper+';return normalizeSong;')(URLImpl);
const sid='SONG-BUYERTEST0123';
const file='https://res.cloudinary.com/qa_cloud/video/upload/v1234567890/sync_opps_catalog_previews/preview_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.mp3';
const seed={id:sid,title:'Synthetic Track',artist:'Fictional Artist',genre:'Cinematic',catalogStatus:'Published',publicReview:'Approved',source:'Managed MP3 Preview',moods:['Hopeful'],uses:['Film'],player:{type:'mp3',url:file},buyerInquiryUrl:'https://tally.so/r/jeoYaE?song_id='+sid,owners:{writers:[['Writer','100%']],publishers:[['Publisher','100%']],master:[['Master','100%']]}};
const good=normalizeSong(seed);
check('Eligible song normalizes',!!good);
check('Withdrawn song rejected',normalizeSong({...seed,catalogStatus:'Withdrawn'})===null);
check('Unapproved review rejected',normalizeSong({...seed,publicReview:'Needs Information'})===null);
check('Wrong inquiry Song ID rejected',normalizeSong({...seed,buyerInquiryUrl:'https://tally.so/r/jeoYaE?song_id=OTHER-ID'})===null);
check('Fake inquiry site rejected',normalizeSong({...seed,buyerInquiryUrl:'https://tally.so.evil.example/r/jeoYaE?song_id='+sid})===null);
check('Wrong Cloudinary host rejected',normalizeSong({...seed,player:{type:'mp3',url:file.replace('res.cloudinary.com','evil.example')}})===null);
check('Nonmanaged track cannot use MP3',normalizeSong({...seed,source:'SoundCloud'})===null);
check('Valid SoundCloud track remains usable',!!normalizeSong({...seed,source:'SoundCloud',player:{type:'soundcloud',url:'https://soundcloud.com/example/test'}}));
const cardSource=match[1].slice(match[1].indexOf('function cardHtml('),match[1].indexOf('function render()'));
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cardHtml=new Function('activeId','escapeHtml','tag',cardSource+';return cardHtml;')(null,escapeHtml,x=>'<span>'+escapeHtml(x)+'</span>');
const card=cardHtml(good);
check('Contact Artist opens approved Tally inquiry directly',card.includes('href="'+good.buyerInquiryUrl+'"')&&card.includes('target="_blank"'));
check('Licensing details and audio controls present',card.includes('data-info="'+sid+'"')&&card.includes('data-play="'+sid+'"'));
check('Internal song ID not printed as a card badge',!card.includes('<span class="provider-note">'+sid+'</span>'));

const pairHelpers=match[1].slice(match[1].indexOf('function pair(a,b)'),match[1].indexOf('function openModal('));
const licensingSource=match[1].slice(match[1].indexOf('function info(s)'),match[1].indexOf('function inquiryText(s)'));
let licensingDialog;
const showLicensingInfo=new Function('escapeHtml','openModal',pairHelpers+licensingSource+';return info;')(
 escapeHtml,(...args)=>{licensingDialog=args;}
);
showLicensingInfo({...good,notes:'No political use <additional approval> & written consent',owners:{...good.owners,clearance:'Publisher approval required'}});
const licensingHtml=licensingDialog[2];
check('Licensing Info displays song-specific restrictions',licensingHtml.includes('Licensing Restrictions')&&licensingHtml.includes('No political use'));
check('Restriction text is escaped before displaying to buyers',licensingHtml.includes('&lt;additional approval&gt;')&&licensingHtml.includes('&amp; written consent')&&!licensingHtml.includes('<additional approval>'));
check('All three ownership groups and approval notes remain visible',licensingHtml.includes('Songwriting / Composition Shares')&&licensingHtml.includes('Publishers / Publishing Shares')&&licensingHtml.includes('Master Recording Owners')&&licensingHtml.includes('Publisher approval required'));
showLicensingInfo({...good,notes:''});
check('Blank restrictions request confirmation rather than claiming unrestricted rights',licensingDialog[2].includes('Confirm any restrictions with the rights holders.'));

check('Mobile nav includes all five destinations',html.includes('id="mainNav"')&&html.includes('aria-controls="mainNav"')&&html.includes('aria-expanded="false"'));
check('Mobile menu responds to clicks',html.includes("function setMenuOpen(open)")&&html.includes("setMenuOpen(false)"));
check('Empty catalog distinguishes feed outage',html.includes("catalogFeedUnavailable=true")&&html.includes("Catalog temporarily unavailable."));
check('Contextual empty-state buttons honor hidden attribute',html.includes('.empty button[hidden]{display:none!important;}'));
check('Clear filters only appears when there are unmatched active filters',html.includes("$('emptyReset').hidden=arr.length!==0 || !filtersActive || catalogFeedUnavailable;"));
check('Retry only appears for actual catalog loading failure',html.includes("$('emptyRetry').hidden=arr.length!==0 || !catalogFeedUnavailable;"));
check('Feed retry uses existing safe loader',html.includes("emptyRetry')")&&html.includes("addEventListener('click',loadApprovedCatalog)"));
check('No matching song results are differentiated',html.includes("No songs match your search."));
check('No unapproved sample playback fallback added',!html.includes("Golden Hour Drive")&&html.includes("}catch(e){ SONGS=[];"));

const mediaFunctionSource=match[1].slice(match[1].indexOf('function insertPlayer('),match[1].indexOf('function reset()'));
check('Native managed MP3 player retains browser controls',mediaFunctionSource.includes("a.controls=true")&&mediaFunctionSource.includes("a.preload='none'"));
check('Managed preview reports playing event',mediaFunctionSource.includes("a.addEventListener('playing'")&&mediaFunctionSource.includes('Preview is playing.'));
check('Managed preview reports buffering event',mediaFunctionSource.includes("a.addEventListener('waiting'")&&mediaFunctionSource.includes('Preview is buffering.'));
check('Managed preview reports playback error',mediaFunctionSource.includes("a.addEventListener('error'")&&mediaFunctionSource.includes('cannot be played right now'));
check('Preview feedback is accessible to assistive tech',mediaFunctionSource.includes("status.setAttribute('role','status')"));
check('Native MP3 event feedback does not disable other provider embeds',mediaFunctionSource.includes("p.type==='spotify'")&&mediaFunctionSource.includes("p.type==='youtube'")&&mediaFunctionSource.includes("p.type==='bandcamp'"));
// Exercise the actual homepage refresh routine with isolated, synthetic feed data.
// These modeled media-state checks are not live browser playback or public approvals.
(async()=>{
 const script=match[1];
 const start=script.indexOf('let lastCatalogRefreshAt=0;');
 const end=script.indexOf('let activeId = null;');
 assert.ok(start>=0 && end>start,'Cannot locate production catalog refresh function');
 const runtime=script.slice(start,end);
 const factory=new Function('fetch','readLiveFeed','normalizeSong','populateFilters','render','closeModal','$','console',
   'let SONGS=[];\n'+runtime+'\nreturn {loadApprovedCatalog,state:()=>({songs:SONGS,unavailable:catalogFeedUnavailable})};');
 const queue=[
  {schemaVersion:1,songs:[{id:'SYNTHETIC-TRACK',rights:'version-1'}]},
  {schemaVersion:1,songs:[{id:'SYNTHETIC-TRACK',rights:'version-1'}]},
  {schemaVersion:1,songs:[{id:'SYNTHETIC-TRACK',rights:'version-2'}]},
  {schemaVersion:1,songs:[]},
  new Error('synthetic feed timeout'),
  {schemaVersion:1,songs:[]},
  {songs:[{id:'SYNTHETIC-TRACK'}]},
  {schemaVersion:2,songs:[{id:'SYNTHETIC-TRACK'}]},
  {schemaVersion:1,songs:'not an array'},
  {schemaVersion:1,songs:[]}
 ];
 let renders=0,playersStopped=0,playing=false,dialogsClosed=0,filtersPopulated=0;
 const modal={hidden:true};
 const app=factory(
  async()=>({ok:true,json:async()=>({schemaVersion:1,mode:'live',endpoint:'https://script.google.com/macros/s/SYNTHETIC/exec'})}),
  async()=>{const next=queue.shift();if(next instanceof Error)throw next;return next;},
  x=>x,
  ()=>{filtersPopulated++;},
  ()=>{renders++;if(playing){playing=false;playersStopped++;}},
  ()=>{modal.hidden=true;dialogsClosed++;},
  id=>{assert.equal(id,'modalLayer');return modal;},
  {warn:()=>{}}
 );
 await app.loadApprovedCatalog();
 check('First successful catalog read creates buyer cards',renders===1 && app.state().songs.length===1);
 playing=true;modal.hidden=false;
 await app.loadApprovedCatalog();
 check('Identical feed polling does not destroy ongoing playback',renders===1 && playing);
 check('Identical feed polling retains open licensing dialog',dialogsClosed===0 && !modal.hidden);
 await app.loadApprovedCatalog();
 check('Modified rights refreshes buyer cards',renders===2 && !playing && playersStopped===1);
 check('Modified rights closes a stale licensing dialog',dialogsClosed===1 && modal.hidden);
 playing=true;
 await app.loadApprovedCatalog();
 check('Withdrawn track is removed and its player stopped',renders===3 && !playing && playersStopped===2 && app.state().songs.length===0);
 await app.loadApprovedCatalog();
 check('Feed failure fails closed and marks catalog unavailable',renders===4 && app.state().unavailable && app.state().songs.length===0);
 await app.loadApprovedCatalog();
 check('Feed recovery re-renders the honest empty state',renders===5 && !app.state().unavailable && filtersPopulated===5);
 await app.loadApprovedCatalog();
 check('Missing feed schema fails closed rather than looking like empty approvals',app.state().unavailable && renders===6 && app.state().songs.length===0);
 await app.loadApprovedCatalog();
 check('Unsupported feed schema remains unavailable',app.state().unavailable && renders===6);
 await app.loadApprovedCatalog();
 check('Non-array songs are rejected without a redraw',app.state().unavailable && renders===6);
 await app.loadApprovedCatalog();
 check('Valid live schema recovers without a fallback',!app.state().unavailable && renders===7);
 let staticReads=0,liveReads=0;
 const rejectStatic=factory(
  async(url)=>{if(url!=='./feed-config.json')staticReads++;return {ok:true,json:async()=>({schemaVersion:1,mode:'static',endpoint:'https://invalid.example'})};},
  async()=>{liveReads++;return {schemaVersion:1,songs:[{id:'SYNTHETIC-TRACK'}]};},
  x=>x,()=>{},()=>{},()=>{},id=>{assert.equal(id,'modalLayer');return {hidden:true};},{warn:()=>{}}
 );
 await rejectStatic.loadApprovedCatalog();
 check('Static mode is rejected without requesting catalog.json or stale media',rejectStatic.state().unavailable && rejectStatic.state().songs.length===0 && staticReads===0 && liveReads===0);
 console.log('TOTAL '+checks.length+' buyer homepage tests PASS');
})().catch(err=>{console.error(err);process.exitCode=1;});