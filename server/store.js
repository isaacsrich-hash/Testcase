// Shared query interface for local SQLite and Netlify's managed Postgres.
export const sqliteSchema = `
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,token TEXT UNIQUE,name TEXT,country TEXT,family TEXT);
CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY,title TEXT,family TEXT,host TEXT,practice INTEGER,code TEXT UNIQUE,state TEXT,version INTEGER DEFAULT 0,created TEXT);
CREATE TABLE IF NOT EXISTS members(room TEXT,"user" TEXT,PRIMARY KEY(room,"user"));
CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT,room TEXT,"user" TEXT,name TEXT,body TEXT,created TEXT);
CREATE INDEX IF NOT EXISTS members_user ON members("user");
CREATE INDEX IF NOT EXISTS rooms_family ON rooms(family);
CREATE INDEX IF NOT EXISTS messages_room ON messages(room,id);
`;
export async function createSqliteStore(directory = process.env.DATA_DIR || 'data') {
 const [{DatabaseSync},{mkdirSync},{resolve}] = await Promise.all([import('node:sqlite'),import('node:fs'),import('node:path')]);
 mkdirSync(directory,{recursive:true});
 const db = new DatabaseSync(resolve(directory,'kindred.sqlite'));
 db.exec(sqliteSchema);
 const sql = q=>q.replace(/\s+FOR UPDATE\s*$/i,'');
 const queries={
  get:async(q,...p)=>db.prepare(sql(q)).get(...p),
  all:async(q,...p)=>db.prepare(sql(q)).all(...p),
  run:async(q,...p)=>db.prepare(sql(q)).run(...p),
 };
 // One local connection must not interleave transactions at await boundaries.
 let tail=Promise.resolve();
 return {
  async transaction(fn){let unlock;const prior=tail;tail=new Promise(resolve=>{unlock=resolve;});await prior;
   try {db.exec('BEGIN');const result=await fn(queries);db.exec('COMMIT');return result;}
   catch(e){if(db.isTransaction)db.exec('ROLLBACK');throw e;}finally{unlock();}
  },
  close(){db.close();}
 };
}
export function createPostgresStore(pool) {
 const sql=q=>{let i=0;return q.replace(/\?/g,()=>'$'+ ++i);};
 return {
  async transaction(fn){
   const client=await pool.connect();
   const query=async(q,p)=>(await client.query(sql(q),p)).rows;
   const queries={get:async(q,...p)=>(await query(q,p))[0],all:async(q,...p)=>query(q,p),run:async(q,...p)=>query(q,p)};
   try{await client.query('BEGIN');const result=await fn(queries);await client.query('COMMIT');return result;}
   catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  },
 };
}
