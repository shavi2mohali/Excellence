// Local emulator only. Never points at production.
const assert = require('node:assert/strict');
const project = 'demo-excellence-scope-phase';
const root = `http://127.0.0.1:8188/v1/projects/${project}/databases/(default)/documents`;
const value = x => x === null ? { nullValue: null } : Array.isArray(x) ? { arrayValue: { values: x.map(value) } } : typeof x === 'boolean' ? { booleanValue: x } : typeof x === 'number' ? { integerValue: String(x) } : { stringValue: x };
const fields = data => Object.fromEntries(Object.entries(data).map(([k,v]) => [k,value(v)]));
function token(uid) {
  const encode = data => Buffer.from(JSON.stringify(data)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: uid, user_id: uid, aud: project, iss: `https://securetoken.google.com/${project}`, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600, firebase: { sign_in_provider: 'password', identities: {} } })}.`;
}
async function call(method, path, uid, data, expected = 200) {
  const response = await fetch(`${root}/${path}`, { method, headers: { Authorization: `Bearer ${uid === 'owner' ? 'owner' : token(uid)}`, 'Content-Type': 'application/json' }, ...(data ? { body: JSON.stringify({ fields: fields(data) }) } : {}) });
  const text = await response.text(); assert.equal(response.status, expected, `${method} ${path} as ${uid}: ${text}`);
}
(async () => {
  const rules = await fetch(`http://127.0.0.1:8188/emulator/v1/projects/${project}:securityRules`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content: require('node:fs').readFileSync('firestore.rules', 'utf8') }] } }) });
  assert.equal(rules.status, 200, await rules.text());
  const reset = await fetch(`http://127.0.0.1:8188/emulator/v1/projects/${project}/databases/(default)/documents`, { method: 'DELETE' });
  assert.equal(reset.status, 200);
  const profile = role => ({ systemRole:role, approvalStatus:'approved',active:true,assignmentStatus:'assigned',assignedDietIds:['p1','p2','p3','p4','legacy1','legacy2','legacy3','custom','unknown'],assignedAgencyIds:['agency'] });
  await call('PATCH','users/admin','owner',profile('scert_admin'));
  await call('PATCH','users/diet','owner',profile('diet_nodal_officer'));
  await call('PATCH','users/pwd','owner',profile('agency_user'));
  await call('PATCH','users/rdp','owner',profile('agency_user'));
  await call('PATCH','users/architecture','owner',profile('architecture_user'));
  await call('PATCH','phases/customPhase','owner',{phaseSequence:4});
  const cases = [ ['p1',{phaseSequence:1},false], ['p2',{phaseSequence:2},false], ['p3',{phaseSequence:3},true], ['p4',{phaseId:'phase_4'},true], ['legacy1',{phaseId:'phase_2023_24'},false], ['legacy2',{phaseId:'phase_2025_26'},false], ['legacy3',{phaseId:'phase_2026_27'},true], ['custom',{phaseId:'customPhase'},true], ['unknown',{},false] ];
  for (const [id, phase, enabled] of cases) {
    await call('PATCH',`diets/${id}`,'owner',{ name:id,...phase });
    await call('PATCH',`dietAgencyAssignments/${id}`,'owner',{dietId:id,executingAgencyId:'agency',status:'active'});
    const scope = { dietId:id,executingAgencyId:'agency',dietAgencyAssignmentId:id,status:'draft',preparedBy:'diet',updatedBy:'diet',scopeCategories:['civil_work'],activityIds:['activity'],phaseSequence:3,phaseId:'phase_3' };
    await call('PATCH',`scopeOfWorks/new-${id}`,'diet',scope,enabled?200:403);
    // Existing historical documents survive but even administrators cannot modify them.
    await call('PATCH',`scopeOfWorks/old-${id}`,'owner',scope);
    await call('PATCH',`scopeOfWorks/old-${id}`,'admin',{...scope,scopeTitle:'Updated'},enabled?200:403);
    await call('GET',`scopeOfWorks/old-${id}`,'admin');
    if (!enabled) {
      for (const actor of ['diet','pwd','rdp','architecture']) await call('PATCH',`scopeOfWorks/old-${id}`,actor,{...scope,status:'architecture_review',updatedBy:actor},403);
      await call('PATCH',`scopeOfWorks/old-${id}`,'admin',{...scope,dietId:'p3'},403);
    }
    await call('PATCH',`drawingPackages/${id}`,'architecture',{scopeOfWorkId:`old-${id}`,dietId:id,drawingDiscipline:'architectural',issuedBy:'architecture'},enabled?200:403);
    await call('PATCH',`communications/${id}`,'architecture',{entityType:'scope_of_work',entityId:`old-${id}`,fromUserId:'architecture',attachmentIds:[]},enabled?200:403);
    await call('PATCH',`documentAttachments/${id}`,'architecture',{entityType:'scope_of_work',entityId:`old-${id}`,uploadedBy:'architecture',mimeType:'application/pdf',size:100},enabled?200:403);
  }
  for (const [id, phaseSequence] of [['p1',1],['p2',2],['p3',3]]) {
    await call('PATCH',`workPackages/${id}`,'pwd',{dietId:id,dietAgencyAssignmentId:id,executingAgencyId:'agency',phaseSequence,status:'draft',createdBy:'pwd',updatedBy:'pwd',administrativeApprovalAmount:0,technicalSanctionAmount:0,scopeOfWorkId:'',activityIds:['activity']},phaseSequence<=2?200:403);
  }
  console.log('PASS: Scope phase rules, canonical/legacy/future phases, phase spoofing, historical immutability, Architecture writes, and Phase I/II work packages without Scope.');
})().catch(e=>{console.error(e);process.exitCode=1;});
