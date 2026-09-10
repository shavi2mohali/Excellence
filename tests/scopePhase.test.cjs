const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(path, deps = {}, transform = s=>s) {
  const code = ts.transpileModule(transform(fs.readFileSync(path,'utf8')), { compilerOptions: { module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  new Function('require','exports',code)(name => {
    if(name in deps)return deps[name];
    if(['react/jsx-runtime','lucide-react'].includes(name))return require(name);
    if(name.endsWith('.css'))return {};
    throw new Error(`Missing dependency ${name} in ${path}`);
  }, exports);
  return exports;
}
const phase = load('src/constants/projectPhases.ts');
for(const n of [1,2,3,4,9]) test(`Phase ${n}: central capability matches canonical threshold`,()=>{
  assert.equal(phase.requiresPrePabWorkflow(n),n>=3);
  assert.equal(phase.getPhaseSequence({phaseId:`phase_${n}`}),n);
  assert.equal(phase.getPhaseCapabilities(n).scopeRequired,n>=3);
});
test('legacy phase mapping and unknown phase fail closed',()=>{
  for(const [id,n] of [['phase_2023_24',1],['phase_2025_26',2],['phase_2026_27',3]])assert.equal(phase.getPhaseSequence({phaseId:id}),n);
  assert.equal(phase.requiresPrePabWorkflow(phase.getPhaseSequence({})),false);
});
function harness(n,role='diet_nodal_officer',status='draft') {
  let writes=0;
  const records = {
    'diets/d':{phaseSequence:n},
    'users/user':{systemRole:role},
    'scopeOfWorks/s':{id:'s',dietId:'d',status,activityIds:['a'],currentDrawingRevision:'R1',dietAcceptedDrawingRevision:'R1',scertApprovedDrawingRevision:'R1',scopeRevision:1,drawingRequirement:'not_required'},
    'dietActivityFinancials/f':{dietId:'d',activityId:'a',agencyAllocation:100,active:true},
    'workPackages/w':{id:'w',dietId:'d',phaseSequence:n,status:'draft',activityAllocations:[{activityId:'a',financialRecordId:'f',packageAllocatedAmount:10}],estimatedCost:10},
  };
  const snapshot = path=>({id:path.split('/').pop(),exists:()=>path in records,data:()=>records[path]});
  const firestore = {
    doc:(db,col,id)=>({path:id?`${col}/${id}`:`${db}/new`,id:id||'new'}),
    collection:(_,name)=>name,query:(...args)=>args,where:(...args)=>args,
    getDoc:async ref=>snapshot(ref.path),getDocs:async()=>({docs:[]}),
    serverTimestamp:()=>0,arrayUnion:x=>x,
    writeBatch:()=>({set:()=>writes++,update:()=>writes++,commit:async()=>{}}),
  };
  const firebase = {db:{},auth:{currentUser:{uid:'user'}},getFirebaseConfigurationMessage:()=>''};
  const phaseService = load('src/services/scopePhaseService.ts',{'firebase/firestore':firestore,'../lib/firebase':firebase,'../constants/projectPhases':phase});
  const service = load('src/services/scopeOfWorkService.ts',{
    'firebase/firestore':firestore,'../lib/firebase':firebase,'./scopePhaseService':phaseService,'../constants/projectPhases':phase,
    '../lib/firestore':{getActivityMaster:async()=>[{id:'a',active:true}]},
    './dietActivityFinancialService':{getDietActivityFinancials:async()=>[{activityId:'a',active:true,agencyAllocation:100}]},
  });
  const packages = load('src/services/workPackageService.ts',{'firebase/firestore':firestore,'../lib/firebase':firebase,'../constants/projectPhases':phase,'../utils/fundingCalculations':{}});
  return {records,service,phaseService,packages,writes:()=>writes};
}
const input = {assignment:{id:'assignment',dietId:'d',status:'active',phaseSequence:3},scopeTitle:'Title',scopeDescription:'Description',scopeCategories:['civil_work'],activityIds:['a']};
for(const n of [1,2]) {
  test(`Phase ${n}: Scope create/update reject spoofed form phase and write nothing`,async()=>{
    const h=harness(n);await assert.rejects(h.service.createScopeOfWork(input),/Phase III/);await assert.rejects(h.service.updateScopeOfWork('s',input),/Phase III/);assert.equal(h.writes(),0);
    assert.deepEqual(await h.service.getScopesForDiet('d'),[]);
    await assert.rejects(h.service.getScopeOfWork('s'),/Phase III/);
  });
  for(const [fn,role,status] of [
    ['sendScopeToAgency','diet_nodal_officer','draft'],['sendScopeToArchitecture','diet_nodal_officer','draft'],
    ['startAgencyScopeReview','agency_user','sent_to_agency'],['requestAgencyScopeRevision','agency_user','agency_review'],['acceptScopeByAgency','agency_user','agency_review'],['confirmScopeMutualAgreement','diet_nodal_officer','agency_accepted'],
    ['startArchitectureReview','architecture_user','sent_to_architecture'],['requestArchitectureScopeRevision','architecture_user','architecture_review'],
    ['requestDrawingRevision','diet_nodal_officer','diet_drawing_review'],['acceptArchitecturalDrawings','diet_nodal_officer','diet_drawing_review'],['submitDrawingsToScert','diet_nodal_officer','diet_drawing_accepted'],
    ['startScertDrawingReview','scert_admin','submitted_to_scert_for_drawing_approval'],['returnScertDrawingRevision','scert_admin','scert_drawing_review'],['approveArchitecturalDrawings','scert_admin','scert_drawing_review'],['releaseScopeToAgency','scert_admin','architectural_drawings_approved'],
  ]) test(`Phase ${n}: ${fn} blocked`,async()=>{const h=harness(n,role,status);await assert.rejects(h.service[fn]('s','Comment'),/Phase III/);assert.equal(h.writes(),0);});
  test(`Phase ${n}: historical work package submission needs no Scope`,async()=>{const h=harness(n,'agency_user');await h.packages.sendWorkPackageToDiet('w');assert.equal(h.writes(),2);});
}
test('Phase III Scope create and Architecture review remain available',async()=>{
  const h=harness(3);await h.service.createScopeOfWork(input);assert.equal(h.writes(),2);
  const architecture=harness(3,'architecture_user','sent_to_architecture');await architecture.service.startArchitectureReview('s');assert.equal(architecture.writes(),2);
});
test('Phase III work package still requires released Scope',async()=>{const h=harness(3,'agency_user');await assert.rejects(h.packages.sendWorkPackageToDiet('w'),/released Scope/);});
test('mixed projects filter historical records using master phase instead of record phase',async()=>{
  const h=harness(2);h.records['diets/new']={phaseId:'phase_4'};
  assert.deepEqual(await h.phaseService.filterScopeProjects([{id:'old',dietId:'d',phaseSequence:3},{id:'new',dietId:'new',phaseSequence:1}]),[{id:'new',dietId:'new',phaseSequence:1}]);
});
const nullModule = new Proxy({}, {get:()=>()=>null});
const router = { NavLink:({to,children})=>React.createElement('a',{href:to},children),Link:({to,children})=>React.createElement('a',{href:to},children),Routes:()=>null,Route:()=>null,Navigate:({to})=>React.createElement('span',{'data-redirect':to}),useParams:()=>({}),useSearchParams:()=>[new URLSearchParams()] };
function hooks(states={}) {let index=0;return {...React,useEffect:()=>{},useMemo:fn=>fn(),useState:initial=>[index in states?states[index++]:((index++),typeof initial==='function'?initial():initial),()=>{}]};}
function availability(sequences,contextDietId='',global=false) {
  const accessScope={accessType:global?'global':'agency'};
  const module=load('src/contexts/ScopePhaseContext.tsx',{
    react:hooks({0:{owner:accessScope,diets:sequences.map((n,i)=>({id:`d${i}`,phaseSequence:n})),loading:false,error:''}}),
    'react-router-dom':{matchPath:()=>null,useLocation:()=>({pathname:'/scopes',search:contextDietId?`?dietId=${contextDietId}`:''})},
    './AuthContext':{useAuth:()=>({accessScope})},'../services/accessScopeService':{},'../services/scopePhaseService':{},'../constants/projectPhases':phase,
  });
  return module.ScopePhaseProvider({children:null}).props.value;
}
for(const role of ['diet_nodal_officer','agency_user','architecture_user','scert_admin'])for(const n of [1,2,3])test(`${role} Phase ${n}: rendered navigation and Scope route`,()=>{
  const state=availability([n],'d0',role==='scert_admin');
  const deps={'react-router-dom':router,'./contexts/AuthContext':{useAuth:()=>({profile:{systemRole:role},firebaseUser:{email:'test'}})},'./contexts/ScopePhaseContext':{useScopePhases:()=>state}};
  const source=fs.readFileSync('src/App.tsx','utf8');for(const name of [...source.matchAll(/from "(\.\/[^\"]+)"/g)].map(x=>x[1]))if(!(name in deps))deps[name]=nullModule;
  const app=load('src/App.tsx',deps,s=>s.replace('function PortalLayout()', 'export function PortalLayout()'));
  const html=renderToStaticMarkup(React.createElement(app.PortalLayout));assert.equal(html.includes('Scope of Work'),n>=3);assert.equal(html.includes('Scope Reviews'),n>=3&&role==='scert_admin');
  const pageDeps={react:hooks(),'react-router-dom':router,'../contexts/AuthContext':{useAuth:()=>({profile:{systemRole:role,assignedDietIds:['d0']}})},'../contexts/ScopePhaseContext':{useScopePhases:()=>state}};
  const pageSource=fs.readFileSync('src/pages/ScopesPage.tsx','utf8');for(const name of [...pageSource.matchAll(/from "(\.\.\/[^\"]+)"/g)].map(x=>x[1]))if(!(name in pageDeps))pageDeps[name]=name.endsWith('projectExecution')?{scopeCategoryOptions:[]}:nullModule;
  const page=load('src/pages/ScopesPage.tsx',pageDeps);const rendered=renderToStaticMarkup(React.createElement(page.ScopesPage));assert.equal(rendered.includes('data-redirect'),n<=2);
});
test('mixed Phase II/III account only shows Scope navigation in Phase III context',()=>{
  assert.equal(availability([2,3]).showNavigation,false);assert.equal(availability([2,3],'d0').showNavigation,false);assert.equal(availability([2,3],'d1').showNavigation,true);
});
for(const n of [1,2,3])test(`Phase ${n}: Work Package form renders correct activity and Scope controls`,()=>{
  const deps={react:hooks({1:[{id:'assignment',dietId:'d',status:'active',executingAgencyName:'Agency'}],3:[{id:'d',phaseSequence:n}],13:true,14:{dietId:'d',assignmentId:'assignment',scopeId:'',packageTitle:'',packageDescription:'',workCategory:'',activityAmounts:{},remarks:''},20:[{financial:{id:'f',activityId:'a',activityName:'Eligible activity',agencyAllocation:100},committedAmount:0,availableAmount:100}]}),'react-router-dom':router,'../contexts/AuthContext':{useAuth:()=>({profile:{systemRole:'agency_user'},accessScope:{accessType:'agency'}})},'../constants/projectPhases':phase,'../utils/fundingCalculations':{calculateFundingShare:()=>({centralShare:0,stateShare:0}),getPackageFinancialBasis:()=>0},'../utils/currency':{formatIndianCurrency:String},'../constants/projectExecution':{workCategoryOptions:[],workPackageStatusLabels:{}}};
  const source=fs.readFileSync('src/pages/WorkPackagesPage.tsx','utf8');for(const name of [...source.matchAll(/from "(\.\.\/[^\"]+)"/g)].map(x=>x[1]))if(!(name in deps))deps[name]=nullModule;
  const page=load('src/pages/WorkPackagesPage.tsx',deps);const html=renderToStaticMarkup(React.createElement(page.WorkPackagesPage));assert.equal(html.includes('Released Scope'),n>=3);assert.equal(html.includes('Select an approved Scope first'),n>=3);assert.equal(html.includes('Eligible activity'),n<=2);
});
