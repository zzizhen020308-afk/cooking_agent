import {searchXiachufang} from '@/lib/kitchen/online-search';
import {recipeSearchKey} from '@/lib/kitchen/search-context';
import {recipeApiGate,recipeApiInput,json} from '@/lib/kitchen/search-api';

export const dynamic='force-dynamic';
const cache=new Map<string,{until:number;result:Awaited<ReturnType<typeof searchXiachufang>>}>();
export async function POST(request:Request){
 const denied=recipeApiGate(request);if(denied)return denied;
 try{
  const {query}=await recipeApiInput(request);
  if(typeof query!=='string'||query.trim().length<2||query.trim().length>40||/[\x00-\x1f<>]|https?:\/\//i.test(query))return json({message:'请输入 2–40 字的菜名。'},400);
  const key=recipeSearchKey(),q=query.normalize('NFKC').trim();
  const previous=cache.get(q);if(key&&previous&&previous.until>Date.now())return json({...previous.result,message:previous.result.message+'（十分钟内检索缓存）'});
  const result=await searchXiachufang(q,{apiKey:key});
  if(result.status==='ok'){if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(q,{until:Date.now()+600000,result});}
  return json(result);
 }catch{return json({message:'查询未完成，请稍后再试。'},400);}
}
