/** Request limits for the anonymous recipe-search endpoint. No visitor data is persisted. */
const visitors=new Map<string,{count:number;until:number}>();
let total={count:0,until:0};
export function recipeApiGate(request:Request,now=Date.now()):Response|null{
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return json({message:'请从掌勺页面发起查询。'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({message:'请发送 JSON 查询。'},415);
 if(Number(request.headers.get('content-length')||0)>2048)return json({message:'查询内容过长。'},413);
 if(total.until<=now)total={count:0,until:now+60000};
 const ip=request.headers.get('cf-connecting-ip')||'anonymous';
 if(visitors.size>=1000)for(const [key,value]of visitors)if(value.until<=now)visitors.delete(key);
 const record=visitors.get(ip);const next=record&&record.until>now?record:{count:0,until:now+60000};
 if(next.count>=8||total.count>=60||(!visitors.has(ip)&&visitors.size>=1000))return json({message:'查询较频繁，请一分钟后再试。'},429,{'Retry-After':'60'});
 next.count++;total.count++;visitors.set(ip,next);return null;
}
export const json=(value:unknown,status=200,headers:Record<string,string>={})=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...headers}});
export async function recipeApiInput(request:Request):Promise<Record<string,unknown>>{
 const reader=request.body?.getReader();if(!reader)throw new Error('查询为空。');
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048){await reader.cancel();throw new Error('查询内容过长。');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const value=JSON.parse(new TextDecoder().decode(bytes));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('查询格式有误。');return value;
}
