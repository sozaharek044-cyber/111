import {mounts} from './collection.js';

const $=id=>document.getElementById(id);
const capacity=4;
const sourceButtons=mounts.map(({key,name},index)=>{
 const button=document.createElement('button');button.type='button';button.className='field-source';
 button.innerHTML='<img src="art/'+key+'.webp" alt=""><span>'+name+'</span>';
 button.onclick=()=>toggleSource(index);
 return button;
});
$('fieldSources').append(...sourceButtons);

const surface=$('particleSurface'),cursor=$('fieldCursor'),loading=$('fieldLoading');
const formatter=new Intl.NumberFormat('zh-CN');
let composed=[0],field,importing,awake=false;
let formation='shape',tool='push',radius=3,pointer=null,keyPoint=null;
let paused=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let revision=0;

function activeButtons(id,value){
 for(const button of $(id).children)button.setAttribute('aria-pressed',String(button.dataset.value===value));
}
function reflect(){
 sourceButtons.forEach((button,i)=>button.setAttribute('aria-pressed',String(composed.includes(i))));
 $('fieldSelectionCount').textContent=composed.length+' / '+capacity;
 $('fieldTitle').textContent=composed.length===1?mounts[composed[0]].name:composed.length+' 件金陵风物';
 $('fieldFormationName').textContent=formation==='flow'?'汇流':'造型';
 activeButtons('fieldFormation',formation);
}
function setFormation(value){
 formation=value;field?.setFormation(value);reflect();
}
function toggleSource(index){
 if(!awake)return;
 const included=composed.includes(index);
 const hint=$('fieldSelectionHint');
 if(included&&composed.length===1){hint.textContent='请至少保留一件作品。';return;}
 if(!included&&composed.length===capacity){hint.textContent='已选满四件，请先取消一件。';return;}
 composed=included?composed.filter(i=>i!==index):[...composed,index];
 hint.textContent=composed.length>1?'切换「汇成一流」，让选中的作品融合。':'可同时选择最多四件作品。';
 reflect();
 field?.setSources(composed);
}

export async function openParticleRoom(origin=null){
 const pending=++revision;
 awake=true;
 $('fieldPause').setAttribute('aria-pressed',String(paused));
 $('fieldPause').textContent=paused?'恢复流动':'暂停流动';
 if(origin!==null){composed=[origin];formation='shape';}
 reflect();
 $('fieldSelectionHint').textContent='可同时选择最多四件作品。';
 if(!field)loading.hidden=false;
 try{
  importing??=import('./particle-field.js');
  const {makeParticleField}=await importing;
  if(!awake||pending!==revision)return;
  field??=makeParticleField(surface,count=>{$('fieldCount').textContent=formatter.format(count)+' 个造型采样点';});
  field.show();field.setPause(paused);field.setTool(tool);field.setRadius(radius);
  field.setFormation(formation);
  field.setSources(composed,{reset:origin!==null});
  loading.hidden=true;
  if(origin!==null&&!paused){
   requestAnimationFrame(()=>{if(awake&&pending===revision)field.scatter();});
  }
 }catch(error){
  if(pending!==revision)return;
  importing=null;
  loading.hidden=false;
  loading.textContent='此设备暂时无法绘制粒子画布。';
  console.warn('Particle canvas unavailable',error);
 }
}

export function closeParticleRoom(){
 awake=false;revision++;
 field?.hide();pointer=null;keyPoint=null;cursor.hidden=true;
}

function displayCursor(x,y,held){
 const diameter=2*(27+radius*14);
 cursor.hidden=false;cursor.style.left=x+'px';cursor.style.top=y+'px';
 cursor.style.width=diameter+'px';cursor.style.height=diameter+'px';
 field?.setPointer(x,y,held);
}
function updatePointer(e,held){
 const box=surface.getBoundingClientRect();
 displayCursor(e.clientX-box.left,e.clientY-box.top,held);
}
function clearCursor(){
 cursor.hidden=true;field?.clearPointer();
}
surface.addEventListener('pointerdown',e=>{
 if(e.button!==0||pointer!==null)return;
 pointer=e.pointerId;surface.setPointerCapture(e.pointerId);
 updatePointer(e,true);field?.press();
});
surface.addEventListener('pointermove',e=>{
 if(pointer===null&&e.pointerType==='touch')return;
 if(pointer===null||pointer===e.pointerId)updatePointer(e,pointer!==null);
});
surface.addEventListener('pointerup',e=>{
 if(pointer!==e.pointerId)return;
 pointer=null;
 if(e.pointerType==='mouse')updatePointer(e,false);else clearCursor();
});
surface.addEventListener('lostpointercapture',e=>{if(pointer===e.pointerId){pointer=null;clearCursor();}});
surface.addEventListener('pointercancel',()=>{pointer=null;clearCursor();});
surface.addEventListener('pointerleave',()=>{if(pointer===null)clearCursor();});
surface.addEventListener('blur',()=>{keyPoint=null;if(pointer===null)clearCursor();});
surface.addEventListener('keydown',e=>{
 const deltas={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
 if(!(e.key in deltas)&&e.key!==' ')return;
 e.preventDefault();
 const w=surface.clientWidth,h=surface.clientHeight;
 keyPoint??=[w*.5,h*.5];
 if(e.key in deltas){
  const [x,y]=deltas[e.key];
  keyPoint[0]=Math.max(0,Math.min(w,keyPoint[0]+x*18));
  keyPoint[1]=Math.max(0,Math.min(h,keyPoint[1]+y*18));
 }
 displayCursor(...keyPoint,false);
 if(e.key===' ')field?.press();
});

$('fieldFormation').addEventListener('click',e=>{
 const value=e.target.dataset.value;
 if(!value)return;
 setFormation(value);
});
$('fieldTool').addEventListener('click',e=>{
 const value=e.target.dataset.value;
 if(!value)return;
 tool=value;field?.setTool(value);activeButtons('fieldTool',value);
});
$('fieldRadius').addEventListener('input',e=>{
 radius=Number(e.target.value);
 $('fieldRadiusValue').textContent=['最小','小','中','大','最大'][radius-1];
 field?.setRadius(radius);
});
$('scatterField').onclick=()=>field?.scatter();
$('gatherField').onclick=()=>{setFormation('shape');clearCursor();field?.gather();};
$('fieldPause').onclick=()=>{
 paused=!paused;
 field?.setPause(paused);
 $('fieldPause').setAttribute('aria-pressed',String(paused));
 $('fieldPause').textContent=paused?'恢复流动':'暂停流动';
};
reflect();
