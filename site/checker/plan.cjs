// Print exact date windows from a watch_begin_run response, without network I/O.
const fs=require('node:fs');
const input=JSON.parse(fs.readFileSync(0,'utf8'));
for(const [id,c] of Object.entries(input.criteria||{})) console.log(JSON.stringify({id,name:c.name,freeText:c.text,commute:c.commute,price:c.price,windows:c.windows,policy:input.policy}));
