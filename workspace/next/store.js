import {createState,evolve,validate,exportState,importState,dayKey} from './domain.js';
export const STORAGE_KEY='lifegame-next-v1';
export const BACKUP_KEY='lifegame-next-last-good-v1';

export class Store {
  constructor(storage,clock=()=>new Date()) {
    try{this.storage=storage??globalThis.localStorage;}catch(e){this.storage={getItem(){throw e;},setItem(){throw e;}};}
    this.clock=clock;this.state=createState(clock());this.snapshot=null;this.error=null;this.listeners=new Set();this.queue=Promise.resolve();
  }
  async lock(fn){return typeof window!=='undefined'&&globalThis.navigator?.locks?globalThis.navigator.locks.request(STORAGE_KEY,fn):fn();}
  async init(){
    await this.lock(()=>{
      try {
        const raw=this.storage.getItem(STORAGE_KEY);
        if(raw){this.snapshot=raw;this.state=validate(JSON.parse(raw));}
        else {const raw=JSON.stringify(this.state);this.storage.setItem(STORAGE_KEY,raw);this.snapshot=raw;}
      } catch(e){this.error='Не удалось прочитать или сохранить данные. '+e.message;}
    });
    if(!this.error&&(this.state.lastDay!==dayKey(this.clock())||!this.state.days[dayKey(this.clock())]))try{await this.dispatch('tick');}catch(e){this.error=e.message;}
    return this;
  }
  subscribe(fn){this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
  notify(){for(const fn of this.listeners)fn(this.state);}
  dispatch(type,values={},expected=this.state.revision){
    const task=()=>this.lock(()=>{
      if(this.error)throw Error(this.error);
      let raw;try{raw=this.storage.getItem(STORAGE_KEY);}catch(e){this.error='Хранилище недоступно. '+e.message;throw Error(this.error);}
      if(raw!==this.snapshot){
        if(raw)try{this.state=validate(JSON.parse(raw));this.snapshot=raw;}catch(e){this.error='Сохранение изменено или повреждено. '+e.message;}
        throw Error(this.error||'Данные изменились в другой вкладке. Откройте запись заново и повторите действие.');
      }
      if(expected!==this.state.revision)throw Error('Экран устарел. Откройте запись заново; последнее изменение сохранено.');
      const next=evolve(this.state,type,values,this.clock()),nextRaw=JSON.stringify(next);
      try{if(this.snapshot)this.storage.setItem(BACKUP_KEY,this.snapshot);this.storage.setItem(STORAGE_KEY,nextRaw);}catch(e){throw Error('Изменение не сохранено. Освободите место или восстановите доступ к хранилищу. '+e.message);}
      this.state=next;this.snapshot=nextRaw;this.notify();return next;
    });
    const pending=this.queue.then(task,task);this.queue=pending.catch(()=>{});return pending;
  }
  async replace(value,expected=this.state.revision){
    return this.lock(()=>{
      const raw=this.storage.getItem(STORAGE_KEY);if(raw!==this.snapshot||expected!==this.state.revision)throw Error('Сохранение изменилось. Повторите импорт после обновления страницы.');
      const next=evolve(importState(value),'tick',{},this.clock());next.revision=this.state.revision+1;validate(next);const data=JSON.stringify(next);
      if(raw){let valid=false;try{validate(JSON.parse(raw));valid=true;}catch{}if(valid)this.storage.setItem(BACKUP_KEY,raw);}
      this.storage.setItem(STORAGE_KEY,data);this.state=next;this.snapshot=data;this.error=null;this.notify();return next;
    });
  }
  async reset(){return this.replace(exportState(createState(this.clock())));}
  export(){return exportState(this.state);}
  raw(){return this.snapshot||this.storage.getItem(STORAGE_KEY)||'';}
  reload(){const raw=this.storage.getItem(STORAGE_KEY);if(!raw)throw Error('Сохранение отсутствует.');this.state=validate(JSON.parse(raw));this.snapshot=raw;this.error=null;this.notify();}
  backup(){const raw=this.storage.getItem(BACKUP_KEY);if(!raw)throw Error('Резервная копия ещё не создана.');return exportState(validate(JSON.parse(raw)));}
}
