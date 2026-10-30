global.window = {}; (function(){ global.navigator = {platform:'Linux'}; global.requestAnimationFrame = (f)=>setTimeout(f,0);
global.localStorage = {getItem:()=>null,setItem:()=>{}};
const fs=require('fs');
const code=['00-util','01-merge','02-store','03-model'].map(f=>fs.readFileSync('src/js/'+f+'.js','utf8')).join('\n');
eval(code + `
global.T = {merge3, mergeList, deq, splitSegs, insertTextAt, wrapMark, normSegs, parText, SyncDoc, makeLocalDB, RT, replaceInPara, buildMatcher, fold, countWords};`);
const assert=require('assert');
const M3=T.merge3, DQ=T.deq;
// paragraphs edited by two people
const base={paras:[{id:'a',segs:[{t:'uno'}]},{id:'b',segs:[{t:'dos'}]},{id:'c',segs:[{t:'tres'}]}], title:'X'};
const local=JSON.parse(JSON.stringify(base)); local.paras[0].segs=[{t:'UNO'}]; local.paras.splice(2,0,{id:'n',segs:[{t:'nuevo local'}]});
const remote=JSON.parse(JSON.stringify(base)); remote.paras[1].segs=[{t:'DOS'}]; remote.title='Y'; remote.paras.splice(2,1);
const m=M3(base,local,remote);
console.log(m.paras.map(p=>p.id+':'+p.segs[0].t).join(' | '), m.title);
assert.deepStrictEqual(m.paras.map(p=>p.id), ['a','b','n']);
assert.strictEqual(m.paras[0].segs[0].t,'UNO'); assert.strictEqual(m.paras[1].segs[0].t,'DOS'); assert.strictEqual(m.title,'Y');
// reorder locally
const l2=JSON.parse(JSON.stringify(base)); l2.paras.reverse(); const r2=JSON.parse(JSON.stringify(base)); r2.paras[0].segs=[{t:'u'}];
const m2=M3(base,l2,r2); console.log(m2.paras.map(p=>p.id+':'+p.segs[0].t).join(' | '));
assert.deepStrictEqual(m2.paras.map(p=>p.id),['c','b','a']); assert.strictEqual(m2.paras[2].segs[0].t,'u');
// remote deletes item that local modified → keep
const l3=JSON.parse(JSON.stringify(base)); l3.paras[2].segs=[{t:'TRES'}]; const r3=JSON.parse(JSON.stringify(base)); r3.paras.pop();
assert.deepStrictEqual(M3(base,l3,r3).paras.map(p=>p.id),['a','b','c']);
// segs
let segs=[{t:'hola '},{m:{id:'m1',text:'mundo',type:'rep'}},{t:' feliz'}];
console.log(JSON.stringify(T.splitSegs(segs,8)));
const p={id:'p',segs:JSON.parse(JSON.stringify(segs))};
assert.strictEqual(T.wrapMark(p,0,4,{id:'m2',type:'ort'}),true); assert.strictEqual(T.wrapMark(p,6,9,{id:'m3'}),false);
console.log(JSON.stringify(p.segs));
const re=T.buildMatcher('MUNDO',{}); const p2={segs:JSON.parse(JSON.stringify(segs))}; console.log(T.replaceInPara(p2,re,{},'planeta'), T.parText(p2));
console.log(T.countWords('Él dijo: «no-sé», ¿y tú? 42 años.'));
// SyncDoc: simulated server with two clients
(async()=>{
  const server={data:null}; const subs=[];
  const mkRef=()=>({id:'d', set: async(d)=>{ await new Promise(r=>setTimeout(r,20)); server.data=JSON.parse(JSON.stringify(d)); subs.forEach(cb=>setTimeout(()=>cb(JSON.parse(JSON.stringify(server.data))),5)); }});
  const A=new T.SyncDoc(mkRef(),null), B=new T.SyncDoc(mkRef(),null);
  subs.push(d=>A.remote(d,{}), d=>B.remote(d,{}));
  T.RT.canWrite=true;
  A.data=JSON.parse(JSON.stringify(base)); A.pending=true; await A.save();
  await new Promise(r=>setTimeout(r,50));
  assert.ok(B.data, 'B received');
  A.update(d=>{d.paras[0].segs=[{t:'A edita uno'}]}); B.update(d=>{d.paras[2].segs=[{t:'B edita tres'}]});
  await new Promise(r=>setTimeout(r,3000));
  console.log('A:', A.data.paras.map(p=>p.segs[0].t).join(' | '));
  console.log('B:', B.data.paras.map(p=>p.segs[0].t).join(' | '));
  console.log('S:', server.data.paras.map(p=>p.segs[0].t).join(' | '));
  assert.ok(DQ(A.data.paras,B.data.paras) && DQ(A.data.paras, server.data.paras));
  assert.strictEqual(server.data.paras[0].segs[0].t,'A edita uno'); assert.strictEqual(server.data.paras[2].segs[0].t,'B edita tres');
  console.log('OK unit');
  process.exit(0);
})();})();
