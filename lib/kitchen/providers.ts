import type { ProviderId, Requirement } from './catalog.ts';
import type { Quote } from './engine.ts';
/** Contract for future server-side integrations. No production credentials or private endpoints. */
export interface GroceryProvider {
 readonly id:ProviderId;
 authorize():Promise<{authorizationUrl:string}>;
 quote(input:{requirements:Requirement[];addressToken:string;pantry:string[]}):Promise<Quote>;
 prepareCheckout(input:{quoteId:string;idempotencyKey:string}):Promise<{checkoutId:string;total:number;expiresAt:number}>;
 submitOrder(input:{checkoutId:string;confirmedTotal:number;authorizationToken:string;idempotencyKey:string}):Promise<{orderId:string;status:string}>;
 getOrder(orderId:string):Promise<{status:string}>;
}
export const INTEGRATION_STATUS = {
 dingdong:{mode:'demo',liveEnabled:false,reason:'消费者授权、商品搜索和代下单接口尚未核实。'},
 hema:{mode:'demo',liveEnabled:false,reason:'公开开放平台入口不代表已获得消费者代下单权限。'}
} as const;
