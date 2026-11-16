import test from 'node:test';
import assert from 'node:assert/strict';
import {OPEN_RECIPE_SNAPSHOT,parseOpenRecipeIndex,parseOpenRecipeReadme,parseOpenRecipeMarkdown,planOpenRecipeStep,searchOpenRecipes,fetchOpenRecipe,matchOpenRecipeNames,openRecipeIndexStats} from '../lib/kitchen/open-recipes.ts';

// Facts from the pinned public-domain HowToCook recipe, not a generated replacement recipe.
const path='dishes/meat_dish/蚂蚁上树.md';
const markdown=`# 蚂蚁上树的做法
## 必备原料和工具
- 红薯粉丝
- 猪肉末
## 计算
每次制作前需要确定计划做几份。一份正好够 2 个人吃。
每份：
- 红薯粉丝 80g（干重）
- 猪肉末 150g
- 郫县豆瓣酱 15g
- 生抽 10ml
- 老抽 5ml
- 食用油 10ml
- 蒜末 10g
- 姜末 5g
- 清水 300ml（用于煮粉丝）
## 操作
1. 红薯粉丝提前泡软，泡水时间为 20 分钟，备用
2. 将蒜、姜分别剁碎，备用
3. 锅烧热，加入 10ml 食用油，加入蒜末、姜末炒香
4. 加入猪肉末翻炒至**肉色发白且微微出油**
5. 加入郫县豆瓣酱，炒至**红油析出**
6. 加入生抽和老抽，翻炒均匀
7. 倒入 300ml 清水，煮沸
8. 放入泡软沥干的粉丝，用筷子轻轻拨动防止粘连
9. 中小火煮约 5 分钟，直至粉丝**完全吸收汤汁**、呈现微微收干状态
10. 依据口味可撒入小葱末，关火装盘
## 附加内容
- 可加入 0.5g 白胡椒粉调味，风味更佳
`;
const tree={tree:[{type:'blob',path},{type:'blob',path:'dishes/vegetable_dish/蚂蚁上树加青菜.md'},{type:'blob',path:'tips/unsafe.md'},{type:'tree',path:'dishes/meat_dish/none.md'}]};
const url=`https://github.com/Anduin2017/HowToCook/blob/${OPEN_RECIPE_SNAPSHOT}/${encodeURI(path)}`;
const mock=(impl:(url:string,init?:RequestInit)=>Response|Promise<Response>)=>(async(input:RequestInfo|URL,init?:RequestInit)=>impl(String(input),init)) as typeof fetch;

test('pinned open recipe retains the full calculation, ten source operations, author, license and portions',()=>{
 const recipe=parseOpenRecipeMarkdown(markdown,path,0)!;
 assert.equal(recipe.title,'蚂蚁上树');assert.equal(recipe.baseServings,2);assert.equal(recipe.ingredients.length,9);assert.equal(recipe.steps.length,10);
 assert.deepEqual(recipe.ingredients[0],{name:'红薯粉丝（干重）',quantityText:'80g'});assert.deepEqual(recipe.ingredients.at(-1),{name:'清水',quantityText:'300ml'});
 assert.equal(recipe.platform,'HowToCook');assert.equal(recipe.snapshot,OPEN_RECIPE_SNAPSHOT);assert.equal(recipe.license,'Unlicense');assert.equal(recipe.contentState,'complete');assert.equal(recipe.retrievedAt,'1970-01-01T00:00:00.000Z');assert.equal(recipe.url,url);
 assert.equal(recipe.blockingIssues.length,0);assert.ok(recipe.notes.some(n=>n.includes('白胡椒')));assert.ok(recipe.notes.some(n=>n.includes('小葱')));assert.ok(!recipe.ingredients.some(i=>i.name.includes('白胡椒')||i.name.includes('小葱')));
});
test('source durations and estimated times remain distinct; soaking uses no burner and soup sauce does not change pan',()=>{
 const recipe=parseOpenRecipeMarkdown(markdown,path)!;
 assert.equal(recipe.plannedSteps[0].minutes,20);assert.equal(recipe.plannedSteps[0].timingBasis,'source');assert.equal(recipe.plannedSteps[0].passive,true);assert.equal(recipe.plannedSteps[0].burner,false);assert.equal(recipe.plannedSteps[0].equipment,undefined);
 assert.equal(recipe.plannedSteps[1].timingBasis,'estimated');assert.equal(recipe.plannedSteps[8].minutes,5);assert.equal(recipe.plannedSteps[8].timingBasis,'source');
 assert.ok(recipe.plannedSteps.filter(s=>s.burner).every(s=>s.equipment==='炒锅'));
 const seconds=planOpenRecipeStep('小火炒 10 到 15 秒煸香',0);assert.equal(seconds.minutes,1);assert.equal(seconds.timingBasis,'source');
 const long=parseOpenRecipeMarkdown(markdown.replace('20 分钟','5 小时'),path)!;assert.equal(long.plannedSteps[0].minutes,300);assert.ok(long.blockingIssues.some(x=>x.includes('180')));
});
test('ambiguous source portions and unsupported equipment require review rather than silently becoming two portions',()=>{
 const uncertain=parseOpenRecipeMarkdown(markdown.replace('一份正好够 2 个人吃','一份正好够 1-2 个人吃'),path)!;
 assert.equal(uncertain.baseServings,undefined);assert.ok(uncertain.blockingIssues.some(s=>s.includes('人数')));
 const equipment=parseOpenRecipeMarkdown(markdown.replace('锅烧热','烤箱预热'),path)!;assert.ok(equipment.blockingIssues.some(s=>s.includes('设备')));
 assert.equal(parseOpenRecipeMarkdown(markdown,'tips/example.md'),null);
});
test('index accepts only complete blob Markdown paths under dishes and public README fallback preserves index paths',()=>{
 assert.deepEqual(parseOpenRecipeIndex(tree),[path,'dishes/vegetable_dish/蚂蚁上树加青菜.md']);
 assert.throws(()=>parseOpenRecipeIndex({truncated:true,tree:tree.tree}),/不完整/);
 assert.throws(()=>parseOpenRecipeIndex({tree:[{type:'blob',path:'dishes/../../secret.md'}]}),/为空/);
 assert.deepEqual(parseOpenRecipeReadme(`- [蚂蚁上树](${path})\n- [bad](https://other.test/file.md)\n- [same](./${path})`),[path]);
});
test('real runtime search reads an index and matching full source, ranks exact names and caches immutable content with its original retrieval time',async()=>{
 const calls:string[]=[];
 const fetcher=mock((request,init)=>{calls.push(request);assert.equal(init?.redirect,'manual');return request.includes('/git/trees/')?Response.json(tree):new Response(markdown);});
 const first=await searchOpenRecipes('蚂蚁上树',{fetcher,now:100});assert.equal(first.status,'ok');assert.equal(first.candidates.length,2);assert.equal(first.candidates[0].url,url);assert.equal(first.candidates[0].ingredients.length,9);assert.equal(calls.length,3);
 const again=await searchOpenRecipes('蚂蚁上树',{fetcher,now:200});assert.equal(calls.length,3);assert.equal(again.candidates[0].retrievedAt,first.candidates[0].retrievedAt);
});
test('GitHub API restriction falls back to its public Markdown index then reads source content',async()=>{
 const calls:string[]=[];const fetcher=mock(request=>{calls.push(request);if(request.includes('/git/trees/'))return new Response('rate limited',{status:403});if(request.endsWith('/README.md'))return new Response(`- [蚂蚁上树](${path})`);return new Response(markdown);});
 const result=await searchOpenRecipes('蚂蚁上树',{fetcher,cache:false});assert.equal(result.status,'ok');assert.equal(result.candidates[0].steps.length,10);assert.equal(calls.length,3);assert.ok(calls[1].includes('raw.githubusercontent.com'));
});
test('recipe imports reject arbitrary hosts, branches and unverified snapshots before fetching',async()=>{
 let calls=0;const fetcher=mock(()=>{calls++;return new Response(markdown);});
 for(const value of ['https://evil.test/x',url.replace('github.com','github.com.evil.test'),url.replace(OPEN_RECIPE_SNAPSHOT,'master'),url.replace(OPEN_RECIPE_SNAPSHOT,'a'.repeat(40)),url+'?x=1'])assert.equal((await fetchOpenRecipe(value,{fetcher})).status,'unavailable');
 assert.equal(calls,0);assert.equal((await fetchOpenRecipe(url,{fetcher,cache:false})).status,'ok');assert.equal(calls,1);
 assert.equal((await searchOpenRecipes('https://evil.test',{fetcher})).status,'unavailable');assert.equal(calls,1);
});
test('oversized source, redirects and empty indices return errors instead of fabricated candidates',async()=>{
 const tooLarge=await fetchOpenRecipe(url,{fetcher:mock(()=>new Response('x'.repeat(150001))),cache:false});assert.equal(tooLarge.status,'unavailable');assert.equal(tooLarge.candidates.length,0);
 const redirected=await fetchOpenRecipe(url,{fetcher:mock(()=>new Response(null,{status:302,headers:{location:'https://foreign.test'}})),cache:false});assert.equal(redirected.status,'unavailable');
 const noSource=await searchOpenRecipes('蚂蚁上树',{fetcher:mock(()=>new Response('not an index')),cache:false});assert.equal(noSource.status,'unavailable');assert.equal(noSource.candidates.length,0);
});
const beefPath='dishes/meat_dish/西红柿土豆炖牛肉/西红柿土豆炖牛肉.md';
const beefNamePaths=[beefPath,'dishes/meat_dish/土豆炖排骨/土豆炖排骨.md','dishes/meat_dish/孜然牛肉.md','dishes/vegetable_dish/酸辣土豆丝.md',path,'dishes/vegetable_dish/蚂蚁上树加青菜.md'];
test('related braised potato-beef names retain the actual tomato recipe and disclose its extra ingredient',()=>{
 for(const query of ['土豆烧牛肉','土豆炖牛肉']){
  const result=matchOpenRecipeNames(beefNamePaths,query);
  assert.equal(result.length,1);assert.equal(result[0].path,beefPath);assert.equal(result[0].name,'西红柿土豆炖牛肉');assert.equal(result[0].matchType,'similar');
  assert.match(result[0].matchNote||'',/相近做法/);assert.match(result[0].matchNote||'',/另含西红柿/);assert.ok(!result.some(x=>x.name.includes('排骨')));
 }
 const alias=matchOpenRecipeNames(beefNamePaths,'番茄土豆炖牛肉');assert.equal(alias[0].path,beefPath);assert.equal(alias[0].matchType,'partial');assert.match(alias[0].matchNote||'',/别名/);
 assert.equal(matchOpenRecipeNames(beefNamePaths,'西红柿土豆炖牛肉')[0].matchType,'exact');
});
test('name expansion does not change cooking families or replace an unrecognized requested ingredient',()=>{
 assert.deepEqual(matchOpenRecipeNames(beefNamePaths,'土豆蒸牛肉'),[]);
 assert.deepEqual(matchOpenRecipeNames(beefNamePaths,'土豆烧鸡肉'),[]);
 assert.deepEqual(matchOpenRecipeNames(beefNamePaths,'土豆烧牛肉不辣'),[]);
 const potato=matchOpenRecipeNames(beefNamePaths,'土豆');assert.ok(potato.length>0);assert.ok(potato.every(r=>r.name.includes('土豆')&&r.matchType==='partial'));
 const ants=matchOpenRecipeNames(beefNamePaths,'蚂蚁上树');assert.equal(ants[0].path,path);assert.equal(ants[0].matchType,'exact');assert.equal(ants[1].matchType,'partial');
});
test('index coverage counts files and categories without claiming all entries are automatically usable',()=>{
 const stats=openRecipeIndexStats([...beefNamePaths,'dishes/drink/茶.md','dishes/template/示例.md',beefPath]);
 assert.equal(stats.totalRecipeFiles,8);assert.equal(stats.uniqueTitles,8);assert.equal(stats.byCategory.meat_dish,4);assert.equal(stats.byCategory.vegetable_dish,2);assert.equal(stats.byCategory.drink,1);assert.equal(stats.templateFiles,1);assert.equal(stats.nonTemplateRecipeFiles,7);assert.equal(stats.snapshot,OPEN_RECIPE_SNAPSHOT);
});
test('runtime result carries computed coverage and matching provenance even when no title matches',async()=>{
 const source=`# 西红柿土豆炖牛肉的做法\n## 计算\n一份正好够 2 个人吃。\n- 土豆 200g\n- 牛肉 300g\n- 西红柿 100g\n## 操作\n1. 按原谱处理食材\n2. 炖煮约 30 分钟\n`;
 const fetcher=mock(request=>request.includes('/git/trees/')?Response.json({tree:beefNamePaths.map(path=>({type:'blob',path}))}):new Response(source));
 const result=await searchOpenRecipes('土豆烧牛肉',{fetcher,cache:false});
 assert.equal(result.status,'ok');assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].title,'西红柿土豆炖牛肉');assert.equal(result.candidates[0].matchType,'similar');assert.match(result.candidates[0].matchNote||'',/另含西红柿/);assert.equal(result.indexStats?.totalRecipeFiles,6);assert.match(result.message,/未找到同名/);
 const missing=await searchOpenRecipes('根本不存在的菜',{fetcher,cache:false});assert.equal(missing.status,'unavailable');assert.equal(missing.indexStats?.uniqueTitles,6);assert.match(missing.message,/并非这道菜不存在/);
});
