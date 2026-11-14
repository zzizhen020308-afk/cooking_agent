import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePastedRecipe,parseXiachufangHtml,cleanXiachufangTitle} from '../lib/kitchen/online-parser.ts';
import {normalizeXiachufangRecipeUrl,searchXiachufang,fetchXiachufangRecipe,type OnlineSearchOptions} from '../lib/kitchen/online-search.ts';
const synthetic='小炒南瓜\n作者：测试厨房\n用料\n南瓜 300克\n食用油 10毫升\n盐 适量\n做法步骤\n步骤 1\n南瓜切片，备好用料。\n步骤 2\n锅内倒油，翻炒至熟。\n小贴士\n这是测试数据，不是实际菜谱。';
const now=1800000000000;
function fetcher(fn:(url:string,init:RequestInit)=>Response|Promise<Response>):typeof fetch{return ((input:RequestInfo|URL,init:RequestInit={})=>Promise.resolve(fn(String(input),init))) as typeof fetch;}

test('pasted source fields retain missing quantities without inventing cooking durations',()=>{
 const parsed=parsePastedRecipe(synthetic)!;assert.equal(parsed.title,'小炒南瓜');assert.equal(parsed.author,'测试厨房');assert.deepEqual(parsed.ingredients,[{name:'南瓜',quantityText:'300克'},{name:'食用油',quantityText:'10毫升'},{name:'盐',quantityText:'适量'}]);assert.equal(parsed.steps.length,2);assert.match(parsed.steps[1],/翻炒至熟/);assert.equal('minutes' in parsed,false);assert.equal(parsePastedRecipe('这不是菜谱'),null);
});
test('Markdown ingredient tables parse values and omit table headers and alignment rows',()=>{
 const parsed=parsePastedRecipe('# 测试菜\n| 食材 | 用量 |\n| :--- | ---: |\n| 南瓜 | 300克 |\n| 盐 | 适量 |\n## 做法步骤\n1. 切片。\n2. 煮熟。')!;assert.deepEqual(parsed.ingredients,[{name:'南瓜',quantityText:'300克'},{name:'盐',quantityText:'适量'}]);assert.deepEqual(parsed.steps,['切片。','煮熟。']);
});
test('unnumbered pasted lines stay separate steps and source headings or image labels are omitted',()=>{
 const parsed=parsePastedRecipe('蔬菜炒蛋\n用料\n鸡蛋 2个\n青菜 200克\n做法\n## 备菜\nImage: 菜品步骤图\n![步骤图片](https://example.com/image.jpg)\n切好蔬菜，打散鸡蛋。\n先炒蛋盛出，再炒蔬菜，合炒至熟。')!;
 assert.deepEqual(parsed.steps,['切好蔬菜，打散鸡蛋。','先炒蛋盛出，再炒蔬菜，合炒至熟。']);
 const numbered=parsePastedRecipe('蔬菜炒蛋\n用料\n鸡蛋 2个\n做法\n步骤 1\n打散鸡蛋。\n把青菜切好。\n步骤 2\n合炒至熟。')!;
 assert.deepEqual(numbered.steps,['打散鸡蛋。\n把青菜切好。','合炒至熟。']);
});
test('JSON-LD Recipe reads ingredient facts, author, yield and nested steps',()=>{
 const html='<script type="application/ld+json">'+JSON.stringify({'@graph':[{'@type':'WebPage'},{'@type':['Thing','Recipe'],name:'测试豆腐',author:{name:'A &amp; B'},recipeYield:'2人份',recipeIngredient:['豆腐 300克','葱'],recipeInstructions:[{'@type':'HowToStep',text:'备好豆腐。'},{'@type':'HowToSection',itemListElement:[{text:'煮至熟透。'}]}]}]})+'</script>';
 const parsed=parseXiachufangHtml(html)!;assert.equal(parsed.title,'测试豆腐');assert.equal(parsed.author,'A & B');assert.equal(parsed.servingsText,'2人份');assert.equal(parsed.ingredients[1].quantityText,'');assert.deepEqual(parsed.steps,['备好豆腐。','煮至熟透。']);
});
test('Xiachufang public table markup parses source fields without images or scripts',()=>{
 const parsed=parseXiachufangHtml('<h1>测试菜</h1><table><tr><td class="name"><a>萝卜</a></td><td class="unit">200克</td></tr></table><p class="text">切片后煮熟。</p><script>alert(1)</script>')!;assert.equal(parsed.title,'测试菜');assert.deepEqual(parsed.ingredients,[{name:'萝卜',quantityText:'200克'}]);assert.deepEqual(parsed.steps,['切片后煮熟。']);
});
test('only exact HTTPS Xiachufang recipe hosts and numeric recipe paths are accepted',()=>{
 assert.equal(normalizeXiachufangRecipeUrl('https://www.xiachufang.com/recipe/12345678?from=share#x'),'https://www.xiachufang.com/recipe/12345678/');
 for(const url of ['http://www.xiachufang.com/recipe/12345678/','https://evil.example/recipe/12345678/','https://www.xiachufang.com.evil.example/recipe/12345678/','https://www.xiachufang.com@127.0.0.1/recipe/12345678/','https://www.xiachufang.com:443/recipe/12345678/../../auth/','https://www.xiachufang.com/search/?keyword=x','https://m.xiachufang.com/recipe/12345678/other','file:///etc/passwd'])assert.equal(normalizeXiachufangRecipeUrl(url),null,url);
});
test('without a configured key search makes no network call and supplies a real public search link',async()=>{
 let calls=0;const result=await searchXiachufang('冬瓜丸子汤',{fetcher:fetcher(()=>{calls++;throw Error('not expected');})});assert.equal(result.status,'not_configured');assert.equal(calls,0);assert.equal(new URL(result.searchUrl).hostname,'www.xiachufang.com');assert.equal(new URL(result.searchUrl).searchParams.get('keyword'),'冬瓜丸子汤');assert.deepEqual(result.candidates,[]);
});
test('Tavily adapter uses documented server auth and raw markdown, filters foreign hosts and deduplicates',async()=>{
 let calls=0;const result=await searchXiachufang('冬瓜丸子汤',{apiKey:'test-secret',now,fetcher:fetcher((url,init)=>{calls++;assert.equal(url,'https://api.tavily.com/search');assert.equal((init.headers as Record<string,string>).Authorization,'Bearer test-secret');const body=JSON.parse(String(init.body));assert.equal(body.include_raw_content,'markdown');assert.deepEqual(body.include_domains,['xiachufang.com']);assert.equal(body.max_results,3);assert.equal(body.include_answer,false);assert.equal(init.redirect,'manual');return new Response(JSON.stringify({results:[{title:'外站',url:'https://evil.example/recipe/12345678/',raw_content:synthetic},{title:'〖步骤图〗小炒南瓜的做法_菜谱_下厨房',url:'https://m.xiachufang.com/recipe/12345678/',raw_content:synthetic},{title:'重复',url:'https://www.xiachufang.com/recipe/12345678/'},{title:'只有摘要',url:'https://www.xiachufang.com/recipe/23456789/',content:'没有原文不能拼出做法'}]}),{headers:{'Content-Type':'application/json'}});})});
 assert.equal(calls,1);assert.equal(result.status,'ok');assert.equal(result.candidates.length,2);assert.equal(result.candidates[0].author,'测试厨房');assert.equal(result.candidates[0].retrieval,'search-index');assert.equal(result.candidates[0].retrievedAt,new Date(now).toISOString());assert.equal(result.candidates[0].steps.length,2);assert.deepEqual(result.candidates[1].steps,[]);assert.deepEqual(result.candidates[1].ingredients,[]);assert.ok(!JSON.stringify(result).includes('test-secret'));
});
test('bad query, malformed JSON, authentication failures and upstream errors return safe messages',async()=>{
 for(const query of ['', 'a', '<script>', 'https://example.com'])assert.equal((await searchXiachufang(query,{apiKey:'key'})).status,'unavailable');
 for(const response of [new Response('bad json'),new Response('secret error',{status:401}),new Response('server details',{status:500})]){const result=await searchXiachufang('测试菜谱',{apiKey:'test-secret',fetcher:fetcher(()=>response)});assert.equal(result.status,'unavailable');assert.ok(!JSON.stringify(result).includes('test-secret'));assert.ok(!JSON.stringify(result).includes('server details'));}
});
test('public recipe direct fetch stops at captcha redirects without following them',async()=>{
 let calls=0;const result=await fetchXiachufangRecipe('https://m.xiachufang.com/recipe/12345678/',{fetcher:fetcher((_url,init)=>{calls++;assert.equal(init.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://www.xiachufang.com/auth/humancheck_captcha/?x=1'}});})});assert.equal(calls,1);assert.equal(result.status,'restricted');assert.deepEqual(result.candidates,[]);
});
test('captcha content and rate limits are explicit restricted states',async()=>{
 for(const response of [new Response('<h1>安全验证</h1>'),new Response('rate limit',{status:429}),new Response('forbidden',{status:403})])assert.equal((await fetchXiachufangRecipe('https://www.xiachufang.com/recipe/12345678/',{fetcher:fetcher(()=>response)})).status,'restricted');
});
test('direct fetch rejects arbitrary origins before network and never follows untrusted redirects',async()=>{
 let calls=0;const options:OnlineSearchOptions={fetcher:fetcher(()=>{calls++;return new Response(null,{status:302,headers:{Location:'http://127.0.0.1/private'}});})};assert.equal((await fetchXiachufangRecipe('https://example.com/recipe/12345678/',options)).status,'unavailable');assert.equal(calls,0);assert.equal((await fetchXiachufangRecipe('https://m.xiachufang.com/recipe/12345678/',options)).status,'unavailable');assert.equal(calls,1);
});
test('valid public recipe yields source URL and retrieval date, while oversized upstream is refused',async()=>{
 const html='<script type="application/ld+json">'+JSON.stringify({'@type':'Recipe',name:'测试菜',recipeIngredient:['土豆 200克'],recipeInstructions:['煮熟。']})+'</script>';
 const result=await fetchXiachufangRecipe('https://m.xiachufang.com/recipe/12345678/?tracking=x',{now,fetcher:fetcher(()=>new Response(html))});assert.equal(result.status,'ok');assert.equal(result.candidates[0].url,'https://m.xiachufang.com/recipe/12345678/');assert.equal(result.candidates[0].retrieval,'direct');assert.equal(result.candidates[0].ingredients[0].quantityText,'200克');
 assert.equal((await fetchXiachufangRecipe(result.candidates[0].url,{fetcher:fetcher(()=>new Response('x',{headers:{'content-length':'900000'}}))})).status,'unavailable');
});
test('streamed upstream responses are bounded even without content-length',async()=>{
 let cancelled=false;const stream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array(750001));},cancel(){cancelled=true;}});
 const result=await fetchXiachufangRecipe('https://m.xiachufang.com/recipe/12345678/',{fetcher:fetcher(()=>new Response(stream))});assert.equal(result.status,'unavailable');assert.equal(cancelled,true);assert.deepEqual(result.candidates,[]);
});
test('Tavily returns at most three source pages, never promotes summaries or captcha content into recipes',async()=>{
 const rows=[{title:'验证',url:'https://m.xiachufang.com/recipe/12345678/',raw_content:'验证码 安全验证'},...[23456789,34567890,45678901,56789012].map(id=>({title:'测试候选'+id,url:`https://m.xiachufang.com/recipe/${id}/`,content:synthetic,raw_content:null}))];
 const result=await searchXiachufang('测试候选菜',{apiKey:'hidden-key',fetcher:fetcher(()=>new Response(JSON.stringify({results:rows})))});assert.equal(result.status,'ok');assert.equal(result.candidates.length,3);for(const candidate of result.candidates){assert.deepEqual(candidate.ingredients,[]);assert.deepEqual(candidate.steps,[]);assert.equal(candidate.retrieval,'search-index');assert.equal(candidate.contentState,'link-only');}assert.match(result.message,/未返回菜谱正文/);assert.ok(!JSON.stringify(result).includes('hidden-key'));
});
test('observed live title decorations are removed without fabricating missing recipe content',async()=>{
 const titles=['莴笋炒肉的做法步骤_菜谱 - 下厨房','【步骤图】莴笋炒肉的做法- 家常菜 - 下厨房','简单又下饭的莴笋炒肉丝的做法步骤 - 下厨房'];
 assert.deepEqual(titles.map(cleanXiachufangTitle),['莴笋炒肉','莴笋炒肉','简单又下饭的莴笋炒肉丝']);
 const result=await searchXiachufang('莴笋炒肉',{apiKey:'test-secret',fetcher:fetcher(()=>new Response(JSON.stringify({results:titles.map((title,i)=>({title,url:`https://m.xiachufang.com/recipe/${107742458+i}/`,raw_content:null,content:'搜索摘要，不是用料与步骤正文。'}))})))});
 assert.equal(result.status,'ok');assert.equal(result.candidates.length,3);for(const candidate of result.candidates){assert.equal(candidate.contentState,'link-only');assert.deepEqual(candidate.ingredients,[]);assert.deepEqual(candidate.steps,[]);assert.equal(candidate.author,undefined);}assert.match(result.message,/暂不能据此生成食材清单和烹饪安排/);
});
test('candidate content states distinguish field availability from reviewed cooking plans',async()=>{
 const rows=[{title:'测试南瓜的做法_下厨房',raw_content:synthetic},{title:'用料部分的做法_下厨房',raw_content:'测试用料\n用料\n土豆 200克'},{title:'步骤部分的做法_下厨房',raw_content:'测试步骤\n做法\n1. 切片。\n2. 炒熟。'}].map((row,i)=>({...row,url:`https://m.xiachufang.com/recipe/${22345678+i}/`}));
 const result=await searchXiachufang('测试菜谱',{apiKey:'test-secret',fetcher:fetcher(()=>new Response(JSON.stringify({results:rows})))});
 assert.deepEqual(result.candidates.map(c=>c.contentState),['complete','partial','partial']);
 assert.equal(result.candidates[0].ingredients[2].quantityText,'适量');assert.equal(typeof result.candidates[0].steps[0],'string');assert.equal('minutes' in result.candidates[0],false);
 const direct=await fetchXiachufangRecipe('https://m.xiachufang.com/recipe/12345678/',{fetcher:fetcher(()=>new Response('<h1>仅用料</h1><table><tr><td>土豆</td><td>200克</td></tr></table>'))});
 assert.equal(direct.candidates[0].contentState,'partial');assert.match(direct.message,/只读取到部分/);
});
