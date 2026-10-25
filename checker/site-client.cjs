// Server-only CLI helper. Keep WATCH_SITE_TOKEN in process memory, never a file.
async function callSite(name,args={}){
 const origin=process.env.WATCH_SITE_ORIGIN,token=process.env.WATCH_SITE_TOKEN;
 if(!origin||!token)throw new Error('WATCH_SITE_ORIGIN and WATCH_SITE_TOKEN are required in the worker environment.');
 const u=new URL(origin);if(u.protocol!=='https:'||!u.hostname.endsWith('.chatgpt.site'))throw new Error('Expected the private Site origin.');
 const response=await fetch(u.origin+'/api/worker',{method:'POST',headers:{'Content-Type':'application/json','OAI-Sites-Authorization':`Bearer ${token}`},body:JSON.stringify({jsonrpc:'2.0',id:crypto.randomUUID(),method:'tools/call',params:{name,arguments:args}})});
 if(!response.ok)throw new Error(`Site writer returned HTTP ${response.status}`);
 const data=await response.json();if(data.error||data.result?.isError)throw new Error(data.error?.message||data.result.content?.[0]?.text||'Site tool failed');
 return JSON.parse(data.result.content[0].text);
}
module.exports={callSite};
