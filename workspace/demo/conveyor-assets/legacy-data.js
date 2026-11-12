/* Compatibility for earlier saved graph data. No widget or map UI. */
'use strict';
(()=>{
  const kinds = ['cause','meaning','goal','task'];
  const blank = () => ({version:1,drafts:[],links:[]});
  const ref = (kind,id) => kind+':'+id;
  const split = key => [key.slice(0,key.indexOf(':')),key.slice(key.indexOf(':')+1)];
  const object = x => x && typeof x==='object' && !Array.isArray(x);
  const idOK = x => typeof x==='string' && x.length>0 && x.length<=2048;
  const refOK = x => idOK(x) && ['block','meaning','goal','task','draft'].includes(split(x)[0]) && !!split(x)[1];
  function validate(data) {
    if (data.strategy===undefined) data.strategy=blank();
    const s=data.strategy, bad=()=>{throw new Error('Повреждены данные прежней версии.');};
    if(!object(s)||s.version!==1||!Array.isArray(s.drafts)||!Array.isArray(s.links)||s.drafts.length>2000||s.links.length>10000)bad();
    const ids=new Set(), actuals=new Set(), byId=new Map();
    for(const n of s.drafts){
      if(!object(n)||!idOK(n.id)||ids.has(n.id)||!kinds.includes(n.kind)||typeof n.name!=='string'||!n.name.trim()||n.name.length>120||typeof n.description!=='string'||n.description.length>2000||(n.blockId!==null&&!idOK(n.blockId))||!['all','any'].includes(n.reqMode))bad();
      if(n.actual!==null){
        if(!object(n.actual)||!['goal','task'].includes(n.kind)||n.actual.kind!==n.kind||!idOK(n.actual.id)||actuals.has(ref(n.actual.kind,n.actual.id)))bad();
        actuals.add(ref(n.actual.kind,n.actual.id));
      }
      ids.add(n.id);byId.set(n.id,n);
    }
    ids.clear();const pairs=new Set(), adj=new Map();
    const aliases=new Map(s.drafts.filter(d=>d.actual).map(d=>[ref(d.actual.kind,d.actual.id),ref("draft",d.id)]));
    const canonical=k=>aliases.get(k)||k;
    for(const e of s.links){
      if(!object(e)||!idOK(e.id)||ids.has(e.id)||!refOK(e.from)||!refOK(e.to)||e.from===e.to||!['related','helpful','required'].includes(e.kind))bad();
      for(const k of [e.from,e.to])if(split(k)[0]==='draft'&&!byId.has(split(k)[1]))bad();
      if(canonical(e.from)===canonical(e.to))bad();
      const pair=JSON.stringify([canonical(e.from),canonical(e.to)]);if(pairs.has(pair))bad();pairs.add(pair);ids.add(e.id);
      if(e.kind==='required'){
        const [fk,fi]=split(e.from),[tk,ti]=split(e.to);
        if(!['task','goal','draft'].includes(fk)||(fk==='draft'&&!['goal','task'].includes(byId.get(fi).kind))||tk!=='draft'||!['goal','task'].includes(byId.get(ti).kind))bad();
        const a=canonical(e.from),b=canonical(e.to);if(!adj.has(a))adj.set(a,[]);adj.get(a).push(b);
      }
    }
    // Iterative topological check: no recursion limit, including imported graphs.
    const indegree=new Map();for(const [a,bs]of adj){if(!indegree.has(a))indegree.set(a,0);for(const b of bs)indegree.set(b,(indegree.get(b)||0)+1);}
    const queue=[...indegree].filter(([,d])=>!d).map(([a])=>a);let count=0;
    for(let i=0;i<queue.length;i++){count++;for(const b of adj.get(queue[i])||[]){indegree.set(b,indegree.get(b)-1);if(!indegree.get(b))queue.push(b);}}
    if(count!==indegree.size)throw new Error('Условия образуют замкнутый круг. Удали одну из обязательных связей.');
    return s;
  }
  globalThis.LifeGameLegacyData={blank,validate};
})();
