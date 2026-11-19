/**
 * Sync Opps. | Public Approved Catalog Feed v1.1
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
  betaTab: 'Beta 40',
  writerTab: 'Writer Splits',
  publishingTab: 'Publishing Splits',
  masterTab: 'Master Splits',
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
  // The beta is limited to the 40 accepted members, not all active paid patrons.
  const beta40=soPublicTableV1_(book,SO_PUBLIC_FEED_V1.betaTab);
  const writerSplits=soPublicTableV1_(book,SO_PUBLIC_FEED_V1.writerTab);
  const publishingSplits=soPublicTableV1_(book,SO_PUBLIC_FEED_V1.publishingTab);
  const masterSplits=soPublicTableV1_(book,SO_PUBLIC_FEED_V1.masterTab);
  const stagingById=soPublicUniqueV1_(staging.rows,'Song ID');
  const sById=soPublicUniqueV1_(songs.rows,'Song ID');
  const mById=soPublicUniqueV1_(members.rows,'Member ID');
  const out=[];
  const seen={};
  staging.rows.forEach(function(st) {
    const sid=soPublicCellV1_(st,'Song ID');
    if (!/^SONG-[A-Za-z0-9_-]{8,80}$/.test(sid) || seen[sid] || stagingById[sid].__duplicate) return;
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
    const slotMatches=beta40.rows.filter(function(slot){
      return soPublicCellV1_(slot,'Member ID')===soPublicCellV1_(mem,'Member ID');
    });
    // During the first-40 beta, only accepted slots can publish. On the approved
    // full-member-access date (Jan 5, 2027, 00:00 Central), this slot gate expires.
    // Paid status, rights approvals, public-display consent and QA still apply.
    if(new Date().getTime()<Date.parse('2027-01-05T06:00:00Z') &&
       (slotMatches.length!==1 ||
        soPublicCellV1_(slotMatches[0],'Invite Status')!=='Accepted' ||
        soPublicCellV1_(slotMatches[0],'Eligibility Verified')!=='Yes' ||
        soPublicCellV1_(slotMatches[0],'Patreon Email (PRIVATE)').toLowerCase()!==
          soPublicCellV1_(mem,'Patreon Email (PRIVATE)').toLowerCase())) return;
    const title=soPublicSafeTextV1_(soPublicCellV1_(st,'Song Title'),140);
    const artist=soPublicSafeTextV1_(soPublicCellV1_(st,'Artist Display Name'),140);
    const genre=soPublicSafeTextV1_(soPublicCellV1_(st,'Genre'),70);
    const source=soPublicSafeTextV1_(soPublicCellV1_(st,'Music Source'),60);
    if (!title || !artist || !genre || !source) return;
    // Public Staging must never switch a managed MP3 to another source category
    // to bypass the private hosting authorization and asset-ID checks.
    if(source.toLowerCase()!==soPublicCellV1_(song,'Music Source').toLowerCase())return;
    // One approved private inquiry route, with only public song-identification parameters.
    const inquiry=soPublicCellV1_(st,'Buyer Inquiry Form URL (No Public Email)');
    if (!/^https:\/\/tally\.so\/r\/jeoYaE(?:[?#]|$)/.test(inquiry)) return;
    const inquiryUrl='https://tally.so/r/jeoYaE?song_id='+encodeURIComponent(sid)
      +'&song_title='+encodeURIComponent(title)+'&artist='+encodeURIComponent(artist);
    const hostedReference=soPublicCellV1_(song,'Authorized Embed Reference');
    const managed=source.toLowerCase().indexOf('managed mp3 preview')>=0;
    let playerUrl=hostedReference ||
      soPublicCellV1_(st,'Stream URL / Embed ID') ||
      soPublicCellV1_(song,'Stream URL');
    if(managed){
      // Never trust the public staging URL alone for managed audio:
      // it can outlive the private Cloudinary asset or its authorization.
      const assetId=soPublicCellV1_(song,'Preview Host Public ID (PRIVATE)');
      if(soPublicCellV1_(song,'Preview Host Authorization (PRIVATE)')!=='Approved Preview' ||
         !/^sync_opps_catalog_previews\/preview_[a-f0-9]{32}$/i.test(assetId) ||
         !hostedReference || !hostedReference.endsWith('/'+assetId+'.mp3'))return;
      playerUrl=hostedReference;
    }
    const player=soPublicPlayerV1_(source,playerUrl);
    if (!player || (managed&&player.type!=='mp3')) return;
    const owners={
      writers:soPublicSharesV1_(soPublicCellV1_(st,'Composition Credits / Splits (Consent)')),
      publishers:soPublicSharesV1_(soPublicCellV1_(st,'Publisher Owners / Splits (Consent)')),
      master:soPublicSharesV1_(soPublicCellV1_(st,'Master Owners / Splits (Consent)')),
      pro:'',
      clearance:soPublicSafeTextV1_(soPublicCellV1_(st,'Rights Disclosure'),280)
    };
    // No empty ownership sections: a real buyer must see the rights details.
    if (!owners.writers.length || !owners.publishers.length || !owners.master.length) return;
    // Do not publish credited ownership until every underlying rights-owner row
    // explicitly approves public display, and reviewed public shares match private records.
    if(!soPublicRightsAllowedV11_(writerSplits.rows,sid,'Writer Credit','Writer Ownership % (0-100)',owners.writers,'Writer Legal Name') ||
       !soPublicRightsAllowedV11_(publishingSplits.rows,sid,'Publisher / Copyright Owner','Publishing Ownership % (0-100)',owners.publishers) ||
       !soPublicRightsAllowedV11_(masterSplits.rows,sid,'Master Owner','Master Ownership % (0-100)',owners.master)) return;
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
function soPublicRightsAllowedV11_(rows,songId,creditColumn,percentColumn,publicPairs,legalColumn) {
  const rights=rows.filter(function(r){return soPublicCellV1_(r,'Song ID')===songId;});
  if (!rights.length || rights.length!==publicPairs.length) return false;
  if (rights.some(function(r){return soPublicCellV1_(r,'Approved for Public Display')!=='Yes';})) return false;
  const roundPercent=function(x){
    const value=String(x||'').trim().replace(/%$/,'');
    if(!/^(?:100(?:\.0+)?|\d{1,2}(?:\.\d+)?)$/.test(value))return null;
    const n=Number(value);
    return n>=0&&n<=100?Math.round(n*10000)/10000:null;
  };
  const normalizeName=function(s){return String(s||'').trim().replace(/\s+/g,' ').toLowerCase();};
  const matches=[];
  for(const r of rights){
    const credit=soPublicCellV1_(r,creditColumn)||soPublicCellV1_(r,legalColumn||creditColumn);
    const percent=roundPercent(soPublicCellV1_(r,percentColumn));
    if(!credit||percent===null)return false;
    matches.push([normalizeName(credit),percent]);
  }
  let sum=matches.reduce(function(a,x){return a+x[1];},0);
  if(Math.abs(sum-100)>0.01)return false;
  const actual=publicPairs.map(function(p){return [normalizeName(p[0]),roundPercent(p[1])];});
  if(actual.some(function(p){return !p[0]||p[1]===null;}))return false;
  matches.sort(function(a,b){return a[0].localeCompare(b[0])||a[1]-b[1];});
  actual.sort(function(a,b){return a[0].localeCompare(b[0])||a[1]-b[1];});
  return matches.every(function(pair,i){return pair[0]===actual[i][0]&&Math.abs(pair[1]-actual[i][1])<0.01;});
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
  // Only the owner's official DISCO embed URL; a share page is not embeddable.
  if(src.indexOf('disco')>=0 && host!=='s.disco.ac' && /(^|\.)disco\.ac$/.test(host) &&
     /^https:\/\/[^/?#]+\/e\/(?:t|p|a)\/[A-Za-z0-9_-]+\/?(?:[?#]|$)/i.test(url))
    return {type:'disco',url:url};
  if(src.indexOf('managed mp3 preview')>=0) {
    // Reject Tally private attachment links even if mistakenly added to staging.
    if(host==='res.cloudinary.com' &&
       /^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_-]+\/video\/upload\/v\d+\/sync_opps_catalog_previews\/preview_[a-f0-9]{32}\.mp3$/i.test(url))
      return {type:'mp3',url:url};
    return null;
  }
  if((src.indexOf('mp3')>=0||src.indexOf('audio')>=0) && /\.mp3(?:[?#]|$)/i.test(url))
    return {type:'mp3',url:url};
  return null;
}
