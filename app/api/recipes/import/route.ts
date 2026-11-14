import {fetchXiachufangRecipe} from '@/lib/kitchen/online-search';
import {recipeApiGate,recipeApiInput,json} from '@/lib/kitchen/search-api';

export const dynamic='force-dynamic';
export async function POST(request:Request){
 const denied=recipeApiGate(request);if(denied)return denied;
 try{const {url}=await recipeApiInput(request);if(typeof url!=='string'||url.length>160)return json({message:'请填写下厨房菜谱原页地址。'},400);return json(await fetchXiachufangRecipe(url));}
 catch{return json({message:'原页暂时无法读取，可以打开原文后手动整理。'},400);}
}
