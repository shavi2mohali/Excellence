// Local emulator only. Never points at production.
const assert = require('node:assert/strict');
const project = 'demo-excellence-approval';
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
  await call('PATCH','diets/diet1','owner',{ name:'DIET One',districtId:'district',active:true });
  await call('PATCH','diets/diet2','owner',{ name:'DIET Two',districtId:'other',active:true });
  await call('PATCH','users/admin','owner',{ systemRole:'scert_admin',approvalStatus:'approved',active:true });
  const pending = { uid:'applicant',systemRole:'pending_user',role:'pending_user',organisationRole:'diet',districtId:'district',registeredDietId:'diet1',approvalStatus:'pending',active:false,isActive:false,approved:false,assignedDietIds:[],assignedAgencyIds:[] };
  await call('PATCH','users/applicant','applicant',pending);
  await call('PATCH','registrationRequests/applicant','applicant',{ userId:'applicant',organisationRole:'diet',districtId:'district',registeredDietId:'diet1',status:'pending',requestedSystemRole:'diet_nodal_officer' });
  await call('PATCH','users/applicant','applicant',{...pending,approvalStatus:'approved',active:true,systemRole:'scert_admin'},403);
  await call('PATCH','registrationRequests/applicant','applicant',{status:'approved'},403);
  await call('GET','diets/diet1','applicant',null,403);
  await call('PATCH','users/invented','invented',{...pending,uid:'invented',registeredDietId:'invented'},403);
  await call('PATCH','users/injected','injected',{...pending,uid:'injected',assignedDietIds:['diet2']},403);
  await call('PATCH','users/wrongdistrict','wrongdistrict',{...pending,uid:'wrongdistrict',registeredDietId:'diet2'},403);
  const approved = {...pending,systemRole:'diet_nodal_officer',role:'diet_nodal_officer',approvalStatus:'approved',active:true,isActive:true,approved:true,assignmentStatus:'assigned',assignedDietIds:['diet1']};
  await call('PATCH','users/applicant','admin',approved);
  await call('GET','diets/diet1','applicant');
  await call('GET','diets/diet2','applicant',null,403);
  await call('PATCH','users/applicant','applicant',{...approved,assignedDietIds:['diet2']},403);
  for (const org of ['pwd','rdp','architecture_department']) {
    await call('PATCH',`users/${org}`,'admin',{systemRole:org==='architecture_department'?'architecture_user':'agency_user',organisationRole:org,approvalStatus:'approved',active:true,assignmentStatus:'assigned',assignedDietIds:['diet1'],assignedAgencyIds:[]});
    await call('GET','diets/diet1',org);
    await call('GET','diets/diet2',org,null,403);
  }
  await call('PATCH','diets/diet1','architecture_department',{name:'Changed'},403);
  await call('PATCH','financialTransactions/one','owner',{dietId:'diet1',agencyId:'agency',transactionType:'release_to_agency'});
  await call('GET','financialTransactions/one','architecture_department',null,403);
  await call('PATCH','financialTransactions/two','architecture_department',{dietId:'diet1',amount:100},403);
  await call('GET','diets/diet2','admin');
  console.log('PASS: emulator assertions — registration, approval, applicant escalation, DIET isolation, PWD/RDP/Architecture scope, Architecture financial denial and admin access.');
})().catch(e => {console.error(e); process.exitCode=1;});
