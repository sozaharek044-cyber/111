import * as T from './three.js';
import {builders,ball} from './models.js';
import {mounts,attachmentAnchors} from './collection.js';
import {mountGesture} from './gestures.js';
import {openParticleRoom,closeParticleRoom} from './particle-room.js';
const $=id=>document.getElementById(id);
let selected=0,phase=-1,muted=true,audio,renderer,scene,camera,turntable,models=[],current,yaw=0,pitch=0,particles=[],popAt=0,popping=null,raf=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const holder=$('scene');
const stage=holder.parentElement;
let triedStudio=false,particleReturn=false,fallbackArt;
let gesture, rotation=-Math.PI/2-.31, orbitDrag=null, ignoreOrbitClick=false;
const exhibitButtons=()=>[...$('choices').children];
function layoutOrbit(){
 exhibitButtons().forEach((btn,i)=>{
  const angle=rotation+i*Math.PI/5,depth=Math.sin(angle);
  btn.style.left=(50+40.5*Math.cos(angle))+'%';
  btn.style.top=(55+33.5*depth)+'%';
  btn.style.setProperty('--size',.94+depth*.11);
  btn.style.zIndex=String(Math.round(13+depth*10));
 });
}
function turnOrbit(amount){rotation+=amount;layoutOrbit();}
$('previousExhibit').onclick=()=>turnOrbit(-Math.PI/6);
$('nextExhibit').onclick=()=>turnOrbit(Math.PI/6);
const orbit=$('orbit');
orbit.addEventListener('pointerdown',e=>{
 if(e.button!==0||orbitDrag)return;
 ignoreOrbitClick=false;orbitDrag={id:e.pointerId,x:e.clientX,y:e.clientY,rotation,moved:false};
});
orbit.addEventListener('pointermove',e=>{
 if(orbitDrag?.id!==e.pointerId)return;
 const dx=e.clientX-orbitDrag.x,dy=e.clientY-orbitDrag.y;
 if(!orbitDrag.moved&&Math.abs(dx)>Math.max(7,Math.abs(dy))){
  orbitDrag.moved=true;ignoreOrbitClick=true;orbit.setPointerCapture(e.pointerId);
 }
 if(orbitDrag.moved){rotation=orbitDrag.rotation+dx*.013;layoutOrbit();}
});
function endOrbit(){orbitDrag=null;}
orbit.addEventListener('pointerup',endOrbit);
orbit.addEventListener('pointercancel',endOrbit);
orbit.addEventListener('pointerleave',()=>{if(!orbitDrag?.moved)endOrbit();});
orbit.addEventListener('click',e=>{if(ignoreOrbitClick&&e.detail){e.stopPropagation();ignoreOrbitClick=false;}},true);
orbit.addEventListener('keydown',e=>{
 if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();turnOrbit((e.key==='ArrowRight'?1:-1)*Math.PI/6);}
});
function activatePage(page){
 const root={gallery:'gallery',studio:'studio',particles:'particles'};
 for(const [key,id] of Object.entries(root))$(id).hidden=key!==page;
 $('techniqueBand').hidden=page==='particles';
 if(page!=='particles')closeParticleRoom();
 for(const [id,active] of [['navGallery',page!=='particles'],['navParticles',page==='particles']]){
  if(active)$(id).setAttribute('aria-current','page');else $(id).removeAttribute('aria-current');
 }
}
function showGallery(focus=false){
 gesture?.dispose();gesture=null;phase=-1;popping=null;
 activatePage('gallery');
 if(focus)exhibitButtons()[selected].focus({preventScroll:true});
 $('gallery').scrollIntoView({block:'start'});
}
function openStudio(i){
 selected=i;phase=-1;yaw=.06;pitch=0;popping=null;
 activatePage('studio');
 if(!triedStudio){
  triedStudio=true;
  try{init();}catch(error){console.warn('WebGL unavailable',error);renderer=null;holder.replaceChildren();}
 }
 render();$('studio').scrollIntoView({block:'start'});$('action').focus({preventScroll:true});
}
$('returnGallery').onclick=()=>showGallery(true);
$('navGallery').onclick=$('brandHome').onclick=e=>{e.preventDefault();showGallery(true);};
function showParticles(origin=null){
 particleReturn=origin!==null;
 activatePage('particles');
 $('fieldBack').textContent=particleReturn?'返回我的成品':'返回圆盘';
 openParticleRoom(origin);
 $('particles').scrollIntoView({block:'start'});$('particleTitle').focus({preventScroll:true});
}
$('galleryParticles').onclick=()=>showParticles();
$('navParticles').onclick=e=>{e.preventDefault();showParticles();};
$('fieldBack').onclick=()=>{
 if(particleReturn&&phase===4){
  activatePage('studio');render();$('studio').scrollIntoView({block:'start'});$('action').focus({preventScroll:true});return;
 }
 showGallery(true);
};
$('finishGallery').onclick=()=>showGallery(true);


function tone(index=0,finished=false){
 if(muted)return;
 try{
  audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();
  const notes=finished?[392,493.88,587.33]:[[196,293.66,349.23,440][index%4]];
  notes.forEach((f,i)=>{
   const a=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+i*.115;
   a.type='sine';a.frequency.setValueAtTime(f*1.025,t);a.frequency.exponentialRampToValueAtTime(f,t+.17);
   g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.09,t+.026);g.gain.exponentialRampToValueAtTime(.0001,t+.65);
   a.connect(g);g.connect(audio.destination);a.start(t);a.stop(t+.68);
  });
 }catch{}
}
function makeGlyphs(group){
 const result=new T.Group();group.updateMatrixWorld(true);
 const colors=['#ac5968','#567e73','#94602f','#9f668e'];
 const glyph=['印','捏','镶','滚'];
 colors.forEach((color,k)=>{
  const c=document.createElement('canvas');c.width=c.height=64;
  const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.font='bold 52px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(glyph[k],32,34);
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
  const points=[];const v=new T.Vector3();
  let m=0;
  group.traverse(node=>{
   if(!node.isMesh)return;
   const p=node.geometry.attributes.position;const step=Math.max(1,Math.floor(p.count/11));
   for(let i=(m+k*7)%step;i<p.count;i+=step){
    if((i+3*k+m)%7===0)continue;
    v.fromBufferAttribute(p,i).applyMatrix4(node.matrixWorld);
    points.push(v.x+(Math.sin(i*4.1+m)*.036),v.y+(Math.cos(i+3*k)*.031),v.z+.018*k);
   }m++;
  });
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(points,3));
  result.add(new T.Points(geo,new T.PointsMaterial({size:.057,map:tex,transparent:true,opacity:.42,depthWrite:false,alphaTest:.06})));
 });
 return result;
}
function shadow(){
 const c=document.createElement('canvas');c.width=c.height=128;
 const ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,18,64,64,64);
 g.addColorStop(0,'#1f100cba');g.addColorStop(.53,'#25150db5');g.addColorStop(.80,'#301b1266');g.addColorStop(1,'#39201800');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
 const m=new T.Mesh(new T.PlaneGeometry(5.45,5.24),new T.MeshBasicMaterial({map:new T.CanvasTexture(c),transparent:true,depthWrite:false}));
 m.rotation.x=-Math.PI/2;m.position.set(.13,-.028,.18);scene.add(m);
}
function init(){
 renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.16;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 holder.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','可拖动旋转的三维面塑');renderer.domElement.setAttribute('role','img');
 scene=new T.Scene();camera=new T.OrthographicCamera(-3,3,2.5,-2.5,.1,35);
 scene.add(new T.HemisphereLight(0xfff1dd,0xa27759,1.94));
 const key=new T.DirectionalLight(0xffe4ca,2.65);key.position.set(-4,7,4.6);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-3,right:3,top:4,bottom:-3});key.shadow.normalBias=.014;scene.add(key);
 const rim=new T.DirectionalLight(0xccddff,.80);rim.position.set(4,4,-4);scene.add(rim);
 shadow();
 turntable=new T.Group();scene.add(turntable);
 models=builders.map((build,i)=>{
  const group=new T.Group(),parts=Array.from({length:4},()=>new T.Group());group.add(...parts);build(parts);
  group.add(parts[0].getObjectByName('paper'));
  const ghosts=parts.map(makeGlyphs);group.add(...ghosts);
  const lumps=new T.Group();
  const lumpColors=mounts[i].colors;
  lumpColors.forEach((col,j)=>ball(lumps,col,(j-1)*.70,.260+(j===1?.06:0),.28-j*.13,.35,.19+(j===1?.060:0),.28));
  group.add(lumps);turntable.add(group);group.visible=false;
  const anchors=attachmentAnchors[i].map(point=>new T.Vector3(...point));
  const attachments=parts[2].children.map(child=>{
   const center=new T.Box3().setFromObject(child).getCenter(new T.Vector3());
   const distances=anchors.map(anchor=>anchor.distanceToSquared(center));
   return distances.indexOf(Math.min(...distances));
  });
  const roll=ball(group,lumpColors[2],0,.27,1.62,.34,.13,.16);
  roll.visible=false;
  return {group,parts,ghosts,lumps,roll,anchors,attachments};
 });
 new ResizeObserver(resize).observe(holder);resize();

}
function setCamera(width,height){
 const aspect=width/Math.max(1,height);
 const half=2.115*Math.max(1,1.09/aspect);
 camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;
 camera.position.set(.12,7.6+pitch,7.1);camera.lookAt(0,.02,0);camera.updateProjectionMatrix();
}
function resize(){
 if(!renderer)return;
 const w=holder.clientWidth,h=holder.clientHeight;if(!w||!h)return;
 renderer.setSize(w,h,false);setCamera(w,h);draw();
}
function draw(){if(renderer){turntable.rotation.y=yaw;renderer.render(scene,camera);}}
function syncModel(){
 if(!renderer)return;
 current=models[selected];models.forEach(m=>m.group.visible=m===current);
 current.parts.forEach((part,i)=>{
  part.visible=phase<0||phase>i;
  part.scale.setScalar(1);part.position.set(0,0,0);
  part.children.forEach(child=>child.visible=true);
  current.ghosts[i].visible=phase>=0&&phase<=i;
 });
 current.lumps.visible=phase===0;
 current.lumps.scale.setScalar(1);
 current.roll.visible=false;
 draw();
}
function animate(now){
 if($('studio').hidden){raf=0;return;}
 const t=(now-popAt)/650;
 if(popping){
  const p=Math.min(1,t*1.8);
  popping.scale.setScalar(1-.13*Math.exp(-p*4)*Math.cos(p*10));
  if(p===1){popping.scale.setScalar(1);popping=null;}
 }
 if(phase>=0&&phase<4){
  particles.forEach((g,i)=>{
   g.position.y=Math.sin(now*.002+i)*.035;
   g.children.forEach((p,k)=>p.material.opacity=.24+.12*Math.sin(now*.003+i+k));
  });
 }
 draw();raf=0;
 if((popping||phase>=0&&phase<4)&&!reduced)raf=requestAnimationFrame(animate);
}
function animateChange(step){
 if(!renderer||reduced)return;
 if(step>=0){popping=current.parts[step];popAt=performance.now();}
 particles=current.ghosts;
 if(!raf)raf=requestAnimationFrame(animate);
}
function showBurst(){
 if(reduced)return;
 const burst=$('burst');burst.replaceChildren();
 for(let i=0;i<10;i++){
  const a=i*2.399,r=45+i*9;
  const s=document.createElement('span');s.textContent=i%2?'✦':'·';s.style.setProperty('--x',Math.cos(a)*r+'px');s.style.setProperty('--y',Math.sin(a)*r+'px');burst.append(s);
 }
}
function projectedSlots(){
 if(!renderer||!holder.clientWidth||!holder.clientHeight)return undefined;
 turntable.updateMatrixWorld(true);
 const width=holder.clientWidth,height=holder.clientHeight,stageHeight=stage.clientHeight;
 const inset=matchMedia('(max-width: 620px)').matches?10:16;
 const slots=current.anchors.map(anchor=>{
  const clip=anchor.clone().applyMatrix4(turntable.matrixWorld).project(camera);
  const x=((clip.x+1)*.5*width-inset)/(width-2*inset)*100;
  const y=(holder.offsetTop+(1-clip.y)*.5*height-stageHeight*.36)/(stageHeight*.54)*100;
  return [Math.max(22,Math.min(78,x)),Math.max(9,Math.min(74,y))];
 });
 for(let i=0;i<slots.length;i++)for(let j=0;j<i;j++){
  if(Math.hypot(slots[i][0]-slots[j][0],slots[i][1]-slots[j][1])<11)return undefined;
 }
 return slots;
}
function render(){
 const item=mounts[selected],active=phase>=0&&phase<4;
 gesture?.dispose();gesture=null;
 stage.dataset.theme=item.key;
 stage.classList.toggle('working',active);
 $('stageName').textContent=item.name;$('stageGenre').textContent=item.genre;
 $('mode').textContent=phase===4?'作品已完成':active?'塑形进行中':'成品预览';
 $('gesture').textContent=active?'跟随工作台上的引导操作':renderer?'拖动纸盘 · 旋转观赏':'成品参考图';
 $('counter').textContent=Math.max(0,phase)+' / 4';
 $('instructionTitle').textContent=phase===4?'你完成了'+item.name:active?item.steps[phase][0]:'先看成品';
 $('instructionCopy').textContent=phase===4?'把这件成品化为粒子，用鼠标或指尖拨动它。':active?item.steps[phase][2]:item.story;
 $('action').textContent=phase===4?'把成品化为粒子':active?'定位到操作工具':'开始制作';
 $('action').classList.toggle('utility',active);
 $('viewReset').hidden=active||!renderer;
 $('progress').hidden=!active;
 $('back').hidden=phase<=0;$('restart').hidden=phase<0;$('save').hidden=phase!==4;$('finishGallery').hidden=phase!==4;
 $('steps').innerHTML=item.steps.map(([title,detail],i)=>'<li '+(i===phase?'class="current" aria-current="step"':i<phase?'class="done"':'')+'><span class="step-num">'+(i<phase?'✓':'0'+(i+1))+'</span><div><strong>'+title+'</strong><small>'+detail+'</small></div></li>').join('');
 $('announce').textContent=item.name+'，'+$('mode').textContent+(active?'，'+item.steps[phase][0]:'');
 syncModel();resize();
 if(!renderer){
  const artPath='art/'+item.key;
  const previous=active?(phase===0?'art/paper':artPath+'-s'+phase):artPath;
  const paperView=document.createElement('img');
  paperView.alt='';paperView.className='relief-prev';paperView.src=previous+'.webp';
  holder.replaceChildren(paperView);
  fallbackArt=null;
  if(active){
   fallbackArt=document.createElement('img');
   fallbackArt.alt='';fallbackArt.className='relief-next';
   fallbackArt.src=(phase===3?artPath:artPath+'-s'+(phase+1))+'.webp';
   holder.append(fallbackArt);
  }
  holder.classList.add('fallback');
  holder.setAttribute('aria-label',active?'面塑操作台':item.name+'成品参考图');holder.setAttribute('role','img');$('viewReset').hidden=true;
 }
 if(active){
  animateChange(-1);
  updateCraft(0);
  gesture=mountGesture($('gestureLayer'),phase,item,{
   update:updateCraft, complete:finishStep, tick:()=>tone(phase), art:!renderer, slots:phase===2?projectedSlots():undefined
  });
 }
}
function updateCraft(progress,docked=new Set()){
 const value=Math.round(progress*100);
 $('progressText').textContent=value+'%';$('progressMeter').value=value;
 if(!renderer){if(fallbackArt)fallbackArt.style.opacity=progress;return;}
 if(phase<0||phase>=4)return;
 const part=current.parts[phase],children=part.children;
 if(phase===0){
  current.lumps.visible=progress<.73;
  current.lumps.scale.set(1+progress*.28,1-progress*.61,1+progress*.28);
  part.visible=progress>=.73;
  part.scale.set(.80+.20*progress,.48+.52*progress,.80+.20*progress);
 }
 if(phase===1){
  part.visible=progress>.01;
  part.scale.set(.88+.12*progress,.31+.69*progress,.48+.52*progress);
  part.position.y=.105*(1-progress);
 }
 if(phase>=2){
  part.visible=progress>.01;
  const count=Math.round(children.length*progress);
  children.forEach((child,i)=>child.visible=phase===2?docked.has(current.attachments[i]):i<count);
 }
 if(phase===3){
  current.roll.visible=progress<1;
  current.roll.scale.set(.34+progress*.81,.13-progress*.104,.16-progress*.104);
 }
 current.ghosts[phase].visible=progress<.76;
 draw();
}
function finishStep(){
 const last=phase;phase++;render();tone(last,phase===4);animateChange(last);showBurst();
 if(gesture)gesture.focus();
 else $('action').focus({preventScroll:true});
}
$('choices').innerHTML=mounts.map(({name,key,type})=>'<button class="exhibit" aria-label="制作'+name+'，'+type+'"><img src="art/'+key+'.webp" alt=""><span>'+name+'</span></button>').join('');
exhibitButtons().forEach((button,i)=>button.onclick=()=>openStudio(i));
layoutOrbit();
$('action').onclick=()=>{
 if(phase===4){tone(3);showParticles(selected);return;}
 if(phase<0){phase=0;render();tone(0);}
 gesture?.focus();
};
$('back').onclick=()=>{if(phase>0){phase--;popping=null;render();gesture?.focus();}};
$('restart').onclick=()=>{phase=0;popping=null;yaw=.06;pitch=0;render();gesture?.focus();};
$('viewReset').onclick=()=>{yaw=.06;pitch=0;resize();};
$('sound').onclick=()=>{
 muted=!muted;$('sound').setAttribute('aria-pressed',!muted);
 $('sound').innerHTML='<span aria-hidden="true">♫</span> 音效'+(muted?'关':'开');tone(2);
};
$('save').onclick=()=>{
 if(phase!==4)return;
 const item=mounts[selected];
 if(!renderer){const a=document.createElement('a');a.href='art/'+item.key+'.webp';a.download=item.name+'-面塑作品.webp';a.click();return;}
 const src=renderer.domElement,canvas=document.createElement('canvas');
 canvas.width=src.width;canvas.height=src.height;
 const ctx=canvas.getContext('2d'),bg=ctx.createLinearGradient(0,0,canvas.width,canvas.height);
 bg.addColorStop(0,'#86674c');bg.addColorStop(1,'#332416');ctx.fillStyle=bg;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(src,0,0);
 ctx.fillStyle='#f1d59c';const fontSize=Math.round(canvas.width*.066);ctx.font='bold '+fontSize+'px serif';ctx.fillText(mounts[selected].name,canvas.width*.06,canvas.height*.91);
 ctx.font=Math.round(fontSize*.42)+'px sans-serif';ctx.fillText('金陵面塑工坊',canvas.width*.06,canvas.height*.96);
 canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=item.name+'-面塑作品.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
};
let drag=null;
holder.onpointerdown=e=>{if(!renderer||e.button!==0||drag||(phase>=0&&phase<4))return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,yaw,pitch,moved:false};holder.setPointerCapture(e.pointerId);};
holder.onpointermove=e=>{
 if(!drag||drag.id!==e.pointerId)return;
 const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
 if(Math.hypot(dx,dy)>6)drag.moved=true;if(!drag.moved)return;
 yaw=drag.yaw+dx*.013;pitch=Math.max(-2,Math.min(2.9,drag.pitch-dy*.025));
 setCamera(holder.clientWidth,holder.clientHeight);draw();
};
holder.onpointerup=e=>{if(drag?.id===e.pointerId)drag=null;};
holder.onpointercancel=holder.onlostpointercapture=()=>{drag=null;};
holder.tabIndex=0;
holder.addEventListener('keydown',e=>{
 if(!renderer||(phase>=0&&phase<4)||!['ArrowLeft','ArrowRight'].includes(e.key))return;
 e.preventDefault();
 yaw+=e.key==='ArrowLeft'?-.25:.25;draw();
});

if(window.location.hash==='#particles')showParticles();
