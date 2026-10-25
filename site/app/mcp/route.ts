import { env } from 'cloudflare:workers';
import {readState,mutate} from '../../lib/watch-store';
import {beginRun,finishRun,requestRun} from '../../lib/watch-domain.mjs';
export const dynamic='force-dynamic';
const tools=[
 {name:'watch_cache_thumbnail',description:'Store a public Marriott hotel image in private R2. Stops on HTTP denial; no redirects or non-Marriott sources.',inputSchema:{type:'object',required:['url'],properties:{url:{type:'string'}}}},
 {name:'watch_snapshot',description:'Read criteria, pending requests, runs, listings, commute cache, and operational limitations.',inputSchema:{type:'object',properties:{}}},
 {name:'watch_request_check',description:'Queue one deduplicated check. This alone does not start a browser worker.',inputSchema:{type:'object',properties:{}}},
 {name:'watch_begin_run',description:'Claim a pending check or start a scheduled check. Returns active criteria, exact date windows, claim token, and rate policy.',inputSchema:{type:'object',properties:{runId:{type:'string'}}}},
 {name:'watch_finish_run',description:'Commit complete verified per-criteria results, or record blocked/error without removing previous listings. See RUNBOOK.md for evidence fields.',inputSchema:{type:'object',required:['runId','claim','perCriteria'],properties:{runId:{type:'string'},claim:{type:'string'},label:{type:'string'},perCriteria:{type:'object',additionalProperties:{type:'object'}}}}},
 {name:'watch_configure_schedule',description:'Save confirmed scheduling metadata. Never marks an untested worker operational.',inputSchema:{type:'object',required:['enabled'],properties:{enabled:{type:'boolean'},taskId:{type:'string'},taskUrl:{type:'string'},notice:{type:'string'}}}},
 {name:'watch_cache_commute',description:'Save Google Maps evidence keyed by hotel, destination, mode, arrival time, and weekday policy.',inputSchema:{type:'object',required:['key','evidence'],properties:{key:{type:'string'},evidence:{type:'object'}}}}
];
export async function POST(request:Request){let rpc:any;try{const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Cross-origin changes are not allowed.'},{status:403});const raw=await request.text();if(raw.length>900000)throw new Error('Request too large.');rpc=JSON.parse(raw);let result:any;
 if(rpc.method==='server/discover')result={supportedVersions:['2026-07-28'],capabilities:{tools:{}}};
 else if(rpc.method==='initialize')result={protocolVersion:'2026-07-28',capabilities:{tools:{}},serverInfo:{name:'mmp-rate-watch',version:'1.0.0'}};
 else if(rpc.method?.startsWith('notifications/'))return new Response(null,{status:202});
 else if(rpc.method==='tools/list')result={tools};
 else if(rpc.method==='tools/call'){
  const {name,arguments:a={}}=rpc.params||{};let value:any;
  if(name==='watch_snapshot')value=(await readState()).data;
  else if(name==='watch_cache_thumbnail'){
   const u=new URL(a.url);if(u.protocol!=='https:'||!(u.hostname==='marriott.com'||u.hostname.endsWith('.marriott.com'))||u.port||u.username||u.password)throw new Error('Only public Marriott image URLs are allowed.');
   if(!env.BUCKET)throw new Error('Image storage is unavailable.');
   const key=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(u.href)))).map(x=>x.toString(16).padStart(2,'0')).join('');
   if(!await env.BUCKET.head(key)){
    const response=await fetch(u.href,{redirect:'manual'});if(!response.ok)throw new Error('Marriott image request failed with HTTP '+response.status+'; do not work around source restrictions.');
    const type=response.headers.get('content-type')?.split(';')[0]||'';if(!['image/jpeg','image/png','image/webp'].includes(type))throw new Error('A JPEG, PNG, or WebP image is required.');
    if(Number(response.headers.get('content-length'))>8000000)throw new Error('Image too large.');
    const bytes=await response.arrayBuffer();if(bytes.byteLength>8000000)throw new Error('Image too large.');await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:type}});
   }
   value={thumb:'/api/images/'+key};
  }
  else value=await mutate(s=>{switch(name){
   case 'watch_request_check':return requestRun(s);
   case 'watch_begin_run':return beginRun(s,a.runId);
   case 'watch_finish_run':return finishRun(s,a);
   case 'watch_configure_schedule':{if(a.taskUrl){const u=new URL(a.taskUrl);if(u.protocol!=='https:'||!['chatgpt.com','chat.openai.com'].includes(u.hostname))throw new Error('Use the actual hosted task URL.');}s.config.main.schedule={...s.config.main.schedule,enabled:!!a.enabled,taskId:a.taskId||null,taskUrl:a.taskUrl||null};if(a.notice)s.config.main.notice=String(a.notice).slice(0,2000);return s.config.main;}
   case 'watch_cache_commute':if(typeof a.key!=='string'||!a.evidence||!a.evidence.mapsUrl)throw new Error('Commute evidence required.');s.commute[a.key]=a.evidence;return {saved:true};
   default:throw new Error('Unknown tool.');
  }});
  result={content:[{type:'text',text:JSON.stringify(value)}]};
 }else return Response.json({jsonrpc:'2.0',id:rpc.id??null,error:{code:-32601,message:'Method not found'}});
 return Response.json({jsonrpc:'2.0',id:rpc.id??null,result},{headers:{'Cache-Control':'no-store'}});
 }catch(e:any){if(rpc?.method==='tools/call')return Response.json({jsonrpc:'2.0',id:rpc.id??null,result:{isError:true,content:[{type:'text',text:e.message}]}});return Response.json({jsonrpc:'2.0',id:rpc?.id??null,error:{code:-32603,message:e.message}});}}
