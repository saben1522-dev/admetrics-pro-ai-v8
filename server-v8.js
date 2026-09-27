const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8787);
const ROOT = __dirname;
const DB_FILE = path.join(ROOT, 'admetrics-v8-db.json');
const HTML_FILE = path.join(ROOT, 'AdMetrics-Pro-AI-V8.html');
const sessions = new Map();

function loadDb(){
  try { return JSON.parse(fs.readFileSync(DB_FILE,'utf8')); }
  catch { return {users:seedUsers(),workspaces:{},audit:[]}; }
}
function saveDb(db){ fs.writeFileSync(DB_FILE, JSON.stringify(db,null,2)); }
function hashPassword(password, salt){ return crypto.pbkdf2Sync(password,salt,120000,32,'sha256').toString('hex'); }
function makeUser(id,role,password='ChangeMe123!'){ const salt=crypto.randomBytes(16).toString('hex'); return {id,role,salt,passwordHash:hashPassword(password,salt)}; }
function seedUsers(){ return [makeUser('owner','owner'),makeUser('admin','admin'),makeUser('marketer','marketer'),makeUser('creator','creator'),makeUser('viewer','viewer')]; }
let db=loadDb();
if(!Array.isArray(db.users)||!db.users.length){db={users:seedUsers(),workspaces:{},audit:[]};saveDb(db);}

function json(res,status,payload){const body=JSON.stringify(payload);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});res.end(body);}
function readBody(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>2e6){reject(new Error('payload too large'));req.destroy();}});req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}});req.on('error',reject)});}
function cookie(req,name){const c=req.headers.cookie||'';const m=c.match(new RegExp('(?:^|; )'+name+'=([^;]+)'));return m?decodeURIComponent(m[1]):null;}
function auth(req){const token=cookie(req,'v8_session');return token?sessions.get(token):null;}
function roleAllowed(user,roles){return user&&roles.includes(user.role);}
function audit(actor,action,detail){db.audit.unshift({at:new Date().toISOString(),actor:actor?.id||'system',role:actor?.role||'system',action,detail});db.audit=db.audit.slice(0,500);saveDb(db);}

const server=http.createServer(async(req,res)=>{
  try{
    if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Credentials':'true'});return res.end();}
    if(req.url==='/api/health'){return json(res,200,{ok:true,version:'8.0',service:'AdMetrics Pro AI V8'});}
    if(req.url==='/api/v8/login'&&req.method==='POST'){
      const b=await readBody(req),u=db.users.find(x=>x.id===String(b.username||''));
      if(!u||hashPassword(String(b.password||''),u.salt)!==u.passwordHash)return json(res,401,{ok:false,error:'Invalid credentials'});
      const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{id:u.id,role:u.role,created:Date.now()});res.writeHead(200,{'Content-Type':'application/json','Set-Cookie':`v8_session=${token}; HttpOnly; SameSite=Lax; Path=/`});return res.end(JSON.stringify({ok:true,user:{id:u.id,role:u.role}}));
    }
    if(req.url==='/api/v8/me') { const u=auth(req); return json(res,200,{authenticated:!!u,user:u||null}); }
    if(req.url==='/api/v8/state'&&req.method==='GET'){const u=auth(req);if(!u)return json(res,401,{error:'Login required'});const w=db.workspaces[u.id]||null;return json(res,200,{state:w});}
    if(req.url==='/api/v8/state'&&req.method==='POST'){const u=auth(req);if(!u)return json(res,401,{error:'Login required'});if(!roleAllowed(u,['owner','admin','marketer']))return json(res,403,{error:'Role not allowed'});const b=await readBody(req);const safe={...b,workspace:{...(b.workspace||{}),role:u.role}};db.workspaces[u.id]=safe;audit(u,'WORKSPACE_SYNC','State saved');return json(res,200,{ok:true,state:safe});}
    if(req.url==='/api/v8/task'&&req.method==='POST'){const u=auth(req);if(!u)return json(res,401,{error:'Login required'});if(!roleAllowed(u,['owner','admin','marketer','creator']))return json(res,403,{error:'Role not allowed'});const b=await readBody(req);const key=u.id;const w=db.workspaces[key]||{workspace:{role:u.role},tasks:[]};w.tasks=Array.isArray(w.tasks)?w.tasks:[];w.tasks.push({...b,id:Date.now(),created:new Date().toISOString(),createdBy:u.id});db.workspaces[key]=w;audit(u,'TASK_CREATED',b.title||'untitled');return json(res,201,{ok:true,task:w.tasks.at(-1)});}
    if(req.url==='/api/v8/audit'&&req.method==='GET'){const u=auth(req);if(!u)return json(res,401,{error:'Login required'});return json(res,200,{audit:db.audit.slice(0,100)});}
    if(req.url==='/api/v8/metrics'&&req.method==='POST'){const u=auth(req);if(!u)return json(res,401,{error:'Login required'});if(!roleAllowed(u,['owner','admin','marketer']))return json(res,403,{error:'Role not allowed'});const b=await readBody(req);const key=u.id;const w=db.workspaces[key]||{workspace:{role:u.role},metrics:[]};w.metrics=Array.isArray(w.metrics)?w.metrics:[];w.metrics.push(...(Array.isArray(b.rows)?b.rows:[]));w.metrics=w.metrics.slice(-10000);db.workspaces[key]=w;audit(u,'METRICS_IMPORTED',String((b.rows||[]).length));return json(res,200,{ok:true,count:(b.rows||[]).length});}
    if(req.method==='GET'&&req.url==='/'){res.writeHead(302,{Location:'/AdMetrics-Pro-AI-V8.html'});return res.end();}
    if(req.method==='GET'&&req.url==='/AdMetrics-Pro-AI-V8.html'){const html=fs.readFileSync(HTML_FILE);res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(html);}
    if(req.method==='GET'&&req.url==='/README-V8.md'){const f=path.join(ROOT,'README-V8.md');if(fs.existsSync(f)){res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'});return res.end(fs.readFileSync(f));}}
    res.writeHead(404,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Not found'}));
  }catch(e){console.error(e);json(res,500,{error:'Internal server error'});}
});
server.listen(PORT,()=>console.log(`AdMetrics Pro AI V8 running at http://localhost:${PORT}`));
