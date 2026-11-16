import {searchXiachufang} from '@/lib/kitchen/online-search';
import {recipeSearchKey} from '@/lib/kitchen/search-context';
import {recipeApiGate,recipeApiInput,json} from '@/lib/kitchen/search-api';
import {searchOpenRecipes} from '@/lib/kitchen/open-recipes';

export const dynamic='force-dynamic';
const cache=new Map<string,{until:number;result:Awaited<ReturnType<typeof searchXiachufang>>}>();
export async function POST(request:Request){
 const denied=recipeApiGate(request);if(denied)return denied;
 try{
  const {query,source='HowToCook'}=await recipeApiInput(request);
  if(!['HowToCook','xiachufang'].includes(String(source)))return json({message:'请选择支持的菜谱来源。'},400);
  if(typeof query!=='string'||query.trim().length<2||query.trim().length>40||/[\x00-\x1f<>]|https?:\/\//i.test(query))return json({message:'请输入 2–40 字的菜名。'},400);
  const key=recipeSearchKey(),q=query.normalize('NFKC').trim(),cacheKey=source+':'+q;
  const previous=cache.get(cacheKey);if(previous&&previous.until>Date.now())return json({...previous.result,message:previous.result.message+'（十分钟内检索缓存）'});
  const result=source==='HowToCook'?await searchOpenRecipes(q):await searchXiachufang(q,{apiKey:key});
  if(result.status==='ok'){if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(cacheKey,{until:Date.now()+600000,result});}
  return json(result);
 }catch{return json({message:'查询未完成，请稍后再试。'},400);}
}
