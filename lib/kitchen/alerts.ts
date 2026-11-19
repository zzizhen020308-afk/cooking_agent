import {remainingSeconds,type Task,type TaskProgress} from './engine.ts';

export type DueTimer={key:string;task:Task;title:string;body:string};

/**
 * Waiting steps (simmering, steaming, soaking, marinating) whose reference time has run out.
 * The key includes the start time and any extension, so extending a timer lets it alert again.
 */
export function dueTimers(tasks:Task[],progress:TaskProgress,now:number):DueTimer[]{
 return tasks.filter(t=>t.passive&&progress[t.id]?.status==='running'&&remainingSeconds(t,progress,now)===0).map(t=>{
  const p=progress[t.id];
  const key=[t.id,p.startedAt,p.extraMinutes||0,p.deadlineAt??''].join(':');
  return {key,task:t,title:`${t.dishName} · ${t.title}，到参考时间了`,body:'回到掌勺看看状态：可以继续下一步，或按需要再延长。页面不能判断实际熟度。'};
 });
}
