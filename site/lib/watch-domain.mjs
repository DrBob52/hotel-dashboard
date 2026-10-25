export class WatchError extends Error { constructor(message,status=400){super(message);this.status=status;} }
const fail=(message,status=400)=>{throw new WatchError(message,status);};
const finite=(x)=>typeof x==='number'&&Number.isFinite(x);
const date=(s)=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const iso=()=>new Date().toISOString();
export function localDate(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function windowsFor(c,today=localDate()){
 const d=c.dates;let first=d.mode==='fixed'?d.from:today;let last=d.mode==='fixed'?d.to:new Date(Date.parse(today+'T00:00Z')+d.rollingDays*86400000).toISOString().slice(0,10);const out=[];
 for(let day=first;day<=last;day=new Date(Date.parse(day+'T00:00Z')+86400000).toISOString().slice(0,10)){
  const dow=new Date(day+'T00:00Z').getUTCDay();for(const shape of d.stays.filter(s=>s.dow===dow)){
   const checkOut=new Date(Date.parse(day+'T00:00Z')+shape.nights*86400000).toISOString().slice(0,10);
   if(d.checkoutBy&&checkOut>d.checkoutBy)continue;
   if(d.noFridayNights&&Array.from({length:shape.nights},(_,i)=>(dow+i)%7).includes(5))continue;
   out.push({checkIn:day,checkOut,nights:shape.nights,tier:shape.tier});
  }
 }return out.sort((a,b)=>a.tier-b.tier||a.checkIn.localeCompare(b.checkIn));
}
export function validateCriteria(c){
 if(!c||typeof c.name!=='string'||!c.name.trim()||c.name.length>160)fail('Give the criteria set a name (up to 160 characters).');
 if(typeof c.text!=='string'||c.text.length>20000)fail('Criteria text must be at most 20,000 characters.');
 if(c.commute&&(!c.commute.destination||!finite(c.commute.maxMinutes)||c.commute.maxMinutes<=0||!/^\d{2}:\d{2}$/.test(c.commute.arriveBy)||Number(c.commute.arriveBy.slice(0,2))>23||Number(c.commute.arriveBy.slice(3))>59||c.commute.mode!=='transit'))fail('Enter a destination, positive transit limit, and valid arrival time.');
 if(c.price&&(!finite(c.price.amount)||c.price.amount<=0||!['pretax','total'].includes(c.price.basis)))fail('Enter a positive price cap and tax basis.');
 const d=c.dates;if(!d||!['rolling','fixed'].includes(d.mode))fail('Choose rolling or fixed dates.');
 if(d.mode==='rolling'&&(!Number.isInteger(d.rollingDays)||d.rollingDays<1||d.rollingDays>366))fail('Search between 1 and 366 days ahead.');
 if(d.mode==='fixed'&&(!date(d.from)||!date(d.to)||d.from>d.to||(Date.parse(d.to)-Date.parse(d.from))/86400000>366))fail('Enter a valid check-in range of at most 366 days.');
 if(d.checkoutBy&&!date(d.checkoutBy))fail('Enter a valid latest checkout date.');
 if(!Array.isArray(d.stays)||!d.stays.length||d.stays.length>28||d.stays.some(s=>!Number.isInteger(s.dow)||s.dow<0||s.dow>6||!Number.isInteger(s.nights)||s.nights<1||s.nights>4||![1,2].includes(s.tier)))fail('Select at least one valid preferred or backup stay.');
 return c;
}
export function putCriteria(s,id,data,patch,version){
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))fail('Invalid criteria identifier.');const old=s.criteria[id];
 if(old&&version!==old.version)fail('This set changed elsewhere. Reload it before saving.',409);
 if(!old&&patch)fail('This criteria set was deleted.',409);
 const now=iso(),c=validateCriteria({...old,...data});s.criteria[id]={...c,version:(old?.version||0)+1,createdAt:old?.createdAt||now,updatedAt:now};return {saved:true};
}
export function deleteCriteria(s,id,version){const c=s.criteria[id];if(!c)return {deleted:true};if(version!==c.version)fail('This set changed elsewhere. Reload before deleting.',409);delete s.criteria[id];delete s.checks[id];for(const [key,l]of Object.entries(s.listings))if(l.criteriaId===id)delete s.listings[key];return {deleted:true};}
export function requestRun(s,kind='manual'){
 const now=iso();for(const r of Object.values(s.runs)){
  if(['requested','running'].includes(r.status)&&Date.now()-Date.parse(r.startedAt||r.requestedAt)<45*60000)return {runId:r.id,status:r.status,taskUrl:s.config.main.schedule?.taskUrl||null,deduplicated:true};
  if(['requested','running'].includes(r.status)){r.status='failed';r.error='The worker did not finish within 45 minutes.';r.finishedAt=now;}
 }
 const id=crypto.randomUUID();s.runs[id]={id,kind,status:'requested',requestedAt:now,perCriteria:{},summary:null};return {runId:id,status:'requested',taskUrl:s.config.main.schedule?.taskUrl||null};
}
export function beginRun(s,runId){
 const requested=Object.values(s.runs).filter(r=>r.status==='requested').sort((a,b)=>a.requestedAt.localeCompare(b.requestedAt));
 let r=runId?s.runs[runId]:requested[0];if(!r){const created=requestRun(s,'scheduled');r=s.runs[created.runId];}
 if(r.status!=='requested')fail('This run is already claimed or completed.',409);
 if(Object.values(s.runs).some(x=>x.status==='running'&&Date.now()-Date.parse(x.startedAt)<45*60000))fail('Another check is running.',409);
 r.status='running';r.startedAt=iso();r.claim=crypto.randomUUID();r.criteriaVersions=Object.fromEntries(Object.entries(s.criteria).filter(([,c])=>!c.paused).map(([id,c])=>[id,c.version]));r.localDate=localDate();
 return {runId:r.id,claim:r.claim,criteria:Object.fromEntries(Object.keys(r.criteriaVersions).map(id=>[id,{...s.criteria[id],windows:windowsFor(s.criteria[id],r.localDate)}])),commute:s.commute,policy:s.config.main.ratePolicy};
}
function marriottLink(value,window,hotelCode){let u;try{u=new URL(value);}catch{fail('A Marriott booking link is required.');}if(u.protocol!=='https:'||u.hostname!=='www.marriott.com'||u.pathname!=='/search/availabilityCalendar.mi')fail('Use the verified Marriott property booking format.');const p=u.searchParams,mdy=x=>`${x.slice(5,7)}/${x.slice(8,10)}/${x.slice(0,4)}`;if(p.get('corporateCode')!=='MMP'||p.get('propertyCode')?.toUpperCase()!==hotelCode||p.get('fromDate')!==mdy(window.checkIn)||p.get('toDate')!==mdy(window.checkOut))fail('Booking link dates, hotel, and MMP must match the verified stay.');}
export function validateListing(l,c,today){
 if(!/^[A-Z0-9]{5}$/.test(l.hotelCode||'')||!l.hotelName||!l.address)fail('Hotel code, name, and address are required.');
 if(!/^\/api\/images\/[a-f0-9]{64}$/.test(l.thumb||''))fail('A stored hotel thumbnail is required.');
 const all=[l.main,...(l.others||[])],allowed=windowsFor(c,today);
 for(const w of all){
  if(!w||!allowed.some(a=>a.checkIn===w.checkIn&&a.checkOut===w.checkOut&&a.nights===w.nights&&a.tier===w.tier))fail('Listing dates do not satisfy the criteria.');
  if(!finite(w.nightlyPretax)||w.nightlyPretax<0||!finite(w.total)||w.total<0||!finite(w.nightlyInclTax)||Math.abs(w.nightlyInclTax-w.total/w.nights)>0.011)fail('Exact nightly and full-stay prices are required.');
  if(!w.exactTotalVerified||!w.priceEvidence||!w.rateDetailsText?.includes(w.rateName)||w.fallbackBannerDetected)fail('Exact Marriott total evidence and no fallback banner are required.');
  const combined=w.rateName==='Explore Associate & Friends Rate';
  if(!['Explore Associate Rate','Explore Family Rate'].includes(w.rateName)&&!combined)fail('Unrecognized or ineligible rate name.');
  if(combined&&(!w.associateEvidence||!w.rateDetailsText?.includes(w.associateEvidence)||!/(?:associate[- ](?:only|rate)|explore associate rate)/i.test(w.associateEvidence)))fail('Combined Associate/Friends labels need an explicit Associate-rate statement from Marriott.');
  if(!w.supervisorVerifiedAt||!w.supervisorEvidence||Date.now()-Date.parse(w.supervisorVerifiedAt)>3600000||!Number.isFinite(Date.parse(w.supervisorVerifiedAt))||Date.parse(w.supervisorVerifiedAt)>Date.now()+60000)fail('Independent fresh-link verification is required.');
  const price=c.price&&(c.price.basis==='total'?w.total/w.nights:w.nightlyPretax);if(c.price&&(c.price.comparison==='lt'?price>=c.price.amount:price>c.price.amount))fail('Price cap exceeded.');
  if(!Array.isArray(w.nightly)||w.nightly.length!==w.nights||w.nightly.some((n,i)=>n.date!==new Date(Date.parse(w.checkIn+'T00:00Z')+i*86400000).toISOString().slice(0,10)||!finite(n.amount)||n.amount<0))fail('A verified breakdown for every night is required.');
  if(Math.abs(w.nightly.reduce((a,n)=>a+n.amount,0)/w.nights-w.nightlyPretax)>0.011)fail('Nightly breakdown must match the pretax average.');
  marriottLink(w.bookingUrl,w,l.hotelCode);
 }
 const best=[...all].sort((a,b)=>a.tier-b.tier||a.total-b.total)[0];if(best!==l.main)fail('Main stay must be preferred tier first, then lowest total.');
 if(c.commute){const m=l.commute;let maps;try{maps=new URL(m?.mapsUrl);}catch{fail('Google Maps route evidence is required.');}if(!finite(m.minutes)||m.minutes<=0||(c.commute.comparison==='lte'?m.minutes>c.commute.maxMinutes:m.minutes>=c.commute.maxMinutes)||m.destination!==c.commute.destination||m.mode!=='transit'||m.arriveBy!==c.commute.arriveBy||!m.weekdayVerified||!m.includesWalkingWaitsTransfers||!m.evidence||Date.now()-Date.parse(m.checkedAt)>30*86400000||!Number.isFinite(Date.parse(m.checkedAt))||!['www.google.com','maps.google.com'].includes(maps.hostname)||maps.protocol!=='https:')fail('A current weekday Google Maps transit route, including walks, waits, and transfers, must satisfy the commute rule.');}
 if(!Array.isArray(l.why)||!l.why.length||l.why.some(w=>w.ok!==true||!w.evidence))fail('Each why-it-fits item needs evidence.');
 return l;
}
export function finishRun(s,input){
 const r=s.runs[input.runId];if(!r||r.status!=='running'||input.claim!==r.claim)fail('This run is not owned by this worker.',409);
 const now=iso(),summary={added:0,removed:0,changed:0};let ok=0,bad=0;
 for(const [id,version]of Object.entries(r.criteriaVersions)){
  const c=s.criteria[id],result=input.perCriteria?.[id];
  if(!c||c.paused||c.version!==version){r.perCriteria[id]={status:'superseded',error:'Criteria changed or were paused/deleted during this run.'};bad++;continue;}
  const old=Object.fromEntries(Object.entries(s.listings).filter(([,l])=>l.criteriaId===id));
  if(result?.status==='ok'){
   const windows=windowsFor(c,r.localDate);if(result.allWindowsChecked!==true||result.windowsChecked!==windows.length||result.allGeographiesChecked!==true||result.criteriaTextReviewed!==true||!Array.isArray(result.listings))fail('Successful refresh requires complete windows, geography coverage, and free-text review.');
   const codes=new Set();for(const l of result.listings){validateListing(l,c,r.localDate);if(codes.has(l.hotelCode))fail('Only one listing per hotel is allowed.');codes.add(l.hotelCode);}
   const keys=new Set(result.listings.map(l=>`${id}__${l.hotelCode}`));
   for(const key of Object.keys(old)){if(!keys.has(key))summary.removed++;delete s.listings[key];}
   for(const l of result.listings){const key=`${id}__${l.hotelCode}`,prev=old[key],changed=!!prev&&(prev.main.checkIn!==l.main.checkIn||prev.main.checkOut!==l.main.checkOut);if(!prev)summary.added++;if(changed)summary.changed++;s.listings[key]={...l,criteriaId:id,stale:false,staleSince:null,firstSeenAt:prev?.firstSeenAt||now,lastVerifiedAt:now,badges:{isNew:!prev,datesChanged:changed,previous:changed?{checkIn:prev.main.checkIn,checkOut:prev.main.checkOut}:null}};}
   for(const l of result.listings)for(const w of [l.main,...(l.others||[])])if(!s.config.main.ratePolicy.acceptedExactNames.includes(w.rateName))s.config.main.ratePolicy.acceptedExactNames.push(w.rateName);
   s.checks[id]={criteriaId:id,runId:r.id,status:'ok',lastCheckedAt:now,lastGoodAt:now,label:input.label||'latest check',matchCount:result.listings.length,staysChecked:result.windowsChecked,hotelsChecked:result.hotelsChecked||0};ok++;
  }else{
   for(const l of Object.values(old)){l.stale=true;l.staleSince=l.staleSince||now;}
   s.checks[id]={...s.checks[id],criteriaId:id,runId:r.id,status:result?.status==='blocked'?'blocked':'error',lastCheckedAt:now,lastGoodAt:s.checks[id]?.lastGoodAt||null,error:String(result?.error||'The checker did not return a complete verified result.').slice(0,2000)};bad++;
  }
  r.perCriteria[id]={status:s.checks[id].status,matches:Object.values(s.listings).filter(l=>l.criteriaId===id).length,error:s.checks[id].error||null};
 }
 r.status=bad?(ok?'partial':'failed'):'finished';r.finishedAt=now;r.summary=ok?summary:null;r.durationSeconds=Math.round((Date.parse(now)-Date.parse(r.startedAt))/1000);delete r.claim;
 s.state.current={lastRunId:r.id,lastCheckAt:now,lastStatus:r.status,lastSummary:r.summary};
 for(const [id,run]of Object.entries(s.runs))if(Date.now()-Date.parse(run.requestedAt)>90*86400000)delete s.runs[id];
 return {runId:r.id,status:r.status,summary:r.summary,perCriteria:r.perCriteria};
}
