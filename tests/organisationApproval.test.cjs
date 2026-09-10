const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
function load(path, dependencies) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function('require', 'exports', code)(name => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, exports);
  return exports;
}
const roles = load('src/constants/organisationRoles.ts', {});
function harness(org, opts = {}) {
  const request = { userId: 'account', organisationRole: org, organisationName: 'Office', districtId: 'district', districtName: 'District', status: 'pending', contactPersonName: 'Contact', email: 'office@example.test', mobile: '1234567890', officeAddress: 'Address', ...(org === 'diet' ? { registeredDietId: 'diet1' } : {}) };
  const records = new Map(Object.entries({
    'users/admin': { systemRole: 'scert_admin', active: true, approvalStatus: 'approved' },
    'users/account': { ...request, uid: 'account', approvalStatus: 'pending', systemRole: 'pending_user', divisionName: 'Division', engineeringDiscipline: 'Civil', architectureZone: 'north' },
    'registrationRequests/account': request,
    'diets/diet1': { name: 'DIET One', districtId: 'district', active: true },
    'diets/diet2': { name: 'DIET Two', districtId: 'other', active: true },
  }));
  let serial = 0;
  const firestore = {
    collection: (_, path) => path,
    doc: (db, collection, id) => { const path = id ? `${collection}/${id}` : `${db}/${collection || ++serial}`; return { path, id: path.split("/").pop() }; },
    serverTimestamp: () => 'timestamp',
    runTransaction: async (_, fn) => {
      const writes = [];
      await fn({ get: async ref => ({ id: ref.id, exists: () => records.has(ref.path), data: () => records.get(ref.path) }), update: (ref, data) => writes.push([ref.path, { ...records.get(ref.path), ...data }]), set: (ref, data) => writes.push([ref.path, data]) });
      for (const [ref, data] of writes) records.set(ref, data);
    },
  };
  const service = load('src/services/approvalService.ts', {
    'firebase/firestore': firestore,
    '../lib/firebase': { auth: { currentUser: { uid: 'admin' } }, db: {}, isFirebaseConfigured: true },
    '../constants/organisationRoles': roles,
    './agencyService': { getAgencies: async () => opts.agencies || [], normaliseAgencyName: x => x.trim().toLowerCase() },
  });
  return { records, approve: ids => service.approveRegistration({ request, assignedDietIds: ids, remarks: 'Verified' }) };
}
for (const [org, role] of [['diet', 'diet_nodal_officer'], ['pwd', 'agency_user'], ['rdp', 'agency_user'], ['architecture_department', 'architecture_user']]) {
  test(`${org}: atomic approval preserves organisation and activates DIET scope without assignment records`, async () => {
    const h = harness(org); await h.approve(['diet1']);
    const user = h.records.get('users/account');
    assert.equal(user.uid, 'account'); assert.equal(user.organisationRole, org); assert.equal(user.systemRole, role);
    assert.equal(user.active, true); assert.equal(user.approvalStatus, 'approved'); assert.equal(user.assignmentStatus, 'assigned');
    assert.deepEqual(user.assignedDietIds, ['diet1']); assert.equal(user.divisionName, 'Division'); assert.equal(user.engineeringDiscipline, 'Civil');
    assert.equal(h.records.get('registrationRequests/account').status, 'approved');
    assert.equal([...h.records.keys()].some(k => k.startsWith('userAssignments/')), false);
    assert.equal([...h.records.keys()].filter(k => k.startsWith('auditLogs/')).length, 1);
    if (['pwd', 'rdp'].includes(org)) { assert.deepEqual(user.assignedAgencyIds, [`organisation_${org}_office`]); assert.equal(h.records.get(`agencies/organisation_${org}_office`).agencyType, org); }
    if (org === 'architecture_department') { assert.equal(user.architectureZone, 'north'); assert.deepEqual(user.assignedAgencyIds, []); }
    await assert.rejects(h.approve(['diet1']), /already been reviewed/);
  });
  test(`${org}: missing DIET scope is blocked without partial writes`, async () => {
    const h = harness(org); await assert.rejects(h.approve([]), /Select at least one/);
    assert.equal(h.records.get('registrationRequests/account').status, 'pending');
    assert.equal(h.records.get('users/account').systemRole, 'pending_user');
  });
}
test('DIET cannot be approved for an unrelated or invented DIET', async () => {
  const h = harness('diet'); await assert.rejects(h.approve(['diet2']), /declared/);
  const pwd = harness('pwd'); await assert.rejects(pwd.approve(['invented']), /missing or inactive/);
});
test('existing office identity is reused without duplicate agency creation', async () => {
  const h = harness('pwd', { agencies: [{ id: 'existing', name: 'Office', agencyType: 'pwd', active: true }] });
  h.records.set('agencies/existing', { name: 'Office', agencyType: 'pwd', active: true });
  await h.approve(['diet1', 'diet2']); assert.deepEqual(h.records.get('users/account').assignedAgencyIds, ['existing']);
  assert.equal([...h.records.keys()].filter(k => k.startsWith('agencies/')).length, 1);
});
test('non-admin reviewer cannot approve', async () => {
  const h = harness('pwd'); h.records.get('users/admin').systemRole = 'agency_user'; await assert.rejects(h.approve(['diet1']), /Only SCERT Admin/);
});
test('contractor registration is unsupported; existing contractor master remains outside approval', () => {
  assert.equal(roles.organisationRoleOptions.some(r => r.value === 'contractor'), false);
});
const scope = load('src/services/accessScopeService.ts', {
  '../lib/firestore': { getDietById: async id => ({ id, districtId: 'district' }) },
  './dietAgencyAssignmentService': { getAssignmentsForAgency: async () => [{ id: 'link', dietId: 'legacyDiet', districtId: 'district', status: 'active' }] },
  './scopeOfWorkService': {}, './tenderService': {}, './workPackageService': {},
});
test('approved PWD receives direct DIET plus existing agency relationship scope', async () => {
  const result = await scope.getUserAccessScope({ systemRole: 'agency_user', approvalStatus: 'approved', active: true, assignedDietIds: ['diet1'], assignedAgencyIds: ['agency1'] });
  assert.equal(result.accessType, 'agency'); assert.deepEqual(result.dietIds, ['diet1', 'legacyDiet']);
});
test('legacy primary agency and DIET fields still resolve', async () => {
  const base = { approvalStatus: 'approved', active: true };
  assert.deepEqual((await scope.getUserAccessScope({ ...base, systemRole: 'agency_user', primaryAgencyId: 'agency1' })).dietIds, ['legacyDiet']);
  assert.deepEqual((await scope.getUserAccessScope({ ...base, systemRole: 'diet_nodal_officer', primaryDietId: 'diet1' })).dietIds, ['diet1']);
});
test('pending, rejected and deactivated accounts have no operational scope', async () => {
  for (const status of ['pending', 'rejected', 'suspended']) assert.equal((await scope.getUserAccessScope({ systemRole: 'scert_admin', approvalStatus: status, active: true })).accessType, 'none');
  assert.equal((await scope.getUserAccessScope({ systemRole: 'agency_user', approvalStatus: 'approved', active: true, assignmentStatus: 'inactive' })).accessType, 'none');
});
test('Architecture scope is limited to assigned DIETs and SCERT retains global scope', async () => {
  const base = { approvalStatus: 'approved', active: true, assignedDietIds: ['diet1'] };
  assert.deepEqual(await scope.getUserAccessScope({ ...base, systemRole: 'architecture_user' }), { accessType: 'architecture', dietIds: ['diet1'], agencyIds: [], districtIds: [] });
  assert.equal((await scope.getUserAccessScope({ ...base, systemRole: 'scert_admin' })).accessType, 'global');
});
