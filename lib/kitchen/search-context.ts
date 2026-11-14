import {AsyncLocalStorage} from 'node:async_hooks';

const searchContext=new AsyncLocalStorage<{apiKey?:string}>();
export const withRecipeSearchKey=<T>(apiKey:string|undefined,run:()=>T):T=>searchContext.run({apiKey},run);
export const recipeSearchKey=()=>searchContext.getStore()?.apiKey||process.env.TAVILY_API_KEY;
