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
const betaHtml=fs.readFileSync('beta/index.html','utf8');
const legalPDF=fs.readFileSync('legal/sync-opps-terms-and-privacy.pdf');
check('Combined Terms and Privacy document is a real public PDF',legalPDF.length>20000&&legalPDF.subarray(0,5).toString()==='%PDF-');
check('Catalog and Beta footer show exact requested copyright', [html,betaHtml].every(s=>s.includes('Copyright 2026 - 2027 Sync Opps. All rights reserved.')));
check('Both footer policies open the same PDF, with correct section pages',html.includes('href="legal/sync-opps-terms-and-privacy.pdf#page=2"')&&html.includes('href="legal/sync-opps-terms-and-privacy.pdf#page=5"')&&betaHtml.includes('href="../legal/sync-opps-terms-and-privacy.pdf#page=2"')&&betaHtml.includes('href="../legal/sync-opps-terms-and-privacy.pdf#page=5"'));
check('Both legal footer links remain accessible on mobile', [html,betaHtml].every(s=>s.includes('<div class="footerlegal-links" role="navigation" aria-label="Legal policies">')));
check('Beta 40 fee FAQ promises full creator fees and no commission',betaHtml.includes('How much of each licensing fee do I keep?')&&betaHtml.includes('You keep 100% of the licensing fee from every placement. Sync Opps. takes no percentage or commission.'));
check('Beta 40 promotion FAQ accurately includes existing partners and monthly buyer-targeted ads',betaHtml.includes('How will Sync Opps. promote the catalog?')&&betaHtml.includes('monthly paid online ads targeting music licensing buyers'));
check('Beta 40 submission FAQ distinguishes two songs during beta from January 2027 launch plan',betaHtml.includes('Can I submit multiple songs at once?')&&betaHtml.includes('Submit up to two songs together during beta.')&&betaHtml.includes('January 2027'));
check('Beta 40 streaming-link submission FAQ makes MP3 upload optional',betaHtml.includes('Do I need to upload music files?')&&betaHtml.includes('song details, metadata and ownership information for each track. Uploading an MP3 is optional.'));
check('Beta 40 music service FAQ uses concise authorized MP3 wording',betaHtml.includes('or upload an authorized MP3 (up to 10 MB) directly through our song submission form.')&&!betaHtml.includes('or upload an authorized MP3 listening preview (up to 10 MB)'));
check('Beta 40 music links include DISCO in requested order',betaHtml.includes('using links from SoundCloud, DISCO, Bandcamp, Spotify, YouTube, Apple Music, Dropbox and Google Drive'));


check('Exactly four newly highlighted Beta FAQs without replacing existing ones',(betaHtml.match(/class="faq faq-highlight"/g)||[]).length===4&&betaHtml.includes('Do I need to pay anything beyond Patreon?')&&betaHtml.includes('What music services can I submit?'));
check('Unwanted private master recording FAQ is absent',!betaHtml.includes('Must I make my private master recording public?')&&!betaHtml.includes('If an existing private track cannot be embedded'));
check('Beta FAQ states no added enrollment or song submission fee',betaHtml.includes('No additional catalog enrollment fee or submission fee is required for eligible paid beta members.')&&betaHtml.includes('Your qualifying $5 or $10 Patreon membership is required.'));




check('Initial catalog state does not misleadingly display zero songs before live approval',html.includes('id="resultCount">Loading music...')&&html.includes('<strong id="emptyTitle">Loading approved music...</strong>')&&html.includes('id="emptyState" role="status" aria-live="polite"><strong'));
check('Live feed origins preconnected without preloading or caching track data',html.includes('<link rel="preconnect" href="https://script.google.com">')&&html.includes('<link rel="preconnect" href="https://script.googleusercontent.com">')&&!html.includes('<link rel="preload" href="https://script.google.com'));

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
const dbLink='https://www.dropbox.com/scl/fi/a1b2c3d4e5f6/example-audio.wav?rlkey=allow123&dl=0';
const drLink='https://drive.google.com/file/d/1X2y3Z4aBcDeFgHiJkLmNoPqRstuVwxy/view?usp=sharing';
const dbSong=normalizeSong({...seed,source:'Dropbox MP3',player:{type:'dropbox',url:dbLink}});
check('Dropbox file share converts to a raw playable audio URL',!!dbSong&&dbSong.player.url.startsWith('https://www.dropbox.com/scl/fi/')&&dbSong.player.url.includes('raw=1')&&dbSong.player.url.includes('rlkey=allow123')&&!dbSong.player.url.includes('dl=0'));
const drSong=normalizeSong({...seed,source:'Google Drive MP3',player:{type:'gdrive',url:drLink}});
check('Google Drive individual file converts to preview iframe URL',!!drSong&&drSong.player.url==='https://drive.google.com/file/d/1X2y3Z4aBcDeFgHiJkLmNoPqRstuVwxy/preview');
check('Dropbox folder and lookalike domains rejected',normalizeSong({...seed,source:'Dropbox MP3',player:{type:'dropbox',url:'https://www.dropbox.com/home/fake.mp3'}})===null&&normalizeSong({...seed,source:'Dropbox MP3',player:{type:'dropbox',url:'https://dropbox.com.evil.example/s/abcd/fake.mp3'}})===null);
check('Google Drive folder and spoofed host rejected',normalizeSong({...seed,source:'Google Drive MP3',player:{type:'gdrive',url:'https://drive.google.com/drive/folders/1X2y3Z4aBcDeFgHiJkLmNoPqRstuVwxy'}})===null&&normalizeSong({...seed,source:'Google Drive MP3',player:{type:'gdrive',url:'https://drive.google.com.evil.example/file/d/1X2y3Z4aBcDeFgHiJkLmNoPqRstuVwxy/preview'}})===null);
check('Dropbox and Drive players are rendered without modifying managed MP3 controls',html.includes("else if(p.type==='dropbox')")&&html.includes("else if(p.type==='gdrive')")&&html.includes("else if(p.type==='mp3')"));

const cardSource=match[1].slice(match[1].indexOf('function cardHtml('),match[1].indexOf('function render()'));
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cardHtml=new Function('activeId','escapeHtml','tag',cardSource+';return cardHtml;')(null,escapeHtml,x=>'<span>'+escapeHtml(x)+'</span>');
const card=cardHtml(good);
check('Contact Artist opens approved Tally inquiry directly',card.includes('href="'+good.buyerInquiryUrl+'"')&&card.includes('target="_blank"'));
check('Licensing details and integrated MP3 play control present',card.includes('data-info="'+sid+'"')&&card.includes('data-mp3-play')&&!card.includes('id="playerMount"'));
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
const initSource=match[1].slice(match[1].indexOf('function initManagedPlayers('),match[1].indexOf('function playerIframe('));
check('Approved MP3 uses one compact always-present player',card.includes('data-managed-audio')&&card.includes('data-mp3-play')&&card.includes('data-mp3-seek')&&card.includes('data-mp3-mute'));
check('Compact MP3 omits native controls and visible download action',card.includes('controlsList="nodownload"')&&!card.includes('<audio controls'));
check('Play button is a real play/pause button, not a close control',card.includes('class="pause-icon"')&&!card.includes('Close player'));
check('Progress and time are present before the first click',card.includes('data-elapsed')&&card.includes('data-duration')&&card.includes('class="managed-timeline"'));
const manyUseCard=cardHtml({...good,uses:['Film','TV','Ads','Podcasts','Games']});
check('Great for categories collapse to three by default',manyUseCard.includes('+2 more')&&manyUseCard.includes('data-more-uses')&&manyUseCard.includes('data-extra-use hidden'));
check('No raw URL from private form included in a managed MP3 player',!card.includes('tally.so/r/') || card.includes('https://tally.so/r/jeoYaE?'));
check('Native iframe providers remain unchanged',mediaFunctionSource.includes("p.type==='soundcloud'")&&mediaFunctionSource.includes("p.type==='spotify'")&&mediaFunctionSource.includes("p.type==='youtube'")&&mediaFunctionSource.includes("p.type==='bandcamp'"));
const soundcloud=normalizeSong({...seed,source:'SoundCloud',player:{type:'soundcloud',url:'https://soundcloud.com/example/test'}});
const soundcloudCard=cardHtml(soundcloud);
check('Third-party provider retains its embedded player opener',soundcloudCard.includes('data-play="'+sid+'"')&&!soundcloudCard.includes('data-managed-audio'));
check('MP3 UI does not depend on expanding a second player',initSource.includes("document.querySelectorAll('.song-card')")&&!card.includes('class="embed-holder"'));
check('Existing live-feed withdrawal code is still present',match[1].includes('window.setInterval(refreshCatalogOnReturn,30000)'));
check('Custom player keeps play, pause, seek and mute event support',initSource.includes("play.addEventListener('click'")&&initSource.includes("audio.addEventListener('pause'")&&initSource.includes("timeline.addEventListener('change'")&&initSource.includes("mute.addEventListener('click'"));
check('Custom player includes buffering and error feedback',initSource.includes("audio.addEventListener('waiting'")&&initSource.includes("audio.addEventListener('error'"));
check('Preview blocks other MP3 tracks from playing simultaneously',initSource.includes("other!==audio&&!other.paused")&&initSource.includes('other.pause()'));
check('Display names and titles still escape markup',!cardHtml({...good,title:'Bad<script>alert(1)</script>'}).includes('<script>'));
function fakeControl(){
 const handlers=Object.create(null);
 return {
  handlers,style:{setProperty(k,v){this[k]=v;}},classList:{values:new Set(),toggle(k,on){if(on)this.values.add(k);else this.values.delete(k);}},
  attributes:{},currentTime:0,textContent:'',max:'62',value:'0',disabled:false,
  addEventListener(k,fn){(handlers[k]||=[]).push(fn);},
  setAttribute(k,v){this.attributes[k]=v;},
  querySelector(){return null;},
  emit(type){for(const f of handlers[type]||[])f();}
 };
}
const preview=Object.create(fakeControl());
const audio=Object.assign(fakeControl(),{
 paused:true,ended:false,currentTime:0,duration:62,readyState:2,muted:false,
 play(){this.paused=false;this.emit('play');return Promise.resolve();},
 pause(){this.paused=true;this.emit('pause');}
});
const player=fakeControl(),play=fakeControl(),timeline=fakeControl(),
 state=fakeControl(),elapsed=fakeControl(),duration=fakeControl(),mute=fakeControl();
state.textContent='Ready to listen'; // Matches the server-rendered HTML before handlers attach.
const title=fakeControl();title.textContent='Synthetic Track';
preview.querySelector=sel=>({
 'audio[data-managed-audio]':audio,'[data-mp3-play]':play,'[data-mp3-seek]':timeline,
 '.managed-state':state,'[data-elapsed]':elapsed,'[data-duration]':duration,
 '[data-mp3-mute]':mute,'.managed-player':player,'.trackmeta h3':title
})[sel]||null;
const fakeDocument={activeElement:null,querySelectorAll:sel=>sel==='.song-card'?[preview]:sel==='audio[data-managed-audio]'?[audio]:[]};
const initManagedPlayers=new Function('document',initSource+';return initManagedPlayers;')(fakeDocument);
initManagedPlayers();
check('Real custom controls begin in Ready to listen state',state.textContent==='Ready to listen'&&elapsed.textContent==='0:00');
play.emit('click');
check('Real play click calls HTMLAudioElement.play directly',audio.paused===false&&state.textContent==='Now playing'&&player.classList.values.has('is-playing'));
audio.emit('waiting');
check('Real buffering event updates player status',state.textContent==='Buffering…');
audio.emit('playing');
check('Audio playing event clears buffering without pause or second click',state.textContent==='Now playing'&&!audio.paused&&player.classList.values.has('is-playing'));
check('Native pause changes active style back without expanding card',play.attributes['aria-label']==='Pause Synthetic Track'&&preview.handlers['click']===undefined);
audio.currentTime=12.5;audio.emit('timeupdate');
check('Playback updates elapsed seconds and progress slider',elapsed.textContent==='0:12'&&Number(timeline.value)===12.5);
timeline.value='20';timeline.emit('change');
check('Seeking repositions the one audio element',audio.currentTime===20);
mute.emit('click');
check('Mute button toggles audio.muted and announces state',audio.muted===true&&mute.attributes['aria-pressed']==='true');
play.emit('click');
check('Clicking during playback pauses rather than closing player',audio.paused===true&&state.textContent==='Paused'&&play.attributes['aria-label']==='Play Synthetic Track');
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