/* ALEGON Criativo — reversible state snapshots. No network or persistent storage. */
(function(root){'use strict';
 function history(initial,capacity=70){
  if(typeof initial!=='string')throw TypeError('Initial snapshot must be JSON text');
  const past=[],future=[];let present=initial;
  const cap=Math.max(1,Math.min(200,Math.trunc(capacity)||70));
  function record(next){
   if(typeof next!=='string'||next===present)return false;
   past.push(present);if(past.length>cap)past.shift();present=next;future.length=0;return true;
  }
  function undo(){if(!past.length)return null;future.push(present);present=past.pop();return present}
  function redo(){if(!future.length)return null;past.push(present);present=future.pop();return present}
  function reset(next){if(typeof next!=='string')return;present=next;past.length=0;future.length=0}
  function state(){return {canUndo:past.length>0,canRedo:future.length>0,undoCount:past.length,redoCount:future.length,current:present}}
  return Object.freeze({record,undo,redo,reset,state});
 }
 root.ALEGON_CREATIVE_HISTORY=Object.freeze({history});
})(typeof window!=='undefined'?window:globalThis);
