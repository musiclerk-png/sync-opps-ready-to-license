/**
 * Sync Opps. Apps Script Development Bridge v0.3
 * Based on the previously approved FoundBuyer phased Dev Bridge pattern.
 * One independent management script; the four original target projects and private dashboard,
 * Script Properties, triggers and deployed Web App URLs are left intact.
 *
 * Install disarmed. Run SO_bridgeInstallReadOnly and inspect the private
 * Drive status before calling SO_bridgeArm. Never paste API secrets here.
 */
const SO_BRIDGE = Object.freeze({
  version: '0.3',
  dashboardVerifyMaxAttempts: 8,
  folderProperty: 'SO_BRIDGE_FOLDER_ID',
  targetProperty: 'SO_BRIDGE_TARGETS_JSON',
  armedProperty: 'SO_BRIDGE_ARMED',
  stateProperty: 'SO_BRIDGE_ACTIVE_STATE',
  pollFunction: 'SO_bridgePoll',
  statusFile: 'Sync Opps Dev Bridge Status.json',
  requestPrefix: 'Sync Opps Dev Bridge Request ',
  backupPrefix: 'Sync Opps Dev Bridge Backup ',
  resultPrefix: 'Sync Opps Dev Bridge Result ',
  donePrefix: 'Sync Opps Dev Bridge Processed ',
  failPrefix: 'Sync Opps Dev Bridge Failed ',
  feedDeploymentId: 'AKfycbxnpxw7Q1N9FvjKOdoLzfDDN_A4J2jzkiPbIB84Hvw473BQXcpRqKFdXGy912HVGjK9Pg',
  feedUrl: 'https://script.google.com/macros/s/AKfycbxnpxw7Q1N9FvjKOdoLzfDDN_A4J2jzkiPbIB84Hvw473BQXcpRqKFdXGy912HVGjK9Pg/exec',
  dashboardDeploymentProperty: 'SO_BRIDGE_DASHBOARD_DEPLOYMENT_ID',
  expectedNames: Object.freeze({
    intake: /sync\s*opps.*catalog\s*intake/i,
    removal: /sync\s*opps.*(?:song\s*removal|removal\s*processor)/i,
    feed: /sync\s*opps.*public\s*catalog\s*feed/i,
    beta_buyer: /sync\s*opps.*beta.*buyer.*intake/i,
    dashboard: /^SO Ready to License - Music Submission Approval Dashboard$/i
  }),
  allowedSources: Object.freeze({
    intake: {
      Code: 'backend/SyncOpps_Tally_Processor_v1.7.gs',
      InternalMP3Preflight: 'backend/SyncOpps_Internal_MP3_Preflight.gs'
    },
    removal: { Code: 'backend/SyncOpps_Song_Removal_Processor_v1.0.gs' },
    feed: { Code: 'backend/SyncOpps_PublicCatalogFeed_v1.1.gs' },
    beta_buyer: { Code: 'backend/SyncOpps_Beta_Buyer_Intake_v1.1.gs' }
  })
});

/** Initial owner action: read-only discovery, NO modification to target projects. */
function SO_bridgeInstallReadOnly() {
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const p=PropertiesService.getScriptProperties();
    SO_bridgeAssert_(!SO_bridgeState_()&&!SO_bridgeFindRequest_(),'Do not interrupt bridge work.');
    SO_bridgeAssert_(!p.getProperty(SO_BRIDGE.targetProperty),'Use SO_bridgeEnrollDashboard for the expanded bridge; do not reset existing pins.');
    p.setProperty(SO_BRIDGE.armedProperty,'false');
    const report=SO_bridgeInventory_();
    if(report.result==='PASS') p.setProperty(SO_BRIDGE.targetProperty,JSON.stringify(report.target_ids));
    SO_bridgeEnsurePollTrigger_(); // disarmed, in management project ONLY
    report.armed=false;
    report.management_trigger_installed=true;
    SO_bridgeWriteStatus_(report);
    Logger.log(JSON.stringify(report));
    return report;
  } finally {lock.releaseLock();}
}
function SO_bridgeReadOnlyStatus() {
  const report=SO_bridgeInventory_();
  report.armed=SO_bridgeArmed_();
  SO_bridgeWriteStatus_(report);
  Logger.log(JSON.stringify(report));
  return report;
}
/** A second owner action AFTER reviewing the read-only status. No target writes. */
function SO_bridgeArm() {
  const p=PropertiesService.getScriptProperties();
  const report=SO_bridgeInventory_();
  SO_bridgeAssert_(report.result==='PASS','Read-only inventory has not passed.');
  const pinned=JSON.parse(p.getProperty(SO_BRIDGE.targetProperty)||'{}');
  Object.keys(SO_BRIDGE.expectedNames).forEach(k=>
    SO_bridgeAssert_(report.target_ids[k]===pinned[k] && !!pinned[k],'Pinned target changed: '+k));
  SO_bridgeAssert_(!p.getProperty(SO_BRIDGE.stateProperty),'An unfinished request exists.');
  p.setProperty(SO_BRIDGE.armedProperty,'true');
  SO_bridgeEnsurePollTrigger_();
  report.armed=true;
  report.mode='ARMED_FOR_VALIDATED_DRIVE_REQUESTS';
  SO_bridgeWriteStatus_(report);
  return report;
}
function SO_bridgeDisarm() {
  PropertiesService.getScriptProperties().setProperty(SO_BRIDGE.armedProperty,'false');
  SO_bridgeWriteStatus_({version:SO_BRIDGE.version,armed:false,mode:'DISARMED',at:new Date().toISOString()});
}
function SO_bridgeRunOnePhaseNow() {return SO_bridgePoll();}
function SO_bridgeArmed_() {
  return PropertiesService.getScriptProperties().getProperty(SO_BRIDGE.armedProperty)==='true';
}
function SO_bridgeFolder_() {
  const id=(PropertiesService.getScriptProperties().getProperty(SO_BRIDGE.folderProperty)||'').trim();
  SO_bridgeAssert_(/^[A-Za-z0-9_-]{10,}$/.test(id),'SO_BRIDGE_FOLDER_ID must be set in this management project Script Properties.');
  return DriveApp.getFolderById(id);
}
function SO_bridgeAssert_(condition,message) {if(!condition)throw Error(message);}
function SO_bridgeHash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8)
    .map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
}
function SO_bridgeApi_(method,path,payload) {
  const opt={method:method.toLowerCase(),headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},
    muteHttpExceptions:true,followRedirects:true};
  if(payload!==undefined){opt.contentType='application/json';opt.payload=JSON.stringify(payload);}
  const res=UrlFetchApp.fetch('https://script.googleapis.com/v1'+path,opt);
  const body=res.getContentText();
  if(res.getResponseCode()<200||res.getResponseCode()>=300)
    throw Error('Apps Script API HTTP '+res.getResponseCode()+': '+body.slice(0,450));
  return body?JSON.parse(body):{};
}
function SO_bridgeContent_(id) {return SO_bridgeApi_('GET','/projects/'+encodeURIComponent(id)+'/content');}
function SO_bridgeDeployment_(id,depId) {
  return SO_bridgeApi_('GET','/projects/'+encodeURIComponent(id)+'/deployments/'+encodeURIComponent(depId));
}
function SO_bridgeWebUrl_(dep) {
  const eps=(dep.entryPoints||[]).filter(e=>e.webApp&&e.webApp.url);
  return eps.length===1?String(eps[0].webApp.url).replace(/\/$/,''):'';
}
function SO_bridgeMinimalFiles_(arr) {
  return (arr||[]).map(f=>({name:f.name,type:f.type,source:String(f.source||'')}));
}
function SO_bridgeFile_(arr,name) {
  const found=(arr||[]).filter(f=>f.type==='SERVER_JS'&&f.name===name);
  SO_bridgeAssert_(found.length<=1,'Duplicate script source file: '+name);
  return found[0]||null;
}
function SO_bridgeDiscover_() {
  const matches={};Object.keys(SO_BRIDGE.expectedNames).forEach(k=>matches[k]=[]);
  const it=DriveApp.searchFiles("mimeType = 'application/vnd.google-apps.script' and trashed = false");
  while(it.hasNext()) {
    const f=it.next(),name=f.getName();
    Object.keys(matches).forEach(k=>{if(SO_BRIDGE.expectedNames[k].test(name))matches[k].push({id:f.getId(),name:name});});
  }
  // One-time fallback if an Apps Script project is not indexed by Drive search.
  // The property is a Script ID from the owner's existing project settings.
  const props=PropertiesService.getScriptProperties();
  Object.keys(matches).forEach(k=>{
    if(matches[k].length)return;
    const id=(props.getProperty('SO_BRIDGE_TARGET_ID_'+k.toUpperCase())||'').trim();
    if(/^[A-Za-z0-9_-]{15,}$/.test(id))matches[k].push({id:id,name:'Owner-provided Script ID'});
  });
  return matches;
}
function SO_bridgeDashboardSpec_() {
  const id=(PropertiesService.getScriptProperties().getProperty(SO_BRIDGE.dashboardDeploymentProperty)||'').trim();
  SO_bridgeAssert_(/^[A-Za-z0-9_-]{30,}$/.test(id),'Dashboard deployment not pinned. Run enrollment.');
  return {id:id,url:'https://script.google.com/macros/s/'+id+'/exec'};
}
function SO_bridgeDeploySpec_(project) {
  if(project==='dashboard')return SO_bridgeDashboardSpec_();
  SO_bridgeAssert_(project==='feed','Unsupported deployment target.');
  return {id:SO_BRIDGE.feedDeploymentId,url:SO_BRIDGE.feedUrl};
}
function SO_bridgeAllHash_(files) {
  return SO_bridgeHash_(JSON.stringify(SO_bridgeMinimalFiles_(files).sort((a,b)=>a.name.localeCompare(b.name)||a.type.localeCompare(b.type))));
}
function SO_bridgeDashboardManifest_(files) {
  const manifests=files.filter(f=>f.name==='appsscript'&&f.type==='JSON');
  SO_bridgeAssert_(manifests.length===1,'Dashboard manifest must be unique.');
  const m=JSON.parse(manifests[0].source);
  SO_bridgeAssert_(m.webapp&&m.webapp.access==='MYSELF'&&m.webapp.executeAs==='USER_ACCESSING','Dashboard must remain owner-only, user accessing.');
  const scopes=(m.oauthScopes||[]).slice().sort();
  const email='https://www.googleapis.com/auth/userinfo.email';
  const ro='https://www.googleapis.com/auth/spreadsheets.readonly';
  const rw='https://www.googleapis.com/auth/spreadsheets';
  SO_bridgeAssert_(scopes.length===2&&scopes.includes(email)&&(scopes.includes(ro)||scopes.includes(rw)),'Dashboard OAuth scopes not approved.');
  return {file:manifests[0],manifest:m,write:scopes.includes(rw)};
}
function SO_bridgeDashboardDeploymentCheck_(scriptId,d,spec) {
  SO_bridgeAssert_(d.deploymentId===spec.id&&SO_bridgeWebUrl_(d)===spec.url,'Private dashboard deployment identity mismatch.');
  const version=Number((d.deploymentConfig||{}).versionNumber||0);
  SO_bridgeAssert_(version>0,'Dashboard needs an existing versioned deployment.');
  const ep=(d.entryPoints||[]).find(e=>e.webApp);
  const ec=ep&&ep.webApp&&ep.webApp.entryPointConfig;
  if(ec)SO_bridgeAssert_(ec.access==='MYSELF'&&ec.executeAs==='USER_ACCESSING','Dashboard deployed entry point is not owner-only.');
  const files=SO_bridgeMinimalFiles_(SO_bridgeApi_('GET','/projects/'+encodeURIComponent(scriptId)+'/content?versionNumber='+version).files);
  SO_bridgeDashboardManifest_(files);
  return {version:version,files:files};
}
/** One-time owner enrollment. Never reset existing pins or interrupt pending work. */
function SO_bridgeEnrollDashboard() {
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const p=PropertiesService.getScriptProperties();
    SO_bridgeAssert_(!SO_bridgeState_()&&!SO_bridgeFindRequest_(),'Finish all existing bridge requests before enrollment.');
    const old=JSON.parse(p.getProperty(SO_BRIDGE.targetProperty)||'{}');
    const oldKeys=['intake','removal','feed','beta_buyer'];
    SO_bridgeAssert_(oldKeys.every(k=>!!old[k]),'Original four target pins must already exist.');
    p.setProperty(SO_BRIDGE.armedProperty,'false');
    const found=SO_bridgeDiscover_().dashboard;
    SO_bridgeAssert_(found.length===1,'Dashboard not uniquely found. Set SO_BRIDGE_TARGET_ID_DASHBOARD to its Script ID.');
    const id=found[0].id;
    SO_bridgeAssert_(!oldKeys.some(k=>old[k]===id)&&(!old.dashboard||old.dashboard===id),'Dashboard must be a separate, unchanged target.');
    const meta=SO_bridgeApi_('GET','/projects/'+encodeURIComponent(id));
    SO_bridgeAssert_(SO_BRIDGE.expectedNames.dashboard.test(meta.title||''),'Wrong dashboard project title.');
    const configured=(p.getProperty(SO_BRIDGE.dashboardDeploymentProperty)||'').trim();
    let depId=configured;
    if(!depId){
      const result=SO_bridgeApi_('GET','/projects/'+encodeURIComponent(id)+'/deployments');
      SO_bridgeAssert_(!result.nextPageToken,'Multiple deployment pages; explicitly pin the existing dashboard deployment ID.');
      const candidates=(result.deployments||[]).filter(d=>Number((d.deploymentConfig||{}).versionNumber)>0&&SO_bridgeWebUrl_(d));
      SO_bridgeAssert_(candidates.length===1,'Dashboard deployment not unique; set SO_BRIDGE_DASHBOARD_DEPLOYMENT_ID to the existing ID.');
      depId=candidates[0].deploymentId;
    }
    SO_bridgeAssert_(/^[A-Za-z0-9_-]{30,}$/.test(depId),'Invalid dashboard deployment ID.');
    const spec={id:depId,url:'https://script.google.com/macros/s/'+depId+'/exec'};
    SO_bridgeDashboardDeploymentCheck_(id,SO_bridgeDeployment_(id,depId),spec);
    SO_bridgeDashboardManifest_(SO_bridgeMinimalFiles_(SO_bridgeContent_(id).files));
    p.setProperty(SO_BRIDGE.dashboardDeploymentProperty,depId);
    const report=SO_bridgeInventory_();
    SO_bridgeAssert_(report.result==='PASS'&&oldKeys.every(k=>report.target_ids[k]===old[k])&&report.target_ids.dashboard===id,'Inventory mismatch; original pins unchanged.');
    p.setProperty(SO_BRIDGE.targetProperty,JSON.stringify(report.target_ids));
    SO_bridgeEnsurePollTrigger_();
    p.setProperty(SO_BRIDGE.armedProperty,'true');
    report.armed=true;report.mode='ARMED_FOR_VALIDATED_DRIVE_REQUESTS';
    SO_bridgeWriteStatus_(report);
    Logger.log('Dashboard enrollment PASS; all five targets verified.');
    return report;
  }finally{lock.releaseLock();}
}
function SO_bridgeInventory_() {
  const report={version:SO_BRIDGE.version,mode:'READ_ONLY',at:new Date().toISOString(),
    result:'FAIL',folderAccessible:false,checks:[],targets:{},target_ids:{}};
  try {report.folderAccessible=!!SO_bridgeFolder_().getName();}
  catch(e){report.checks.push({name:'existing private Drive folder',ok:false,error:String(e)});}
  const matched=SO_bridgeDiscover_();
  Object.keys(matched).forEach(k=>{
    const list=matched[k];
    report.checks.push({name:'unique '+k+' project',ok:list.length===1,count:list.length,
      candidates:list.map(x=>x.name)});
    if(list.length!==1)return;
    const x=list[0];
    try {
      const meta=SO_bridgeApi_('GET','/projects/'+encodeURIComponent(x.id));
      SO_bridgeAssert_(SO_BRIDGE.expectedNames[k].test(meta.title||''),
        'Script ID belongs to wrong project: '+String(meta.title||''));
      const content=SO_bridgeContent_(x.id);
      const files=SO_bridgeMinimalFiles_(content.files);
      SO_bridgeAssert_(files.some(f=>f.name==='appsscript'&&f.type==='JSON'),'Missing preserved manifest.');
      const target={scriptId:x.id,title:meta.title||x.name,
        files:files.map(f=>({name:f.name,type:f.type,sha256:SO_bridgeHash_(f.source),length:f.source.length}))};
      if(k==='feed'||k==='dashboard'){
        const spec=SO_bridgeDeploySpec_(k);
        const d=SO_bridgeDeployment_(x.id,spec.id);
        if(k==='dashboard'){
          const m=SO_bridgeDashboardManifest_(files);
          SO_bridgeDashboardDeploymentCheck_(x.id,d,spec);
          target.projectSha256=SO_bridgeAllHash_(files);
          target.manifestSha256=SO_bridgeHash_(m.file.source);
          target.writeScope=m.write;
        }
        target.deployedVersion=Number((d.deploymentConfig||{}).versionNumber||0);
        target.deploymentId=d.deploymentId;
        target.webAppUrl=SO_bridgeWebUrl_(d);
        SO_bridgeAssert_(target.webAppUrl===spec.url,'The existing deployment URL does not match. Stop.');
        SO_bridgeAssert_(target.deployedVersion>0,'Existing feed deployed version missing.');
      }
      report.targets[k]=target;report.target_ids[k]=x.id;
      report.checks.push({name:k+' Apps Script API read',ok:true,scriptId:x.id});
    }catch(e){report.checks.push({name:k+' Apps Script API read',ok:false,error:String(e)});}
  });
  report.result=report.folderAccessible&&report.checks.every(c=>c.ok)&&
    Object.keys(report.target_ids).length===Object.keys(SO_BRIDGE.expectedNames).length?'PASS':'FAIL';
  return report;
}
function SO_bridgeWriteStatus_(value) {
  const folder=SO_bridgeFolder_(),it=folder.getFilesByName(SO_BRIDGE.statusFile);
  const body=JSON.stringify(value,null,2);
  if(it.hasNext()) {
    const file=it.next();SO_bridgeAssert_(!it.hasNext(),'Duplicate status files.');
    file.setContent(body);
  } else folder.createFile(SO_BRIDGE.statusFile,body,MimeType.PLAIN_TEXT);
}
function SO_bridgeEnsurePollTrigger_() {
  const found=ScriptApp.getProjectTriggers().filter(x=>x.getHandlerFunction()===SO_BRIDGE.pollFunction);
  if(!found.length)ScriptApp.newTrigger(SO_BRIDGE.pollFunction).timeBased().everyMinutes(1).create();
  // No extra management triggers; never interact with target project triggers.
  for(let i=1;i<found.length;i++)ScriptApp.deleteTrigger(found[i]);
}
function SO_bridgeFindRequest_() {
  const it=SO_bridgeFolder_().getFiles(),matches=[];
  while(it.hasNext()){
    const file=it.next();
    if(!file.getName().startsWith(SO_BRIDGE.requestPrefix)||!/\.json$/.test(file.getName()))continue;
    try {const body=JSON.parse(file.getBlob().getDataAsString());
      if(body.status==='READY')matches.push({file,at:file.getDateCreated().getTime()});}catch(e){}
  }
  matches.sort((a,b)=>a.at-b.at);
  return matches.length?matches[0].file:null;
}
function SO_bridgeState_() {
  const data=PropertiesService.getScriptProperties().getProperty(SO_BRIDGE.stateProperty);
  return data?JSON.parse(data):null;
}
function SO_bridgeCheckpoint_(s,stage) {
  s.stage=stage;s.updated_at=new Date().toISOString();
  PropertiesService.getScriptProperties().setProperty(SO_BRIDGE.stateProperty,JSON.stringify(s));
  SO_bridgeWriteStatus_({version:SO_BRIDGE.version,armed:SO_bridgeArmed_(),stage:stage,
    request_id:s.request_id||'',project:s.project||'',phase:s.phase,at:s.updated_at,
    error:s.error||'',rollback:s.rollback||null,verification:s.dashboard_verification||null});
  return s;
}
function SO_bridgeFinish_(s,ok) {
  const result={request_id:s.request_id||'',project:s.project||'',
    result:ok?'PASS':'FAIL',at:new Date().toISOString(),stage:s.stage,
    error:s.error||'',rollback:s.rollback||null,new_deployed_version:s.new_version||null,
    verification:s.dashboard_verification||null};
  const folder=SO_bridgeFolder_();
  const name=SO_BRIDGE.resultPrefix+(s.request_id||'unknown')+'.json';
  SO_bridgeAssert_(!folder.getFilesByName(name).hasNext(),'Result file already exists.');
  folder.createFile(name,JSON.stringify(result,null,2),MimeType.PLAIN_TEXT);
  DriveApp.getFileById(s.request_file_id).setName(
    (ok?SO_BRIDGE.donePrefix:SO_BRIDGE.failPrefix)+(s.request_id||'unknown')+'.json');
  PropertiesService.getScriptProperties().deleteProperty(SO_BRIDGE.stateProperty);
  if(!ok)PropertiesService.getScriptProperties().setProperty(SO_BRIDGE.armedProperty,'false');
  SO_bridgeWriteStatus_({version:SO_BRIDGE.version,armed:SO_bridgeArmed_(),stage:ok?'SUCCESS':'FAILED',
    at:new Date().toISOString(),last_result:result});
  return result;
}
function SO_bridgeSource_(r) {
  if(r.project==='dashboard') {
    SO_bridgeAssert_(r.target_file==='Code'&&/^[A-Za-z0-9_-]{15,}$/.test(r.source_file_id||''),'Dashboard source must be a private Drive Code file.');
    const f=DriveApp.getFileById(r.source_file_id);
    const email=String(Session.getEffectiveUser().getEmail()||'').toLowerCase();
    SO_bridgeAssert_(email&&f.getOwner()&&String(f.getOwner().getEmail()||'').toLowerCase()===email,'Dashboard source must be bridge-owner owned.');
    SO_bridgeAssert_(f.getSharingAccess()===DriveApp.Access.PRIVATE,'Dashboard source cannot have public/link sharing.');
    SO_bridgeAssert_(f.getName()===('Sync Opps Dashboard Source '+r.request_id+'.gs'),'Unexpected private source filename.');
    const parents=f.getParents();let inFolder=false;
    while(parents.hasNext())if(parents.next().getId()===SO_bridgeFolder_().getId())inFolder=true;
    SO_bridgeAssert_(inFolder,'Dashboard source must be in the approved private development folder.');
    const body=f.getBlob().getDataAsString();
    SO_bridgeAssert_(body.length>100&&body.length<300000&&SO_bridgeHash_(body)===r.source_sha256,'Dashboard private source hash or size mismatch.');
    return body;
  }
  const sha=String(r.github_commit||'');
  SO_bridgeAssert_(/^[a-f0-9]{40}$/i.test(sha),'Require immutable GitHub commit SHA.');
  const expected=SO_BRIDGE.allowedSources[r.project]||{};
  SO_bridgeAssert_(expected[r.target_file]===r.repo_path,'Source path not allowlisted for this project/file.');
  const url='https://raw.githubusercontent.com/musiclerk-png/sync-opps-ready-to-license/'+
    sha+'/'+r.repo_path;
  const response=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:false});
  SO_bridgeAssert_(response.getResponseCode()===200,'GitHub immutable source unavailable.');
  const body=response.getContentText();
  SO_bridgeAssert_(body.length>100&&body.length<300000,'Unexpected source size.');
  SO_bridgeAssert_(SO_bridgeHash_(body)===r.source_sha256,'Source hash mismatch.');
  SO_bridgeAssert_(!/(CLOUDINARY_API_SECRET\s*[:=]\s*['"][^'"]+['"])/.test(body),
    'Source appears to embed a private Cloudinary API secret.');
  return body;
}
function SO_bridgePrecheck_(s) {
  const file=DriveApp.getFileById(s.request_file_id),r=JSON.parse(file.getBlob().getDataAsString());
  // Capture the request ID before any permission or validation step can fail.
  // A failed precheck must never write another generic 'unknown' result.
  s.request_id=String(r.request_id||'').trim();
  const email=String(Session.getEffectiveUser().getEmail()||'').toLowerCase();
  SO_bridgeAssert_(!!email,'Cannot verify authorized request owner; refusing deployment.');
  SO_bridgeAssert_(!!file.getOwner() && String(file.getOwner().getEmail()||'').toLowerCase()===email,
    'Request must be owned by bridge Google account.');
  SO_bridgeAssert_(r.schema_version===1&&r.status==='READY','Bad request schema/status.');
  SO_bridgeAssert_(/^[a-z0-9-]{8,64}$/.test(s.request_id),'Bad request ID.');
  SO_bridgeAssert_(r.action==='UPDATE_HEAD'||r.action==='UPDATE_EXISTING_FEED'||r.action==='UPDATE_EXISTING_DASHBOARD',
    'Unsupported mutation mode.');
  SO_bridgeAssert_(Object.hasOwnProperty.call(SO_BRIDGE.expectedNames,r.project),'Unknown project.');
  SO_bridgeAssert_(r.action!=='UPDATE_EXISTING_FEED'||r.project==='feed','Only feed can use feed deployment mode.');
  SO_bridgeAssert_(r.action!=='UPDATE_EXISTING_DASHBOARD'||r.project==='dashboard','Only dashboard can use dashboard deployment mode.');
  SO_bridgeAssert_(r.project!=='dashboard'||r.action==='UPDATE_EXISTING_DASHBOARD','Dashboard requires verified existing deployment update.');
  const target=JSON.parse(PropertiesService.getScriptProperties().getProperty(SO_BRIDGE.targetProperty)||'{}');
  SO_bridgeAssert_(target[r.project]&&target[r.project]===r.target_script_id,'Target script not pinned.');
  SO_bridgeAssert_(r.project==='dashboard'?r.target_file==='Code':(SO_BRIDGE.allowedSources[r.project]||{})[r.target_file]===r.repo_path,
    'Source or file not allowlisted.');
  SO_bridgeAssert_(/^[a-f0-9]{64}$/.test(r.source_sha256||''),'Invalid source SHA.');
  SO_bridgeAssert_(r.expected_head_sha256==='ABSENT'||/^[a-f0-9]{64}$/.test(r.expected_head_sha256||''),
    'Invalid expected HEAD SHA.');
  SO_bridgeAssert_(r.target_file!=='Code'||r.expected_head_sha256!=='ABSENT',
    'Existing production Code file cannot be created from an empty baseline.');
  SO_bridgeAssert_(r.approval==='APPROVED_SOURCE_CHANGE',
    'Source change has not been marked reviewed and approved.');
  const folder=SO_bridgeFolder_();
  SO_bridgeAssert_(!folder.getFilesByName(SO_BRIDGE.resultPrefix+r.request_id+'.json').hasNext(),
    'Previously processed request.');
  const current=SO_bridgeMinimalFiles_(SO_bridgeContent_(r.target_script_id).files);
  const old=SO_bridgeFile_(current,r.target_file);
  const currentSha=old?SO_bridgeHash_(old.source):'ABSENT';
  SO_bridgeAssert_(currentSha===r.expected_head_sha256,'Live code changed since requested SHA.');
  SO_bridgeAssert_(current.some(f=>f.name==='appsscript'&&f.type==='JSON'),'Manifest missing.');
  SO_bridgeSource_(r); // validate exactly once before any write
  let deployment=null,oldDeployedProjectSha=null;
  if(r.action!=='UPDATE_HEAD') {
    const spec=SO_bridgeDeploySpec_(r.project);
    SO_bridgeAssert_(r.deployment_id===spec.id,'Deployment ID mismatch.');
    deployment=SO_bridgeDeployment_(r.target_script_id,r.deployment_id);
    SO_bridgeAssert_(Number((deployment.deploymentConfig||{}).versionNumber)===r.expected_deployed_version,
      'Deployed version changed.');
    SO_bridgeAssert_(SO_bridgeWebUrl_(deployment)===spec.url,'Deployment URL mismatch.');
    if(r.project==='dashboard'){
      const oldChecked=SO_bridgeDashboardDeploymentCheck_(r.target_script_id,deployment,spec);
      oldDeployedProjectSha=SO_bridgeAllHash_(oldChecked.files);
      const m=SO_bridgeDashboardManifest_(current);
      SO_bridgeAssert_(file.getSharingAccess()===DriveApp.Access.PRIVATE,'Dashboard request must not be public or link-shared.');
      SO_bridgeAssert_(r.expected_manifest_sha256===SO_bridgeHash_(m.file.source),'Dashboard manifest changed.');
      SO_bridgeAssert_(r.expected_project_sha256===SO_bridgeAllHash_(current),'Dashboard project changed.');
      if(r.dashboard_scope_upgrade!==undefined)SO_bridgeAssert_(r.dashboard_scope_upgrade==='APPROVED_READ_WRITE'&&!m.write,'Only separately approved read-only to write transition is allowed.');
    }
  }
  if(r.project==='dashboard')SO_bridgeAssert_(folder.getSharingAccess()===DriveApp.Access.PRIVATE,'Private dashboard snapshots require a non-public folder.');
  const backupName=SO_BRIDGE.backupPrefix+r.request_id+'.json';
  SO_bridgeAssert_(!folder.getFilesByName(backupName).hasNext(),'Duplicate backup request ID.');
  const backup=folder.createFile(backupName,JSON.stringify({source:r,files:current,deployment:deployment},null,2),
    MimeType.PLAIN_TEXT);
  Object.assign(s,{request_id:r.request_id,project:r.project,target_script_id:r.target_script_id,
    expected_sha:currentSha,source_sha:r.source_sha256,backup_id:backup.getId(),
    original_project_sha:r.project==='dashboard'?SO_bridgeAllHash_(current):null,
    old_deployed_project_sha:oldDeployedProjectSha,
    action:r.action,target_file:r.target_file,
    deployment_id:r.deployment_id||'',old_version:r.expected_deployed_version||null,
    new_version:null,updated_head:false,updated_deployment:false,verify_attempts:0,phase:'APPLY_HEAD'});
  return SO_bridgeCheckpoint_(s,'PRECHECK_PASSED');
}
function SO_bridgeApply_(s) {
  const backup=JSON.parse(DriveApp.getFileById(s.backup_id).getBlob().getDataAsString());
  const r=backup.source,source=SO_bridgeSource_(r);
  const current=SO_bridgeMinimalFiles_(SO_bridgeContent_(s.target_script_id).files);
  const original=SO_bridgeFile_(current,s.target_file);
  const sha=original?SO_bridgeHash_(original.source):'ABSENT';
  SO_bridgeAssert_(sha===s.expected_sha,'Unexpected concurrent source change.');
  if(s.project==='dashboard')SO_bridgeAssert_(SO_bridgeAllHash_(current)===s.original_project_sha,'Concurrent dashboard project change.');
  const next=current.map(x=>x.name===s.target_file&&x.type==='SERVER_JS'?
    {name:x.name,type:'SERVER_JS',source:source}:x);
  if(s.expected_sha==='ABSENT')next.push({name:s.target_file,type:'SERVER_JS',source:source});
  if(s.project==='dashboard'){
    if(r.dashboard_scope_upgrade==='APPROVED_READ_WRITE'){
      const m=SO_bridgeDashboardManifest_(next);
      SO_bridgeAssert_(!m.write,'Dashboard is already write-capable.');
      m.manifest.oauthScopes=m.manifest.oauthScopes.map(x=>x==='https://www.googleapis.com/auth/spreadsheets.readonly'?'https://www.googleapis.com/auth/spreadsheets':x);
      m.file.source=JSON.stringify(m.manifest,null,2)+'\n';
    }
    SO_bridgeDashboardManifest_(next);
    s.candidate_project_sha=SO_bridgeAllHash_(next);
  }
  s.updated_head=true;SO_bridgeCheckpoint_(s,'HEAD_UPDATE_ATTEMPTED');
  SO_bridgeApi_('PUT','/projects/'+encodeURIComponent(s.target_script_id)+'/content',{files:next});
  s.phase='VERIFY_HEAD';return SO_bridgeCheckpoint_(s,'HEAD_UPDATED');
}
function SO_bridgeVerifyHead_(s) {
  const content=SO_bridgeContent_(s.target_script_id);
  const file=SO_bridgeFile_(content.files,s.target_file);
  SO_bridgeAssert_(file&&SO_bridgeHash_(String(file.source||''))===s.source_sha,'HEAD SHA mismatch.');
  if(s.project==='dashboard')SO_bridgeAssert_(SO_bridgeAllHash_(content.files)===s.candidate_project_sha,'Dashboard HEAD or manifest mismatch.');
  s.phase=s.action==='UPDATE_HEAD'?'FINALIZE':'CREATE_VERSION';
  return SO_bridgeCheckpoint_(s,'HEAD_VERIFIED');
}
function SO_bridgeVersion_(s) {
  if(s.project==='dashboard')SO_bridgeAssert_(SO_bridgeAllHash_(SO_bridgeContent_(s.target_script_id).files)===s.candidate_project_sha,'Dashboard HEAD changed before version creation.');
  const version=SO_bridgeApi_('POST','/projects/'+encodeURIComponent(s.target_script_id)+'/versions',
    {description:'Sync Opps Dev Bridge '+s.request_id});
  s.new_version=Number(version.versionNumber||0);
  SO_bridgeAssert_(s.new_version>0,'No immutable version created.');
  if(s.project==='dashboard'){
    const f=SO_bridgeApi_('GET','/projects/'+encodeURIComponent(s.target_script_id)+'/content?versionNumber='+s.new_version).files;
    SO_bridgeAssert_(SO_bridgeAllHash_(f)===s.candidate_project_sha,'Dashboard immutable version mismatch.');
  }
  s.phase='UPDATE_DEPLOYMENT';return SO_bridgeCheckpoint_(s,'VERSION_CREATED');
}
function SO_bridgeDeploy_(s) {
  const existing=SO_bridgeDeployment_(s.target_script_id,s.deployment_id);
  SO_bridgeAssert_(Number((existing.deploymentConfig||{}).versionNumber)===Number(s.old_version),
    'Existing deployment version changed before update.');
  const spec=SO_bridgeDeploySpec_(s.project);
  SO_bridgeAssert_(s.deployment_id===spec.id&&SO_bridgeWebUrl_(existing)===spec.url,'Canonical URL mismatch.');
  if(s.project==='dashboard'){
    SO_bridgeDashboardDeploymentCheck_(s.target_script_id,existing,spec);
    const f=SO_bridgeApi_('GET','/projects/'+encodeURIComponent(s.target_script_id)+'/content?versionNumber='+s.new_version).files;
    SO_bridgeDashboardManifest_(SO_bridgeMinimalFiles_(f));
    SO_bridgeAssert_(SO_bridgeAllHash_(f)===s.candidate_project_sha,'Dashboard candidate version changed.');
  }
  const config=existing.deploymentConfig||{};
  s.updated_deployment=true;SO_bridgeCheckpoint_(s,'DEPLOYMENT_UPDATE_ATTEMPTED');
  SO_bridgeApi_('PUT','/projects/'+encodeURIComponent(s.target_script_id)+
    '/deployments/'+encodeURIComponent(s.deployment_id),
    {deploymentConfig:{scriptId:s.target_script_id,versionNumber:s.new_version,
      manifestFileName:config.manifestFileName||'appsscript',description:config.description||''}});
  s.phase='VERIFY_DEPLOYMENT';
  return SO_bridgeCheckpoint_(s,'DEPLOYMENT_UPDATED');
}
function SO_bridgeVerifyDeploy_(s) {
  const d=SO_bridgeDeployment_(s.target_script_id,s.deployment_id);
  if(s.project==='dashboard'){
    const spec=SO_bridgeDashboardSpec_();
    s.verify_attempts=(Number(s.verify_attempts)||0)+1;
    const diagnostic=s.dashboard_verification={
      attempt:s.verify_attempts,max_attempts:SO_BRIDGE.dashboardVerifyMaxAttempts,
      expected_version:Number(s.new_version),previous_version:Number(s.old_version),
      observed_version:Number((d.deploymentConfig||{}).versionNumber||0),
      expected_project_sha256:s.candidate_project_sha,
      previous_deployed_project_sha256:s.old_deployed_project_sha||null,
      observed_deployed_project_sha256:null,observed_head_project_sha256:null,
      observed_candidate_version_sha256:null,classification:'CHECKING'
    };
    // Identity, access, manifest and source checks are mandatory on every attempt.
    const checked=SO_bridgeDashboardDeploymentCheck_(s.target_script_id,d,spec);
    diagnostic.observed_deployed_project_sha256=SO_bridgeAllHash_(checked.files);
    diagnostic.observed_head_project_sha256=SO_bridgeAllHash_(SO_bridgeContent_(s.target_script_id).files);
    SO_bridgeAssert_(diagnostic.observed_head_project_sha256===s.candidate_project_sha,'Dashboard HEAD changed during deployment.');
    // Recheck the immutable candidate independently of the deployment's reported version.
    const candidate=SO_bridgeMinimalFiles_(SO_bridgeApi_('GET','/projects/'+encodeURIComponent(s.target_script_id)+'/content?versionNumber='+s.new_version).files);
    SO_bridgeDashboardManifest_(candidate);
    diagnostic.observed_candidate_version_sha256=SO_bridgeAllHash_(candidate);
    SO_bridgeAssert_(diagnostic.observed_candidate_version_sha256===s.candidate_project_sha,'Dashboard immutable candidate source mismatch.');
    if(checked.version===Number(s.new_version)){
      diagnostic.classification='EXPECTED_VERSION';
      SO_bridgeAssert_(diagnostic.observed_deployed_project_sha256===s.candidate_project_sha,'Dashboard deployed candidate source mismatch.');
      diagnostic.classification='VERIFIED';
      s.phase='FINALIZE';return SO_bridgeCheckpoint_(s,'PRIVATE_DASHBOARD_DEPLOYMENT_METADATA_VERIFIED');
    }
    // Only the exact, known previous deployment is eligible for a bounded read-only retry.
    // Never repeat the deployment PUT, tolerate unknown versions, or accept a mismatched hash.
    diagnostic.classification='UNEXPECTED_VERSION';
    SO_bridgeAssert_(checked.version===Number(s.old_version),'Dashboard deployment points to an unexpected third version.');
    diagnostic.classification='PREVIOUS_VERSION_REPORTED';
    SO_bridgeAssert_(!!s.old_deployed_project_sha&&diagnostic.observed_deployed_project_sha256===s.old_deployed_project_sha,'Dashboard previous deployed source mismatch.');
    if(s.verify_attempts>=SO_BRIDGE.dashboardVerifyMaxAttempts){
      diagnostic.classification='PREVIOUS_VERSION_TIMEOUT';
      throw Error('Dashboard still reports previous deployment version after bounded verification.');
    }
    return SO_bridgeCheckpoint_(s,'WAITING_FOR_DASHBOARD_PROPAGATION');
  }
  if(Number((d.deploymentConfig||{}).versionNumber)===Number(s.new_version)&&
     SO_bridgeWebUrl_(d)===SO_BRIDGE.feedUrl) {
    const res=UrlFetchApp.fetch(SO_BRIDGE.feedUrl,{muteHttpExceptions:true,followRedirects:true});
    if(res.getResponseCode()===200) {
      try {
        // Public feed is intentionally JSONP because GitHub Pages loads it as
        // a third-party script, not an XHR JSON response. Parse the exact
        // trusted callback without eval, never arbitrary JavaScript.
        const payload=String(res.getContentText()||'').trim();
        const match=payload.match(/^window\.syncOppsApprovedFeedV1\((\{[\s\S]*\})\);?$/);
        if(!match)throw Error('Existing feed response is not approved JSONP');
        const body=JSON.parse(match[1]);
        if(body && body.schemaVersion===1 && Array.isArray(body.songs)){
          s.phase='FINALIZE';return SO_bridgeCheckpoint_(s,'EXISTING_FEED_VERIFIED');
        }
      }catch(e){}
    }
  }
  s.verify_attempts++;
  if(s.verify_attempts>=8)throw Error('Existing feed failed bounded public JSON verification.');
  return SO_bridgeCheckpoint_(s,'WAITING_FOR_FEED_PROPAGATION');
}
function SO_bridgeRollback_(s) {
  const result={head_restored:false,deployment_restored:false,errors:[]};
  try {
    if(s.updated_deployment&&s.deployment_id) {
      const d=SO_bridgeDeployment_(s.target_script_id,s.deployment_id),config=d.deploymentConfig||{};
      if(Number(config.versionNumber)===Number(s.old_version)) {
        result.deployment_restored=true; // No mutation happened or already rolled back.
      } else {
        SO_bridgeAssert_(Number(config.versionNumber)===Number(s.new_version),
          'Deployment was changed by another operator; do not overwrite.');
        const backup=JSON.parse(DriveApp.getFileById(s.backup_id).getBlob().getDataAsString());
        const old=backup.deployment.deploymentConfig||{};
        SO_bridgeApi_('PUT','/projects/'+encodeURIComponent(s.target_script_id)+
          '/deployments/'+encodeURIComponent(s.deployment_id),
          {deploymentConfig:{scriptId:s.target_script_id,versionNumber:s.old_version,
            manifestFileName:old.manifestFileName||'appsscript',description:old.description||''}});
        if(s.project==='dashboard'){
          const checked=SO_bridgeDashboardDeploymentCheck_(s.target_script_id,SO_bridgeDeployment_(s.target_script_id,s.deployment_id),SO_bridgeDashboardSpec_());
          SO_bridgeAssert_(checked.version===Number(s.old_version),'Dashboard deployment rollback readback mismatch.');
        }
        result.deployment_restored=true;
      }
    }
  }catch(e){result.errors.push('Deployment: '+String(e));}
  try {
    if(s.updated_head&&s.backup_id){
      const backup=JSON.parse(DriveApp.getFileById(s.backup_id).getBlob().getDataAsString());
      const live=SO_bridgeContent_(s.target_script_id);
      const current=SO_bridgeFile_(live.files,s.target_file);
      const liveSha=current?SO_bridgeHash_(String(current.source||'')):'ABSENT';
      const dashboard=s.project==='dashboard';
      const original=dashboard?SO_bridgeAllHash_(live.files)===s.original_project_sha:liveSha===s.expected_sha;
      if(original) {
        result.head_restored=true; // Mutation was not applied or was already undone.
      } else {
        SO_bridgeAssert_(dashboard?SO_bridgeAllHash_(live.files)===s.candidate_project_sha:liveSha===s.source_sha,
          'HEAD changed by another operator; do not overwrite.');
        SO_bridgeApi_('PUT','/projects/'+encodeURIComponent(s.target_script_id)+'/content',
          {files:backup.files});
        if(dashboard)SO_bridgeAssert_(SO_bridgeAllHash_(SO_bridgeContent_(s.target_script_id).files)===s.original_project_sha,'Dashboard rollback readback mismatch.');
        result.head_restored=true;
      }
    }
  }catch(e){result.errors.push('HEAD: '+String(e));}
  s.rollback=result;s.phase='FAIL';
  return SO_bridgeCheckpoint_(s,'ROLLBACK_ATTEMPTED');
}
/** One bounded phase per one-minute trigger; never changes target Script Properties. */
function SO_bridgePoll() {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))return;
  try {
    if(!SO_bridgeArmed_())return;
    let s=SO_bridgeState_();
    if(!s) {
      const f=SO_bridgeFindRequest_();
      if(!f)return;
      s={phase:'PRECHECK',request_file_id:f.getId(),started_at:new Date().toISOString()};
      SO_bridgeCheckpoint_(s,'REQUEST_FOUND');
      return;
    }
    try {
      switch(s.phase) {
      case 'PRECHECK':return SO_bridgePrecheck_(s);
      case 'APPLY_HEAD':return SO_bridgeApply_(s);
      case 'VERIFY_HEAD':return SO_bridgeVerifyHead_(s);
      case 'CREATE_VERSION':return SO_bridgeVersion_(s);
      case 'UPDATE_DEPLOYMENT':return SO_bridgeDeploy_(s);
      case 'VERIFY_DEPLOYMENT':return SO_bridgeVerifyDeploy_(s);
      case 'FINALIZE':return SO_bridgeFinish_(s,true);
      case 'ROLLBACK':return SO_bridgeRollback_(s);
      case 'FAIL':return SO_bridgeFinish_(s,false);
      default:throw Error('Unknown bridge phase.');
      }
    }catch(e){
      s.error=String(e);
      s.phase=(s.updated_head||s.updated_deployment)?'ROLLBACK':'FAIL';
      return SO_bridgeCheckpoint_(s,'PHASE_FAILED');
    }
  }finally{lock.releaseLock();}
}
