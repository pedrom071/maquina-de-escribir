global.window = {}; global.navigator = {platform:'Linux'}; global.requestAnimationFrame = (f)=>setTimeout(f,0);
global.localStorage = {getItem:()=>null,setItem:()=>{}};
const fs=require('fs');
eval(['00-util','01-merge','02-store','03-model'].map(f=>fs.readFileSync('src/js/'+f+'.js','utf8')).join('\n') + '\nglobal.T={SyncDoc,RT,deq};');
const ROUNDS = +process.argv[2] || 40;
(async()=>{
 let fails = 0;
 for (let round=0; round<ROUNDS; round++){
  const server={data:null, log:[]}; const subs=[];
  const lat=()=>5+Math.random()*60;
  const mkRef=(name)=>({id:'d', set: async(d)=>{ await new Promise(r=>setTimeout(r,lat())); server.data=JSON.parse(JSON.stringify(d)); server.log.push(name+' wrote '+d._v+' pv='+d._pv+' '+JSON.stringify(d.paras.map(p=>p.segs[0].t))); subs.forEach(cb=>setTimeout(()=>cb(JSON.parse(JSON.stringify(server.data))),lat())); }});
  const N=4, P=12;
  const cl=[...Array(N)].map((_,i)=>{ const d=new T.SyncDoc(mkRef('C'+i),null); d.trace=[]; return d; });
  cl.forEach((c,i)=>subs.push(d=>{ c._log=(c._log||[]); c._log.push('recv '+d._v+' pv='+d._pv); c.remote(d,{}); }));
  T.RT.canWrite=true;
  cl[0].data={paras:[...Array(P)].map((_,i)=>({id:'p'+i,segs:[{t:'orig'+i}]}))}; cl[0].pending=true; await cl[0].save();
  await new Promise(r=>setTimeout(r,300));
  const lastVal={};
  const jobs=[];
  for (let c=0;c<N;c++) for (let k=0;k<6;k++){
    const pi = c + N*Math.floor(Math.random()*(P/N)); const val='c'+c+'-'+k;
    jobs.push(new Promise(r=>setTimeout(()=>{ cl[c].update(d=>{ const p=d.paras.find(x=>x.id==='p'+pi); p.segs=[{t:val}]; }); lastVal['p'+pi]=val; r(); }, Math.random()*1200)));
  }
  jobs.push(new Promise(r=>setTimeout(()=>{ cl[1].update(d=>{ d.paras.splice(3,0,{id:'nuevo',segs:[{t:'añadido'}]}); }); r(); }, Math.random()*1200)));
  jobs.push(new Promise(r=>setTimeout(()=>{ cl[2].update(d=>{ d.paras.push({id:'fin',segs:[{t:'final'}]}); }); r(); }, Math.random()*1200)));
  await Promise.all(jobs);
  await new Promise(r=>setTimeout(r,5000));
  const bad=[];
  for (const p of server.data.paras){ if (lastVal[p.id] && p.segs[0].t!==lastVal[p.id]) bad.push(p.id+': got '+p.segs[0].t+' want '+lastVal[p.id]); }
  if (!server.data.paras.some(p=>p.id==='nuevo')) bad.push('nuevo perdido');
  if (!server.data.paras.some(p=>p.id==='fin')) bad.push('fin perdido');
  const conv = cl.every(c=>JSON.stringify(c.data.paras)===JSON.stringify(server.data.paras));
  if (bad.length || !conv) { fails++; if (fails===1) { console.log('FAIL round',round,'conv',conv,bad); console.log(server.log.slice(-25).join('\n')); cl.forEach((c,i)=>console.log('C'+i, c.trace.slice(-8).join('\n   '))); } }
 }
 console.log('fails', fails, 'of', ROUNDS); process.exit(0);
})();
