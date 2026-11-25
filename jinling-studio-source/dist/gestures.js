const instructions=['按住印模','向上拖捏','拖入定位圈','左右来回滚动'];
const labels=['印模','捏住','配件','擀棒'];
const defaultSlots=[[37,42],[51,31],[65,45]];
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));

export function mountGesture(layer,phase,item,{update,complete,tick,art=false,slots=defaultSlots}){
 const plan=document.createElement('div');plan.className='gesture-plan';
 layer.replaceChildren(plan);layer.hidden=false;
 if(art&&phase===0){
  const stock=document.createElement('div');stock.className='fallback-work';plan.append(stock);
 }
 const hint=document.createElement('div');hint.className='work-hint';
 hint.textContent=instructions[phase];plan.append(hint);
 const path=document.createElement('div');path.className='guide-path '+(phase===3?'roll':'pinch');
 if(phase===1||phase===3)plan.append(path);

 let progress=0,frame=0,done=false,rollMovement=0,lastDirection=0,turns=0,holding=null;
 const docked=new Set();
 const tools=[];
 const place=(el,x,y)=>{el.style.left=x+'%';el.style.top=y+'%';};
 const report=(value)=>{
  progress=clamp(value);
  if(art){
   plan.style.setProperty('--shape-x',phase===0?1+progress*.5:1+(phase===3?progress*.2:0));
   plan.style.setProperty('--shape-y',phase===0?1-progress*.6:1+progress*.35);

  }
  update(progress,docked);
 };
 function finish(){
  if(done)return;
  done=true;holding=null;cancelAnimationFrame(frame);report(1);complete();
 }
 function makeButton(name,cls,x,y,aria){
  const el=document.createElement('button');el.type='button';el.className=cls;
  el.textContent=name;el.setAttribute('aria-label',aria);place(el,x,y);plan.append(el);tools.push(el);return el;
 }
 const targets=[];
 if(phase===2){
  for(let i=0;i<3;i++){
   const target=document.createElement('span');target.className='work-target';target.textContent='定位';
   target.setAttribute('aria-hidden','true');place(target,...slots[i]);plan.append(target);targets.push(target);
   const piece=makeButton('配件 '+(i+1),'work-piece',29+i*21,80,item.piece+'，配件 '+(i+1)+'。拖动，或按空格进入安装。');
   piece.dataset.index=i;
   piece.style.background='radial-gradient(ellipse at 30% 22%,#f9e3b7,#'+item.colors[(i+1)%3].toString(16)+' 74%,#6e5033)';
  }
 } else {
  const [x,y]=phase===0?[51,52]:phase===1?[50,65]:[50,67];
  makeButton(phase===3?'':' '+labels[phase],'work-tool '+(phase===0?'press':phase===3?'roller':'pinch'),x,y,instructions[phase]+'，也可用键盘操作');
 }
 function point(e){
  const r=plan.getBoundingClientRect();
  return [(e.clientX-r.left)*100/r.width,(e.clientY-r.top)*100/r.height];
 }
 function press(now){
  if(holding&&phase===0){const elapsed=(now-holding.time)/780;report(holding.initial+elapsed);place(tools[0],51,52+progress*12);if(progress>=1)finish();else frame=requestAnimationFrame(press);}
 }
 function snap(el,index){
  place(el,...slots[index]);el.disabled=true;el.textContent='已镶合';el.classList.add('attached');
  targets[index].classList.add('ready');targets[index].textContent='';
  docked.add(index);tick(docked.size);report(docked.size/3);if(docked.size===3)finish();
 }
 const near=(x,y,i)=>Math.hypot((x-slots[i][0])*1.12,y-slots[i][1])<13;
 for(const el of tools){
  const index=Number(el.dataset.index);
  el.addEventListener('pointerdown',e=>{
   if(e.button!==0||done||holding)return;
   const [x,y]=point(e);holding={id:e.pointerId,time:performance.now(),initial:progress,startY:y,lastX:clamp(x,26,74),lastRoll:0};
   el.setPointerCapture(e.pointerId);
   if(phase===2){targets[index].classList.add('ready');place(el,x,y);}
   if(phase===0)frame=requestAnimationFrame(press);
  });
  el.addEventListener('pointermove',e=>{
   if(holding?.id!==e.pointerId||done)return;
   const [x,y]=point(e);
   if(phase===0)place(el,51,52+progress*12);
   if(phase===1){
    const draft=clamp((holding.startY-y)/34);
    place(el,50,65-draft*36);report(Math.max(holding.initial,draft));
    if(draft>=1)finish();
   }
   if(phase===2){
    place(el,clamp(x,4,96),clamp(y,4,96));
    targets[index].classList.toggle('ready',near(x,y,index));
   }
   if(phase===3){
    const track=clamp(x,26,74),delta=track-holding.lastX;
    place(el,track,67);
    if(Math.abs(delta)>=.7){
     const direction=Math.sign(delta);
     if(direction!==lastDirection){
      if(holding.lastRoll>=8){turns++;tick(turns);}
      holding.lastRoll=0;lastDirection=direction;
     }
     holding.lastRoll+=Math.abs(delta);rollMovement+=Math.abs(delta);holding.lastX=track;
     report(Math.min(1,rollMovement/104,(turns+1)/3));
     if(rollMovement>=104&&turns>=2)finish();
    }
   }
  });
  function release(e,allowDrop){
   if(holding?.id!==e.pointerId||done)return;
   holding=null;cancelAnimationFrame(frame);
   if(phase===0)place(el,51,52);
   if(phase===1)place(el,50,65);
   if(phase===2){
    targets[index].classList.remove('ready');
    const [x,y]=point(e);
    if(allowDrop&&near(x,y,index))snap(el,index);
    else place(el,29+index*21,80);
   }
  }
  el.addEventListener('pointerup',e=>release(e,true));
  el.addEventListener('pointercancel',e=>release(e,false));
  el.addEventListener('keydown',e=>{
   if(done||holding?.id!==undefined)return;
   if(phase===0&&[' ','Enter'].includes(e.key)){
    e.preventDefault();
    if(!holding){holding={time:performance.now(),initial:progress};frame=requestAnimationFrame(press);}
   }
   if(phase===1&&['ArrowUp',' '].includes(e.key)){
    e.preventDefault();report(progress+.15);place(el,50,65-progress*36);
    if(progress>=1)finish();
   }
   if(phase===2&&[' ','Enter','ArrowUp'].includes(e.key)){
    e.preventDefault();
    if(!el.classList.contains('carrying')){
     el.classList.add('carrying');targets[index].classList.add('ready');place(el,...slots[index]);
     hint.textContent='按空格镶合配件';
    }else{snap(el,index);if(!done){tools.find(button=>!button.disabled)?.focus();hint.textContent=instructions[phase];}}
   }
   if(phase===3&&['ArrowLeft','ArrowRight'].includes(e.key)){
    e.preventDefault();
    const direction=e.key==='ArrowLeft'?-1:1;
    if(direction!==lastDirection){
     lastDirection=direction;report(progress+.25);tick(progress);place(el,50+direction*23,67);
     if(progress>=1)finish();
    }
   }
  });
  el.addEventListener('keyup',e=>{
   if(phase===0&&[' ','Enter'].includes(e.key)&&holding?.id===undefined){holding=null;cancelAnimationFrame(frame);}
  });
  el.addEventListener('blur',()=>{if(phase===0&&holding?.id===undefined){holding=null;cancelAnimationFrame(frame);}});
 }
 report(0);
 return {focus:()=>tools[0]?.focus({preventScroll:true}),dispose:()=>{done=true;holding=null;cancelAnimationFrame(frame);layer.hidden=true;layer.replaceChildren();}};
}
