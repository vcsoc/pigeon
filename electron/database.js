const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { DatabaseSync } = require('node:sqlite');
const libraryCore = require('./library-core');

const TABLES = ['locations', 'assets', 'collections', 'smart_folders'];

function openLibraryDatabase(databaseFile) {
  fs.mkdirSync(path.dirname(databaseFile), { recursive: true });
  const database = new DatabaseSync(databaseFile);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA temp_store = MEMORY;
    CREATE TABLE IF NOT EXISTS library_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS locations (id TEXT PRIMARY KEY, path TEXT, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, location_id TEXT, path TEXT, kind TEXT, modified REAL, content_hash TEXT, deleted_at REAL, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS collections (id TEXT PRIMARY KEY, parent_id TEXT, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS smart_folders (id TEXT PRIMARY KEY, parent_id TEXT, payload TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS assets_location_idx ON assets(location_id);
    CREATE INDEX IF NOT EXISTS assets_path_idx ON assets(path);
    CREATE INDEX IF NOT EXISTS assets_kind_idx ON assets(kind);
    CREATE INDEX IF NOT EXISTS assets_hash_idx ON assets(content_hash) WHERE content_hash IS NOT NULL;
    CREATE INDEX IF NOT EXISTS assets_deleted_idx ON assets(deleted_at) WHERE deleted_at IS NOT NULL;
    CREATE INDEX IF NOT EXISTS collections_parent_idx ON collections(parent_id);
    CREATE INDEX IF NOT EXISTS smart_folders_parent_idx ON smart_folders(parent_id);
  `);
  return database;
}

function rowValues(table, item, payload) {
  if (table === 'assets') return [item.id, item.locationId || null, item.path || null, item.kind || null, Number(item.modified) || null, item.contentHash || null, Number(item.deletedAt) || null, payload];
  if (table === 'locations') return [item.id, item.path || null, payload];
  return [item.id, item.parentId || null, payload];
}

function sqliteString(value){return `'${String(value).replace(/'/g,"''")}'`;}

function removePersistedEmbeddedMetadata(database){const key='embedded-metadata-storage-version',current=database.prepare('SELECT value FROM library_metadata WHERE key=?').get(key)?.value;if(current==='2')return 0;let changed=0;database.exec('BEGIN IMMEDIATE');try{const result=database.prepare(`UPDATE assets SET payload=json_remove(payload,'$.embeddedMetadata','$.embeddedMetadataVersion') WHERE instr(payload,'"embeddedMetadata"')>0`).run();changed=Number(result.changes)||0;database.prepare('INSERT INTO library_metadata(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,'2');database.exec('COMMIT');}catch(error){try{database.exec('ROLLBACK');}catch{}throw error;}database.exec('PRAGMA wal_checkpoint(TRUNCATE)');return changed;}

function createLibraryStore(databaseFile) {
  const database = openLibraryDatabase(databaseFile);
  removePersistedEmbeddedMetadata(database);
  const caches = Object.fromEntries(TABLES.map((table) => [table, new Map(database.prepare(`SELECT id, payload FROM ${table}`).all().map((row) => [row.id, row.payload]))]));
  const statements = {
    metadata: database.prepare('INSERT INTO library_metadata(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'),
    locations: database.prepare('INSERT INTO locations(id,path,payload) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET path=excluded.path,payload=excluded.payload'),
    assets: database.prepare('INSERT INTO assets(id,location_id,path,kind,modified,content_hash,deleted_at,payload) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET location_id=excluded.location_id,path=excluded.path,kind=excluded.kind,modified=excluded.modified,content_hash=excluded.content_hash,deleted_at=excluded.deleted_at,payload=excluded.payload'),
    collections: database.prepare('INSERT INTO collections(id,parent_id,payload) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET parent_id=excluded.parent_id,payload=excluded.payload'),
    smart_folders: database.prepare('INSERT INTO smart_folders(id,parent_id,payload) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET parent_id=excluded.parent_id,payload=excluded.payload'),
    deletes: Object.fromEntries(TABLES.map((table) => [table, database.prepare(`DELETE FROM ${table} WHERE id=?`)]))
  };

  const transaction = (operation) => { database.exec('BEGIN IMMEDIATE'); try { const result=operation(); database.exec('COMMIT'); return result; } catch(error){ try{database.exec('ROLLBACK');}catch{} throw error; } };
  const upsertAssets = (assets = []) => transaction(() => { let changed=0; for(const item of assets){ if(!item?.id)continue;const payload=JSON.stringify(item);if(caches.assets.get(item.id)===payload)continue;statements.assets.run(...rowValues('assets',item,payload));caches.assets.set(item.id,payload);changed+=1;}return changed; });
  const deleteAssets = (ids = []) => transaction(() => { let changed=0;for(const id of new Set(ids)){if(!caches.assets.has(id))continue;statements.deletes.assets.run(id);caches.assets.delete(id);changed+=1;}return changed; });
  const saveBatch = ({ location, assets = [] }) => transaction(() => { let changed=0;if(location){const payload=JSON.stringify(location);if(caches.locations.get(location.id)!==payload){statements.locations.run(...rowValues('locations',location,payload));caches.locations.set(location.id,payload);changed+=1;}}for(const item of assets){const payload=JSON.stringify(item);if(caches.assets.get(item.id)===payload)continue;statements.assets.run(...rowValues('assets',item,payload));caches.assets.set(item.id,payload);changed+=1;}return changed; });

  const saveLibraryMetadata = (input) => {
    const library=libraryCore.migrateLibrary(input),{locations,collections,smartFolders,...metadata}=library;
    delete metadata.assets;
    return transaction(()=>{let changed=0;const metadataPayload=JSON.stringify(metadata);const previousMetadata=database.prepare("SELECT value FROM library_metadata WHERE key='library'").get()?.value;if(previousMetadata!==metadataPayload){statements.metadata.run('library',metadataPayload);changed+=1;}const groups={locations,collections,smart_folders:smartFolders};for(const table of ['locations','collections','smart_folders']){const present=new Set();for(const item of groups[table]){present.add(item.id);const payload=JSON.stringify(item);if(caches[table].get(item.id)===payload)continue;statements[table].run(...rowValues(table,item,payload));caches[table].set(item.id,payload);changed+=1;}for(const id of [...caches[table].keys()])if(!present.has(id)){statements.deletes[table].run(id);caches[table].delete(id);changed+=1;}}return changed;});
  };

  const save = (input) => {
    const library = libraryCore.migrateLibrary(input), { locations, assets, collections, smartFolders, ...metadata } = library;
    database.exec('BEGIN IMMEDIATE');
    try {
    statements.metadata.run('library', JSON.stringify(metadata));
    const groups = { locations, assets, collections, smart_folders: smartFolders };
    for (const table of TABLES) {
      const present = new Set();
      for (const item of groups[table]) {
        present.add(item.id); const payload = JSON.stringify(item);
        if (caches[table].get(item.id) === payload) continue;
        statements[table].run(...rowValues(table, item, payload)); caches[table].set(item.id, payload);
      }
      for (const id of [...caches[table].keys()]) if (!present.has(id)) { statements.deletes[table].run(id); caches[table].delete(id); }
    }
    database.exec('COMMIT'); return library;
    } catch (error) { try { database.exec('ROLLBACK'); } catch {} throw error; }
  };

  function backup(target){ fs.mkdirSync(path.dirname(target),{recursive:true}); try{fs.rmSync(target,{force:true});}catch{} database.exec(`VACUUM INTO ${sqliteString(target)}`); return target; }

  function load({ onSpan = null } = {}) {
    const metadataStarted=performance.now();
    const row = database.prepare("SELECT value FROM library_metadata WHERE key='library'").get();
    if (!row) return null;
    const metadata = JSON.parse(row.value);onSpan?.({name:'sqlite-read-metadata',durationMs:performance.now()-metadataStarted,sourceBytes:row.value.length});
    const read = (table) => {const startedAt=performance.now(),values=[];let sourceBytes=0;for(const item of database.prepare(`SELECT payload FROM ${table} ORDER BY rowid`).iterate()){sourceBytes+=item.payload.length;values.push(JSON.parse(item.payload));}onSpan?.({name:`sqlite-read-${table.replace('_','-')}`,durationMs:performance.now()-startedAt,size:values.length,sourceBytes});return values;};
    const migrateStarted=performance.now(),library=libraryCore.migrateLibrary({ ...metadata, locations: read('locations'), assets: read('assets'), collections: read('collections'), smartFolders: read('smart_folders') });onSpan?.({name:'sqlite-migrate-library',durationMs:performance.now()-migrateStarted,size:library.assets.length});return library;
  }
  return { database, load, save, saveBatch, upsertAssets, deleteAssets, saveLibraryMetadata, backup, close: () => database.close() };
}

function importLegacyJson(store, legacyJsonFile) {
  if (!legacyJsonFile || !fs.existsSync(legacyJsonFile)) return null;
  const library = libraryCore.migrateLibrary(JSON.parse(fs.readFileSync(legacyJsonFile, 'utf8')));
  store.save(library);
  const archived = `${legacyJsonFile}.migrated`;
  try { fs.renameSync(legacyJsonFile, archived); } catch { /* Preserve the source if it cannot be archived. */ }
  return library;
}

module.exports = { openLibraryDatabase, createLibraryStore, importLegacyJson, removePersistedEmbeddedMetadata };
