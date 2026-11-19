/**
 * Sync Opps. Apps Script Development Bridge v0.1
 * Based on the previously approved FoundBuyer phased Dev Bridge pattern.
 * One independent management script; the four existing target projects,
 * Script Properties, triggers and deployed Web App URLs are left intact.
 *
 * Install disarmed. Run SO_bridgeInstallReadOnly and inspect the private
 * Drive status before calling SO_bridgeArm. Never paste API secrets here.
 */
const SO_BRIDGE = Object.freeze({
  version: '0.1',
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
  expectedNames: Object.freeze({
    intake: /sync\s*opps.*catalog\s*intake/i,
    removal: /sync\s*opps.*(?:song\s*removal|removal\s*processor)/i,
    feed: /sync\s*opps.*public\s*catalog\s*feed/i,
    beta_buyer: /sync\s*opps.*beta.*buyer.*intake/i
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
    p.setProperty(SO_BRIDGE.armedProperty,'false');
    p.deleteProperty(SO_BRIDGE.stateProperty);
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
      if(k==='feed'){
        const d=SO_bridgeDeployment_(x.id,SO_BRIDGE.feedDeploymentId);
        target.deployedVersion=Number((d.deploymentConfig||{}).versionNumber||0);
        target.deploymentId=d.deploymentId;
        target.webAppUrl=SO_bridgeWebUrl_(d);
        SO_bridgeAssert_(target.webAppUrl===SO_BRIDGE.feedUrl,'The existing feed URL does not match. Stop.');
        SO_bridgeAssert_(target.deployedVersion>0,'Existing feed deployed version missing.');
      }
      report.targets[k]=target;report.target_ids[k]=x.id;
      report.checks.push({name:k+' Apps Script API read',ok:true,scriptId:x.id});
    }catch(e){report.checks.push({name:k+' Apps Script API read',ok:false,error:String(e)});}
  });
  report.result=report.folderAccessible&&report.checks.every(c=>c.ok)&&
    Object.keys(report.target_ids).length===4?'PASS':'FAIL';
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
    error:s.error||'',rollback:s.rollback||null});
  return s;
}
function SO_bridgeFinish_(s,ok) {
  const result={request_id:s.request_id||'',project:s.project||'',
    result:ok?'PASS':'FAIL',at:new Date().toISOString(),stage:s.stage,
    error:s.error||'',rollback:s.rollback||null,new_deployed_version:s.new_version||null};
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
  const email=String(Session.getEffectiveUser().getEmail()||'').toLowerCase();
  if(email&&file.getOwner())SO_bridgeAssert_(String(file.getOwner().getEmail()||'').toLowerCase()===email,
    'Request must be owned by bridge Google account.');
  SO_bridgeAssert_(r.schema_version===1&&r.status==='READY','Bad request schema/status.');
  SO_bridgeAssert_(/^[a-z0-9-]{8,64}$/.test(r.request_id||''),'Bad request ID.');
  SO_bridgeAssert_(r.action==='UPDATE_HEAD'||r.action==='UPDATE_EXISTING_FEED',
    'Unsupported mutation mode.');
  SO_bridgeAssert_(Object.hasOwnProperty.call(SO_BRIDGE.expectedNames,r.project),'Unknown project.');
  SO_bridgeAssert_(r.action!=='UPDATE_EXISTING_FEED'||r.project==='feed','Only feed can deploy web app.');
  const target=JSON.parse(PropertiesService.getScriptProperties().getProperty(SO_BRIDGE.targetProperty)||'{}');
  SO_bridgeAssert_(target[r.project]&&target[r.project]===r.target_script_id,'Target script not pinned.');
  SO_bridgeAssert_((SO_BRIDGE.allowedSources[r.project]||{})[r.target_file]===r.repo_path,
    'Source or file not allowlisted.');
  SO_bridgeAssert_(/^[a-f0-9]{64}$/.test(r.source_sha256||''),'Invalid source SHA.');
  SO_bridgeAssert_(r.expected_head_sha256==='ABSENT'||/^[a-f0-9]{64}$/.test(r.expected_head_sha256||''),
    'Invalid expected HEAD SHA.');
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
  let deployment=null;
  if(r.action==='UPDATE_EXISTING_FEED') {
    SO_bridgeAssert_(r.deployment_id===SO_BRIDGE.feedDeploymentId,'Deployment ID mismatch.');
    deployment=SO_bridgeDeployment_(r.target_script_id,r.deployment_id);
    SO_bridgeAssert_(Number((deployment.deploymentConfig||{}).versionNumber)===r.expected_deployed_version,
      'Deployed version changed.');
    SO_bridgeAssert_(SO_bridgeWebUrl_(deployment)===SO_BRIDGE.feedUrl,'Feed URL mismatch.');
  }
  const backupName=SO_BRIDGE.backupPrefix+r.request_id+'.json';
  SO_bridgeAssert_(!folder.getFilesByName(backupName).hasNext(),'Duplicate backup request ID.');
  const backup=folder.createFile(backupName,JSON.stringify({source:r,files:current,deployment:deployment},null,2),
    MimeType.PLAIN_TEXT);
  Object.assign(s,{request_id:r.request_id,project:r.project,target_script_id:r.target_script_id,
    expected_sha:currentSha,source_sha:r.source_sha256,backup_id:backup.getId(),
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
  const next=current.map(x=>x.name===s.target_file&&x.type==='SERVER_JS'?
    {name:x.name,type:'SERVER_JS',source:source}:x);
  if(s.expected_sha==='ABSENT')next.push({name:s.target_file,type:'SERVER_JS',source:source});
  SO_bridgeApi_('PUT','/projects/'+encodeURIComponent(s.target_script_id)+'/content',{files:next});
  s.updated_head=true;s.phase='VERIFY_HEAD';return SO_bridgeCheckpoint_(s,'HEAD_UPDATED');
}
function SO_bridgeVerifyHead_(s) {
  const content=SO_bridgeContent_(s.target_script_id);
  const file=SO_bridgeFile_(content.files,s.target_file);
  SO_bridgeAssert_(file&&SO_bridgeHash_(String(file.source||''))===s.source_sha,'HEAD SHA mismatch.');
  s.phase=s.action==='UPDATE_HEAD'?'FINALIZE':'CREATE_VERSION';
  return SO_bridgeCheckpoint_(s,'HEAD_VERIFIED');
}
function SO_bridgeVersion_(s) {
  const version=SO_bridgeApi_('POST','/projects/'+encodeURIComponent(s.target_script_id)+'/versions',
    {description:'Sync Opps Dev Bridge '+s.request_id});
  s.new_version=Number(version.versionNumber||0);
  SO_bridgeAssert_(s.new_version>0,'No immutable version created.');
  s.phase='UPDATE_DEPLOYMENT';return SO_bridgeCheckpoint_(s,'VERSION_CREATED');
}
function SO_bridgeDeploy_(s) {
  const existing=SO_bridgeDeployment_(s.target_script_id,s.deployment_id);
  SO_bridgeAssert_(Number((existing.deploymentConfig||{}).versionNumber)===Number(s.old_version),
    'Existing deployment version changed before update.');
  SO_bridgeAssert_(SO_bridgeWebUrl_(existing)===SO_BRIDGE.feedUrl,'Canonical URL mismatch.');
  const config=existing.deploymentConfig||{};
  SO_bridgeApi_('PUT','/projects/'+encodeURIComponent(s.target_script_id)+
    '/deployments/'+encodeURIComponent(s.deployment_id),
    {deploymentConfig:{scriptId:s.target_script_id,versionNumber:s.new_version,
      manifestFileName:config.manifestFileName||'appsscript',description:config.description||''}});
  s.updated_deployment=true;s.phase='VERIFY_DEPLOYMENT';
  return SO_bridgeCheckpoint_(s,'DEPLOYMENT_UPDATED');
}
function SO_bridgeVerifyDeploy_(s) {
  const d=SO_bridgeDeployment_(s.target_script_id,s.deployment_id);
  if(Number((d.deploymentConfig||{}).versionNumber)===Number(s.new_version)&&
     SO_bridgeWebUrl_(d)===SO_BRIDGE.feedUrl) {
    const res=UrlFetchApp.fetch(SO_BRIDGE.feedUrl,{muteHttpExceptions:true,followRedirects:true});
    if(res.getResponseCode()===200) {
      try {
        const body=JSON.parse(res.getContentText());
        if(body&&typeof body==='object'&&('schemaVersion' in body||'songs' in body||'items' in body)){
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
      SO_bridgeAssert_(Number(config.versionNumber)===Number(s.new_version),
        'Deployment was changed by another operator; do not overwrite.');
      const backup=JSON.parse(DriveApp.getFileById(s.backup_id).getBlob().getDataAsString());
      const old=backup.deployment.deploymentConfig||{};
      SO_bridgeApi_('PUT','/projects/'+encodeURIComponent(s.target_script_id)+
        '/deployments/'+encodeURIComponent(s.deployment_id),
        {deploymentConfig:{scriptId:s.target_script_id,versionNumber:s.old_version,
          manifestFileName:old.manifestFileName||'appsscript',description:old.description||''}});
      result.deployment_restored=true;
    }
  }catch(e){result.errors.push('Deployment: '+String(e));}
  try {
    if(s.updated_head&&s.backup_id){
      const backup=JSON.parse(DriveApp.getFileById(s.backup_id).getBlob().getDataAsString());
      const live=SO_bridgeContent_(s.target_script_id);
      const current=SO_bridgeFile_(live.files,s.target_file);
      SO_bridgeAssert_(current&&SO_bridgeHash_(String(current.source||''))===s.source_sha,
        'HEAD changed by another operator; do not overwrite.');
      SO_bridgeApi_('PUT','/projects/'+encodeURIComponent(s.target_script_id)+'/content',
        {files:backup.files});
      result.head_restored=true;
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
