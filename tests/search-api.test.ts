import test from 'node:test';
import assert from 'node:assert/strict';
import {recipeApiGate,recipeApiInput} from '../lib/kitchen/search-api.ts';
import {recipeSearchKey,withRecipeSearchKey} from '../lib/kitchen/search-context.ts';

test('anonymous recipe requests reject cross-site origins and excessive bodies',async()=>{
 const request=(headers:Record<string,string>,body='{}')=>new Request('https://kitchen.test/api/recipes/search',{method:'POST',headers:{'Content-Type':'application/json',...headers},body});
 assert.equal(recipeApiGate(request({origin:'https://foreign.test'}))?.status,403);
 assert.equal(recipeApiGate(request({'Content-Length':'3000'}))?.status,413);
 await assert.rejects(recipeApiInput(request({},'x'.repeat(2049))),/过长/);
 assert.deepEqual(await recipeApiInput(request({},JSON.stringify({query:'莲藕汤'}))),{query:'莲藕汤'});
});
test('request-local search credentials cannot cross concurrent visitors',async()=>{
 const values=await Promise.all(['test-a','test-b'].map(key=>withRecipeSearchKey(key,async()=>{await Promise.resolve();return recipeSearchKey();})));
 assert.deepEqual(values,['test-a','test-b']);
});
test('anonymous search bursts stop before another upstream request can start',()=>{
 const request=()=>new Request('https://kitchen.test/api/recipes/search',{method:'POST',headers:{'Content-Type':'application/json','cf-connecting-ip':'test-limits'},body:'{}'});
 for(let i=0;i<8;i++)assert.equal(recipeApiGate(request(),1000000),null);
 const blocked=recipeApiGate(request(),1000000);assert.equal(blocked?.status,429);assert.equal(blocked?.headers.get('Retry-After'),'60');
 assert.equal(recipeApiGate(request(),1060001),null);
});
