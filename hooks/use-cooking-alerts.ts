'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {dueTimers,type DueTimer} from '@/lib/kitchen/alerts';
import type {Task,TaskProgress} from '@/lib/kitchen/engine';

type Permission=NotificationPermission|'unsupported';
const permissionNow=():Permission=>typeof Notification==='undefined'?'unsupported':Notification.permission;

/** Two rising three-note chimes, loud enough to hear across a kitchen. */
function chime(ctx:AudioContext){
 const t0=ctx.currentTime;
 [0,.28,.56,1.2,1.48,1.76].forEach((d,i)=>{
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.type='triangle';o.frequency.value=[784,988,1175][i%3];
  g.gain.setValueAtTime(.0001,t0+d);g.gain.exponentialRampToValueAtTime(.5,t0+d+.02);g.gain.exponentialRampToValueAtTime(.0001,t0+d+.26);
  o.connect(g).connect(ctx.destination);o.start(t0+d);o.stop(t0+d+.28);
 });
}

/**
 * While cooking: keeps the screen awake, and when a waiting step runs out plays a chime,
 * vibrates and (if the page is in the background) shows a system notification.
 * Browsers only allow sound and notifications after a tap, so call `enable` from a click.
 */
export function useCookingAlerts({active,tasks,progress,clock,onDue}:{active:boolean;tasks:Task[];progress:TaskProgress;clock:number;onDue?:(timer:DueTimer)=>void}){
 const audio=useRef<AudioContext|null>(null),fired=useRef<Set<string>|null>(null),onDueRef=useRef(onDue);
 const [sound,setSound]=useState(false),[awake,setAwake]=useState(false),[permission,setPermission]=useState<Permission>(permissionNow);
 useEffect(()=>{onDueRef.current=onDue;},[onDue]);

 useEffect(()=>{if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});},[]);

 const enable=useCallback(async()=>{
  // Start both requests inside the tap, before any await, so Safari still counts it as user-initiated.
  const Ctx=window.AudioContext||(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
  try{audio.current??=Ctx?new Ctx():null;}catch{audio.current=null;}
  const resumed=audio.current?.resume().catch(()=>{});
  const asked=typeof Notification!=='undefined'&&Notification.permission==='default'?Notification.requestPermission().catch(()=>Notification.permission):undefined;
  await Promise.all([resumed,asked]);
  const ok=audio.current?.state==='running';
  if(ok)chime(audio.current!);
  setSound(ok);setPermission(permissionNow());
 },[]);

 // Keep the screen on while cooking. The lock drops whenever the page is hidden, so take it again on return.
 useEffect(()=>{
  if(!active||!('wakeLock' in navigator))return;
  let lock:WakeLockSentinel|null=null,stopped=false;
  const acquire=async()=>{
   if(stopped||document.visibilityState!=='visible'||(lock&&!lock.released))return;
   try{
    const next=await navigator.wakeLock.request('screen');
    if(stopped){await next.release();return;}
    lock=next;setAwake(true);next.addEventListener('release',()=>setAwake(false));
   }catch{setAwake(false);}
  };
  acquire();document.addEventListener('visibilitychange',acquire);
  return()=>{stopped=true;document.removeEventListener('visibilitychange',acquire);lock?.release().catch(()=>{});};
 },[active]);

 useEffect(()=>{
  if(!active){fired.current=null;return;}
  const due=dueTimers(tasks,progress,clock);
  // Timers that were already over when the page opened are shown on screen, not replayed as alarms.
  if(fired.current===null){fired.current=new Set(due.map(d=>d.key));return;}
  for(const d of due){
   if(fired.current.has(d.key))continue;
   fired.current.add(d.key);
   navigator.vibrate?.([400,150,400,150,700]);
   if(audio.current?.state==='running')chime(audio.current);
   if(permissionNow()==='granted'&&document.visibilityState!=='visible')
    navigator.serviceWorker?.ready.then(r=>r.showNotification(d.title,{body:d.body,tag:d.key,icon:'/icons/icon-192.png',requireInteraction:true})).catch(()=>{});
   onDueRef.current?.(d);
  }
 },[active,tasks,progress,clock]);

 return {enable,sound,awake,permission};
}
