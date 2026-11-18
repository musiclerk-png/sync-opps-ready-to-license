/**
 * Sync Opps. | Public Approved Catalog Feed v1.0
 * GitHub Pages live-data bridge. READ-ONLY. No triggers, emails, or writes.
 * Install in a NEW standalone Apps Script project, separate from Catalog Intake
 * and Song Removal. Do not add this file to their existing projects.
 *
 * Script Property: CATALOG_SHEET_ID = the ID of the existing PRIVATE catalog Sheet.
 * Deploy Web app: Execute as Me; Who has access: Anyone.
 * Google ContentService's JAVASCRIPT MIME serves a constant-name JSONP callback.
 * Only explicitly approved public data is returned, never raw sheet contents.
 * Every request rereads current status to suppress Paused/Withdrawn tracks.
 *
 * DO NOT point the website at this endpoint until the full end-to-end
 * removal and signed-out playback tests are completed.
 */
const SO_PUBLIC_FEED_V1 = Object.freeze({
  property: 'CATALOG_SHEET_ID',
  callback: 'syncOppsApprovedFeedV1',
  stagingTab: 'Public Staging',
  songTab: 'Songs',
  memberTab: 'Members',
  version: 1
});

function doGet(e) {
  // Never reveal errors or spreadsheet metadata over the public endpoint.
  let data = {schemaVersion: 1, songs: []};
  try { data = soPublicSnapshotV1_(); }
  catch (err) { console.error('Public catalog feed unavailable: ' + String(err)); }
  const json = JSON.stringify(data)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return ContentService.createTextOutput(
    'window.' + SO_PUBLIC_FEED_V1.callback + '(' + json + ');'
  ).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

// Run manually once before deploying. Reads only; does not publish tracks.
function syncOppsPublicFeedDryRun() {
  const out = soPublicSnapshotV1_();
  console.log(JSON.stringify({mode:'READ ONLY',schemaVersion:out.schemaVersion,
    approvedPublicSongs:out.songs.length,errors:[],
    note:'This only counts records passing ALL publication gates.'}));
}

function soPublicSnapshotV1_() {
  const id = PropertiesService.getScriptProperties().getProperty(SO_PUBLIC_FEED_V1.property);
  if (!id || !/^[A-Za-z0-9_-]{25,100}$/.test(id)) throw Error('Private spreadsheet setting is missing or invalid.');
  const book=SpreadsheetApp.openById(id);
  const staging=soPublicTableV1_(book,SO_PUBLIC_FEED_V1.stagingTab);
  const songs=soPublicTableV1_(book,SO_PUBLIC_FEED_V1.songTab);
  const members=soPublicTableV1_(book,SO_PUBLIC_FEED_V1.memberTab);
  const sById=soPublicUniqueV1_(songs.rows,'Song ID');
  const mById=soPublicUniqueV1_(members.rows,'Member ID');
  const out=[];
  const seen={};
  staging.rows.forEach(function(st) {
    const sid=soPublicCellV1_(st,'Song ID');
    if (!/^SONG-[A-Za-z0-9_-]{8,80}$/.test(sid) || seen[sid]) return;
    seen[sid]=true;
    if (soPublicCellV1_(st,'Final QA Check')!=='Yes' ||
        soPublicCellV1_(st,'Ready for Separate Public Export')!=='Yes') return;
    const song=sById[sid];
    if (!song || song.__duplicate) return;
    if (soPublicCellV1_(song,'Catalog Status')!=='Published' ||
        soPublicCellV1_(song,'Review Status')!=='Approved' ||
        soPublicCellV1_(song,'Member Listing Authorization')!=='Yes' ||
        soPublicCellV1_(song,'Private Inquiry Routing Consent')!=='Yes') return;
    if (['Full Track','Preview Only'].indexOf(soPublicCellV1_(song,'Playback Status'))<0) return;
    if (['Member Supplied','Verified'].indexOf(soPublicCellV1_(song,'Rights Status'))<0) return;
    const route=soPublicCellV1_(song,'Claimed Clearance Route');
    const authority=soPublicCellV1_(song,'One-Stop Authority Verification');
    if (['Self-Controlled','Delegated One-Stop Agent','Additional Approvals'].indexOf(route)<0 ||
        ['Verified','Not Applicable'].indexOf(authority)<0) return;
    if (route!=='Self-Controlled' && authority!=='Verified') return;
    const mem=mById[soPublicCellV1_(song,'Member ID')];
    if (!mem || mem.__duplicate ||
        soPublicCellV1_(mem,'Membership Status')!=='Active Paid' ||
        ['$5 Standard','$10 Pro'].indexOf(soPublicCellV1_(mem,'Patreon Tier'))<0 ||
        !soPublicCellV1_(mem,'Eligibility Verified On') ||
        soPublicCellV1_(mem,'Inquiry Routing Consent (Private)')!=='Yes') return;
    const title=soPublicSafeTextV1_(soPublicCellV1_(st,'Song Title'),140);
    const artist=soPublicSafeTextV1_(soPublicCellV1_(st,'Artist Display Name'),140);
    const genre=soPublicSafeTextV1_(soPublicCellV1_(st,'Genre'),70);
    const source=soPublicSafeTextV1_(soPublicCellV1_(st,'Music Source'),60);
    if (!title || !artist || !genre || !source) return;
    // One approved private inquiry route, with only public song-identification parameters.
    const inquiry=soPublicCellV1_(st,'Buyer Inquiry Form URL (No Public Email)');
    if (!/^https:\/\/tally\.so\/r\/jeoYaE(?:[?#]|$)/.test(inquiry)) return;
    const inquiryUrl='https://tally.so/r/jeoYaE?song_id='+encodeURIComponent(sid)
      +'&song_title='+encodeURIComponent(title)+'&artist='+encodeURIComponent(artist);
    const player=soPublicPlayerV1_(source,
      soPublicCellV1_(song,'Authorized Embed Reference') ||
      soPublicCellV1_(st,'Stream URL / Embed ID') ||
      soPublicCellV1_(song,'Stream URL'));
    if (!player) return;
    const owners={
      writers:soPublicSharesV1_(soPublicCellV1_(st,'Composition Credits / Splits (Consent)')),
      publishers:soPublicSharesV1_(soPublicCellV1_(st,'Publisher Owners / Splits (Consent)')),
      master:soPublicSharesV1_(soPublicCellV1_(st,'Master Owners / Splits (Consent)')),
      pro:'',
      clearance:soPublicSafeTextV1_(soPublicCellV1_(st,'Rights Disclosure'),280)
    };
    // No empty ownership sections: a real buyer must see the rights details.
    if (!owners.writers.length || !owners.publishers.length || !owners.master.length) return;
    out.push({
      id:sid,catalogStatus:'Published',publicReview:'Approved',
      title:title,artist:artist,genre:genre,
      moods:soPublicTagsV1_(soPublicCellV1_(st,'Mood Tags'),3),
      uses:soPublicTagsV1_(soPublicCellV1_(st,'Great For Tags'),5),
      source:source,player:player,
      duration:soPublicSafeTextV1_(soPublicCellV1_(st,'Duration'),20),
      instrumental:soPublicSafeTextV1_(soPublicCellV1_(st,'Instrumental Available'),30),
      explicit:soPublicSafeTextV1_(soPublicCellV1_(st,'Explicit Lyrics'),30),
      notes:soPublicSafeTextV1_(soPublicCellV1_(st,'Licensing Restrictions'),300),
      owners:owners,buyerInquiryUrl:inquiryUrl
    });
  });
  return {schemaVersion:1,songs:out};
}

function soPublicTableV1_(book,title) {
  const sheet=book.getSheetByName(title);
  if (!sheet) throw Error('Required sheet missing: '+title);
  const grid=sheet.getDataRange().getDisplayValues();
  if (!grid.length) throw Error('Required header missing: '+title);
  const header=grid[0].map(function(x){return String(x).trim();});
  const counts={};header.forEach(function(h){if(h)counts[h]=(counts[h]||0)+1;});
  Object.keys(counts).forEach(function(h){if(counts[h]>1) throw Error('Duplicate column header: '+title+' '+h);});
  const rows=grid.slice(1).filter(function(r){return r.some(function(x){return String(x).trim();});})
    .map(function(r){const o={};header.forEach(function(h,i){if(h)o[h]=String(r[i]||'').trim();});return o;});
  return {rows:rows};
}
function soPublicUniqueV1_(rows,key) {
  const out=Object.create(null);
  rows.forEach(function(row){const k=soPublicCellV1_(row,key);if(!k)return;if(out[k])out[k]={__duplicate:true};else out[k]=row;});
  return out;
}
function soPublicCellV1_(o,k) {return String(o&&o[k]||'').trim();}
function soPublicSafeTextV1_(s,n) {
  s=String(s||'').trim().slice(0,n);
  // Private emails, domains, telephone details, or markup must not escape in display metadata.
  if (/@|<|>|\b(?:https?:\/\/|tel:|mailto:)\b/i.test(s)) return '';
  return s;
}
function soPublicTagsV1_(s,limit) {
  return String(s||'').split(/[\n,;|]/).map(function(t){return soPublicSafeTextV1_(t,65);})
    .filter(Boolean).slice(0,limit);
}
function soPublicSharesV1_(s) {
  // Consent-cleared public presentation: Name 50%, Name: 50%, or Name (50%).
  return String(s||'').split(/[\n;|]/).map(function(x){
    const m=x.trim().match(/^(.{2,160}?)[\s,:\-(]*\(?\s*(100(?:\.0+)?|\d{1,2}(?:\.\d+)?)\s*%\s*\)?$/);
    if (!m)return null;
    const name=soPublicSafeTextV1_(m[1].replace(/[\s,:\-(]+$/,'').trim(),140);
    if (!name)return null;
    return [name,m[2]+'%'];
  }).filter(Boolean).slice(0,30);
}
function soPublicPlayerV1_(source,url) {
  url=String(url||'').trim();
  const m=url.match(/^https:\/\/([^\/?#@:]+)(?::443)?(?:[\/?#]|$)/i);
  if(!m || /[\s<>"']/.test(url))return null;
  const host=m[1].toLowerCase();
  const src=source.toLowerCase();
  if(src.indexOf('soundcloud')>=0 && (host==='soundcloud.com'||host==='www.soundcloud.com'))
    return {type:'soundcloud',url:url};
  if(src.indexOf('spotify')>=0 && host==='open.spotify.com' && /\/embed\/(track|album|playlist)\//i.test(url))
    return {type:'spotify',url:url};
  if((src.indexOf('youtube')>=0||src.indexOf('you tube')>=0) &&
     (host==='www.youtube-nocookie.com'||host==='www.youtube.com') && /\/embed\//i.test(url))
    return {type:'youtube',url:url};
  if(src.indexOf('bandcamp')>=0 && (host==='bandcamp.com'||host==='www.bandcamp.com') && /\/EmbeddedPlayer\//i.test(url))
    return {type:'bandcamp',url:url};
  if(src.indexOf('apple')>=0 && host==='embed.music.apple.com')
    return {type:'apple',url:url};
  if(src.indexOf('disco')>=0 && (host==='disco.ac'||host==='www.disco.ac'))
    return {type:'disco',url:url};
  if((src.indexOf('mp3')>=0||src.indexOf('audio')>=0) && /\.mp3(?:[?#]|$)/i.test(url))
    return {type:'mp3',url:url};
  return null;
}
