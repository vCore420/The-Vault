/*
 * save.js
 * SaveManager — persistence through the browser's own IndexedDB (localStorage fallback), independent of any host platform.
 * No dependencies (uses the browser's IndexedDB / localStorage APIs directly).
 */
// Saves through the browser's own IndexedDB — this is a normal web page
// persistence mechanism that works the same whether the game is opened
// inside Claude, downloaded and opened directly, or hosted anywhere else.
// localStorage is used only as a fallback if IndexedDB is unavailable.
class SaveManager{
  constructor(){
    this.dbName = 'the-vault-db';
    this.storeName = 'saves';
    this.key = 'the-vault-save-v1';
    this.getStateFn = null;
    this._dbPromise = this._openDb();
  }

  _openDb(){
    return new Promise(resolve => {
      if(typeof indexedDB === 'undefined'){ resolve(null); return; }
      try{
        const req = indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if(!db.objectStoreNames.contains(this.storeName)) db.createObjectStore(this.storeName);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      }catch(e){ resolve(null); }
    });
  }

  async load(){
    try{
      const db = await this._dbPromise;
      if(db){
        const fromDb = await new Promise(resolve => {
          try{
            const tx = db.transaction(this.storeName, 'readonly');
            const req = tx.objectStore(this.storeName).get(this.key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
          }catch(e){ resolve(null); }
        });
        if(fromDb && typeof fromDb.seed === 'number') return fromDb;
      }
    }catch(e){ /* fall through to localStorage */ }
    return this._loadLocalStorage();
  }

  async persist(){
    if(!this.getStateFn) return;
    const state = this.getStateFn();
    try{
      const db = await this._dbPromise;
      if(db){
        await new Promise(resolve => {
          try{
            const tx = db.transaction(this.storeName, 'readwrite');
            tx.objectStore(this.storeName).put(state, this.key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          }catch(e){ resolve(); }
        });
        return;
      }
    }catch(e){ /* fall through to localStorage */ }
    this._persistLocalStorage(state);
  }

  async clear(){
    try{
      const db = await this._dbPromise;
      if(db){
        await new Promise(resolve => {
          try{
            const tx = db.transaction(this.storeName, 'readwrite');
            tx.objectStore(this.storeName).delete(this.key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          }catch(e){ resolve(); }
        });
      }
    }catch(e){ /* ignore */ }
    try{ if(typeof localStorage !== 'undefined') localStorage.removeItem(this.key); }catch(e){ /* ignore */ }
  }

  _loadLocalStorage(){
    try{
      if(typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(this.key);
      if(!raw) return null;
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed.seed === 'number') ? parsed : null;
    }catch(e){ return null; }
  }

  _persistLocalStorage(state){
    try{
      if(typeof localStorage === 'undefined') return;
      localStorage.setItem(this.key, JSON.stringify(state));
    }catch(e){ /* storage full or unavailable — saving is best-effort */ }
  }
}
