// Mechanical public-site observations. No login, booking, private API, retries,
// stealth, alternate identity, or challenge solving. An agent must independently
// verify complete candidate evidence before watch_finish_run accepts listings.
class SourceBlocked extends Error {constructor(message){super(message);this.blocked=true;}}
async function guard(page,response){
 const text=await page.locator('body').innerText();
 if([401,403,429].includes(response?.status())||/access denied|errors\.edgesuite\.net|unusual traffic|verify you are human|captcha/i.test(text)||/\/sorry\//.test(page.url()))throw new SourceBlocked(`Source restriction at ${new URL(page.url()).hostname}; stop without retry or workaround.`);
 return text;
}
function bookingUrl(hotelCode,w){const p=new URLSearchParams({propertyCode:hotelCode,isSearch:'true',fromDate:`${w.checkIn.slice(5,7)}/${w.checkIn.slice(8,10)}/${w.checkIn.slice(0,4)}`,toDate:`${w.checkOut.slice(5,7)}/${w.checkOut.slice(8,10)}/${w.checkOut.slice(0,4)}`,clusterCode:'corp',corporateCode:'MMP',numAdultsPerRoom:'1',roomCount:'1'});return 'https://www.marriott.com/search/availabilityCalendar.mi?'+p;}
async function observeHotel(page,hotelCode,w){
 const url=bookingUrl(hotelCode,w);const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});await guard(page,response);
 await page.getByRole('heading',{name:'Select a Room and Rate',exact:false}).waitFor({timeout:20000});
 const button=page.getByTestId('rate-button').first();if(await button.count())await button.click();
 const text=await guard(page);const rates=await page.getByRole('heading',{level:4}).allTextContents();
 const rate=page.getByRole('listitem').filter({hasText:'Explore'}).first();let details=null;
 if(await rate.count()){
  const control=rate.getByTestId('rate-modal');if(await control.count()){
   await control.click();details=await page.getByRole('heading',{name:'Rate Details',exact:true}).locator('..').innerText().catch(()=>null);
   // The modal's full text is public; record it without proceeding to Select.
   const modal=page.locator('[aria-label="dialogTitle"][aria-describedby="rateDetailsContent"]:visible');if(await modal.count())details=await modal.innerText();
   const close=page.getByRole('button',{name:/Close/,exact:false});if(await close.count())await close.last().click();
  }
 }
 const checkbox=page.getByRole('checkbox',{name:'Show with taxes and fees',exact:true});
 if(await checkbox.count()&&!await checkbox.isChecked())await checkbox.check().catch(async()=>{await page.getByText('Show with taxes and fees',{exact:true}).click();});
 const totalText=await guard(page);
 return {hotelCode,window:w,bookingUrl:url,observedAt:new Date().toISOString(),rates,rateDetails:details,textBeforeTaxesToggle:text,textIncludingTaxes:totalText,exactTotalVerified:false,independentVerificationRequired:true};
}
async function observeWindow(page,criteria,w){
 const p=new URLSearchParams({fromDate:`${w.checkIn.slice(5,7)}/${w.checkIn.slice(8,10)}/${w.checkIn.slice(0,4)}`,toDate:`${w.checkOut.slice(5,7)}/${w.checkOut.slice(8,10)}/${w.checkOut.slice(0,4)}`,clusterCode:'corp',corporateCode:'MMP','destinationAddress.destination':criteria.commute?.destination||'New York, NY',roomCount:'1',numAdultsPerRoom:'1',isSearch:'true',isInternalSearch:'true',searchType:'InCity'});
 const response=await page.goto('https://www.marriott.com/search/findHotels.mi?'+p,{waitUntil:'domcontentloaded',timeout:45000});await guard(page,response);
 await page.locator('a[href*="availabilityCalendar.mi?propertyCode="]').first().waitFor({timeout:25000});
 const text=await guard(page);const codes=await page.locator('a[href*="availabilityCalendar.mi?propertyCode="]').evaluateAll(links=>[...new Set(links.map(a=>new URL(a.href).searchParams.get('propertyCode')).filter(Boolean))]);
 return {window:w,hotelCodes:codes,searchText:text,allPagesVerified:false,allGeographiesChecked:false};
}
module.exports={observeWindow,observeHotel,bookingUrl,guard,SourceBlocked};
