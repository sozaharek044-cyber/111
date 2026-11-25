import * as T from './three.js';
import {randomSequence,sampleModel} from './particle-samples.js';

const vertexShader=`
 attribute vec3 pigment;
 attribute float seed;
 attribute float fieldPoint;
 uniform vec2 view;
 uniform float pixelRatio;
 uniform float clock;
 varying vec3 shade;
 varying float opacity;
 varying float sparkle;
 void main() {
   float depth = clamp(position.z, -1.5, 1.5);
   float perspective = 1.0 + depth * 0.12;
   float twinkle = 0.81 + 0.19 * sin(clock*2.2 + seed*158.0);
   gl_Position = vec4(position.xy * view * perspective, 0.0, 1.0);
   sparkle = pow(seed, 14.0);
   gl_PointSize = (1.43 + seed*.88 + sparkle*2.65) * pixelRatio * perspective * fieldPoint;
   shade = pigment * (1.05+depth*.23) * twinkle;
   opacity = (0.72 + seed*.20 + sparkle*.12) * (0.94+depth*.17);
 }`;
const fragmentShader=`
 varying vec3 shade;
 varying float opacity;
 varying float sparkle;
 void main() {
   float r = length(gl_PointCoord - 0.5) * 2.0;
   if(r > 1.0) discard;
   float core = 1.0-smoothstep(0.12, 0.85, r);
   float halo = (1.0-r)*sparkle*.72;
   gl_FragColor = vec4(mix(shade, vec3(0.96,0.96,1.0), core*sparkle*.43), (core+halo)*opacity);
 }`;

function createRenderer(surface,positions,pigment,seeds,count){
 const renderer=new T.WebGLRenderer({alpha:true,antialias:false,powerPreference:'low-power'});
 renderer.setClearColor(0x000000,0);
 const geometry=new T.BufferGeometry();
 const positionAttr=new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage);
 const pigmentAttr=new T.BufferAttribute(pigment,3).setUsage(T.DynamicDrawUsage);
 geometry.setAttribute('position',positionAttr);
 geometry.setAttribute('pigment',pigmentAttr);
 geometry.setAttribute('seed',new T.BufferAttribute(seeds,1));
 geometry.setAttribute('fieldPoint',new T.BufferAttribute(Float32Array.from(seeds,(_,i)=>i<count?1:.58),1));
 const uniforms={view:{value:new T.Vector2()},pixelRatio:{value:1},clock:{value:0}};
 const material=new T.ShaderMaterial({uniforms,vertexShader,fragmentShader,transparent:true,depthWrite:false,depthTest:false,toneMapped:false});
 const scene=new T.Scene(),camera=new T.Camera();
 const points=new T.Points(geometry,material);
 points.frustumCulled=false;scene.add(points);
 renderer.domElement.setAttribute('aria-hidden','true');
 surface.replaceChildren(renderer.domElement);
 return {
  resize(width,height,unit){
   const ratio=Math.min(window.devicePixelRatio||1,2);
   renderer.setPixelRatio(ratio);renderer.setSize(width,height,false);
   uniforms.view.value.set(2*unit/width,2*unit/height);
   uniforms.pixelRatio.value=ratio;
  },
  colorsChanged(){pigmentAttr.needsUpdate=true;},
  draw(t){
   positionAttr.needsUpdate=true;uniforms.clock.value=t;renderer.render(scene,camera);
  }
 };
}

function createCanvasRenderer(surface,positions,pigment,seeds,count){
 const canvas=document.createElement('canvas');
 const ctx=canvas.getContext('2d');
 if(!ctx)throw new Error('Canvas unavailable');
 canvas.setAttribute('aria-hidden','true');
 surface.replaceChildren(canvas);
 const rgb=new Array(seeds.length);
 let width=1,height=1,unit=1;
 return {
  resize(w,h,pixels){
   const ratio=Math.min(window.devicePixelRatio||1,1.7);
   width=w;height=h;unit=pixels;
   canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);
   ctx.setTransform(ratio,0,0,ratio,0,0);
  },
  colorsChanged(){
   for(let i=0;i<seeds.length;i++){
    const p=i*3;
    rgb[i]='rgb('+Math.round(pigment[p]*255)+','+Math.round(pigment[p+1]*255)+','+Math.round(pigment[p+2]*255)+')';
   }
  },
  draw(){
   ctx.clearRect(0,0,width,height);
   for(let i=0;i<seeds.length;i++){
    if(i%3===0)continue;
    const p=i*3,z=positions[p+2],perspective=1+z*.12,scale=unit*perspective;
    const x=width*.5+positions[p]*scale,y=height*.5-positions[p+1]*scale;
    const size=(.72+seeds[i]*.86+(seeds[i]>.94?1.5:0))*perspective*(i<count?1:.56);
    ctx.globalAlpha=Math.min(1,(i<count?.88:.67)+z*.24);
    ctx.fillStyle=rgb[i];
    ctx.fillRect(x-size*.5,y-size*.5,size,size);
   }
  }
 };
}

const layouts={
 wide:[
  [[0,.022,1.35]],
  [[-.59,.045,1.01],[.60,-.04,1.0]],
  [[-.81,-.12,.78],[0,.21,.87],[.83,-.10,.77]],
  [[-.52,.33,.70],[.57,.33,.71],[-.62,-.30,.72],[.50,-.28,.75]]
 ],
 narrow:[
  [[0,.025,1.32]],
  [[-.25,.34,.74],[.25,-.33,.74]],
  [[0,.37,.69],[-.31,-.22,.63],[.32,-.24,.63]],
  [[-.31,.32,.55],[.31,.32,.55],[-.31,-.25,.55],[.31,-.25,.55]]
 ]
};

export function makeParticleField(surface,onCount){
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const count=window.matchMedia('(max-width: 655px)').matches?13600:22100;
 const ambient=620,total=count+ambient;
 const rng=randomSequence(67489);
 const positions=new Float32Array(total*3),velocity=new Float32Array(positions.length);
 const pigment=new Float32Array(positions.length),materials=new Float32Array(positions.length);
 const seeds=Float32Array.from({length:total},rng);
 const pointTargets=new Float32Array(count*3),flowTargets=new Float32Array(count*3);
 const origins=new Float32Array(count*3);
 const cached=new Map();
 let sourceList=[],sourceLayout,shapeCounts=[],w=1,h=1,unit=1,renderer;
 let formation='shape',tool='push',radius=3,awake=false,paused=reduced;
 let point=null,frame=0,previous=0,clock=0,transition=0,seeded=false;
 const yaw=.34,pitch=.19;

 try{renderer=createRenderer(surface,positions,pigment,seeds,count);}
 catch{renderer=createCanvasRenderer(surface,positions,pigment,seeds,count);}

 function resize(){
  w=surface.clientWidth||1;h=surface.clientHeight||1;
  const aspect=w/h;
  unit=Math.min(w/(aspect>=1.08?2.66:1.58),h/1.8);
  renderer.resize(w,h,unit);
  if(sourceList.length){placeSources();makeFlow();recolor();}
  if(awake)render();
 }

 function placeSources(){
  sourceLayout=layouts[w/h>=1.08?'wide':'narrow'][sourceList.length-1];
  let offset=0;
  shapeCounts.forEach((n,k)=>{
   const [x,y,scale]=sourceLayout[k];
   for(let i=offset;i<offset+n;i++){
    const p=i*3;origins[p]=x;origins[p+1]=y;origins[p+2]=scale;
   }
   offset+=n;
  });
 }

 function makeFlow(){
  const ratio=w/h;
  const major=ratio<.85?.73:ratio<1.08?.89:1.28;
  const random=randomSequence(49116);
  for(let i=0;i<count;i++){
   const p=i*3,jitter=random(),spiral=i%4;
   const theta=random()*Math.PI*2;
   const thickness=(random()+random()+random()-1.5)*(.12+.1*Math.sin(2*theta)**2);
   const ring=.52+jitter*.40+(spiral-1.5)*.076+thickness;
   const x=major*ring*Math.cos(theta);
   const y=.52*ring*Math.sin(theta)+Math.sin(theta*2+spiral*.3)*.12;
   const wave=(spiral-1.5)*.132;
   flowTargets[p]=x;
   flowTargets[p+1]=y+x*.28+wave+thickness*.45;
   flowTargets[p+2]=.69*ring*Math.sin(theta)+wave*.64;
   if(i%17===0){
    const lift=random()*1.18+.5;
    flowTargets[p]*=lift;flowTargets[p+1]*=lift;
   }
  }
 }

 function recolor(){
  const tint=formation==='flow'?.48:.094;
  for(let i=0;i<count;i++){
   const p=i*3,fade=(Math.sin(seeds[i]*22)+1)*.5;
   const warm=formation==='flow'?(Math.sin(flowTargets[p]*2.8+flowTargets[p+1]*4.65)+1)*.43+fade*.14:fade;
   pigment[p]=materials[p]*(1-tint)+tint*(.30+warm*.69);
   pigment[p+1]=materials[p+1]*(1-tint)+tint*(.58+warm*.30);
   pigment[p+2]=materials[p+2]*(1-tint)+tint*(1-warm*.21);
  }
  renderer.colorsChanged();
 }

 function setSources(sourceIndices,{reset=false}={}){
  if(!sourceIndices.length)return;
  sourceList=[...sourceIndices];
  const countPerModel=Math.floor(count/sourceList.length);
  shapeCounts=sourceList.map((_,i)=>i===sourceList.length-1?count-countPerModel*i:countPerModel);
  let offset=0;
  sourceList.forEach((index,k)=>{
   if(!cached.has(index))cached.set(index,sampleModel(index,count));
   const {points,colors}=cached.get(index);
   const length=shapeCounts[k]*3;
   pointTargets.set(points.subarray(0,length),offset);
   materials.set(colors.subarray(0,length),offset);
   offset+=length;
  });
  for(let i=count;i<total;i++){
   const p=i*3,r=seeds[i];
   pigment[p]=.19+r*.30;pigment[p+1]=.30+r*.31;pigment[p+2]=.48+r*.36;
  }
  placeSources();makeFlow();recolor();
  if(!seeded||reset){
   velocity.fill(0);seeded=true;
   for(let i=0;i<count;i++){
    const p=i*3,scale=origins[p+2];
    positions[p]=origins[p]+pointTargets[p]*scale;
    positions[p+1]=origins[p+1]+pointTargets[p+1]*scale;
    positions[p+2]=pointTargets[p+2]*scale;
   }
  }
  onCount(count);
  if(awake)render();
 }

 function render(){if(seeded)renderer.draw(clock);}
 function tick(now){
  frame=0;
  if(!awake||document.hidden)return;
  const dt=previous?Math.max(.25,Math.min(2.3,(now-previous)/16.667)):1;
  previous=now;
  if(!paused)clock+=dt/60;
  const a=yaw+Math.sin(clock*.60)*.20;
  const b=pitch+Math.sin(clock*.46)*.06;
  const cosY=Math.cos(a),sinY=Math.sin(a),cosX=Math.cos(b),sinX=Math.sin(b);
  const radiusPixels=27+radius*14;
  const spread=radiusPixels/unit;
  const friction=Math.pow(.83,dt);
  transition+=(Number(formation==='flow')-transition)*.054*dt;
  const morph=transition;
  for(let i=0;i<count;i++){
   const p=i*3,scale=origins[p+2];
   const sx=pointTargets[p]*scale,sy=pointTargets[p+1]*scale,sz=pointTargets[p+2]*scale;
   const x=sx*cosY+sz*sinY;
   const qz=sz*cosY-sx*sinY;
   const y=sy*cosX-qz*sinX,z=qz*cosX+sy*sinX;
   const fx=flowTargets[p];
   const drift=paused?0:Math.sin(clock*2.1+seeds[i]*19)*.014;
   const tx=(x+origins[p])*(1-morph)+fx*morph;
   const ty=(y+origins[p+1])*(1-morph)+(flowTargets[p+1]+Math.sin(fx*2.5+clock*1.9)*.075)*morph;
   const tz=z*(1-morph)+flowTargets[p+2]*morph;
   let dx=(tx-positions[p])*.033,dy=(ty-positions[p+1])*.033,dz=(tz-positions[p+2])*.027;
   if(point){
    const perspective=1+positions[p+2]*.12;
    const fx=positions[p]*perspective-point.x,fy=positions[p+1]*perspective-point.y;
    const d2=fx*fx+fy*fy;
    if(d2<spread*spread){
     const distance=Math.sqrt(d2)||.0001;
     const falloff=1-distance/spread;
     const force=(point.held?.035:.021)*falloff*falloff;
     const nx=fx/distance,ny=fy/distance;
     if(tool==='swirl'){dx+=(-ny+nx*.23)*force*1.65;dy+=(nx+ny*.23)*force*1.65;dz+=falloff*.004;}
     else if(tool==='pull'){dx-=nx*force;dy-=ny*force;dz+=falloff*.005;}
     else {dx+=nx*force;dy+=ny*force;dz-=falloff*.009;}
     dx+=point.vx*falloff*.045;dy+=point.vy*falloff*.045;
    }
   }
   velocity[p]=velocity[p]*friction+dx*dt;
   velocity[p+1]=velocity[p+1]*friction+dy*dt;
   velocity[p+2]=velocity[p+2]*friction+dz*dt;
   positions[p]+=velocity[p]*dt;
   positions[p+1]+=velocity[p+1]*dt+drift*.05;
   positions[p+2]+=velocity[p+2]*dt;
  }
  for(let i=count;i<total;i++){
   const p=i*3,r=seeds[i],orbit=r> .63;
   const phase=i*2.39996+clock*(.035+r*.044);
   const dist=.34+r*r*1.1;
   positions[p]=Math.cos(phase)*dist*(orbit?1.25:Math.max(1.65,w/unit*.64));
   positions[p+1]=Math.sin(phase)*dist*(orbit?.46:1.17)+(orbit?positions[p]*.27:0);
   positions[p+2]=orbit?.40*r-.35:-.78;
  }
  if(point){point.vx*=.78;point.vy*=.78;}
  render();schedule();
 }

 function schedule(){
  if(awake&&!document.hidden&&!frame)frame=requestAnimationFrame(tick);
 }
 function impulse(center,strength,local){
  if(!seeded)return;
  for(let i=0;i<count;i++){
   const p=i*3,z=positions[p+2];
   const perspective=1+z*.12;
   const x=positions[p]*perspective-center.x,y=positions[p+1]*perspective-center.y;
   const d=Math.hypot(x,y);
   const range=(27+radius*14)/unit*1.8;
   if(local&&d>=range)continue;
   const force=strength*(.35+seeds[i])*(local?1-d/range:1);
   const angle=d>.001?Math.atan2(y,x):seeds[i]*6.2832;
   velocity[p]+=Math.cos(angle)*force;
   velocity[p+1]+=Math.sin(angle)*force;
   velocity[p+2]+=(seeds[i]-.43)*force*1.55;
  }
 }

 function setPointer(x,y,held){
  const xx=(x-w*.5)/unit,yy=(h*.5-y)/unit;
  point={x:xx,y:yy,held,vx:point?Math.max(-.4,Math.min(.4,xx-point.x)):0,
   vy:point?Math.max(-.4,Math.min(.4,yy-point.y)):0};
 }
 document.addEventListener('visibilitychange',()=>{
  previous=0;
  if(!document.hidden)schedule();
 });
 new ResizeObserver(()=>{if(awake)resize();}).observe(surface);
 return {
  show(){awake=true;previous=0;resize();schedule();},
  hide(){awake=false;cancelAnimationFrame(frame);frame=0;point=null;previous=0;},
  setSources,
  setFormation(value){
   formation=value;recolor();
   if(reduced)transition=Number(formation==='flow');
  },
  setTool(value){tool=value;},
  setRadius(value){radius=value;},
  setPause(next){paused=next;},
  press(){if(point)impulse(point,reduced?.05:.13,true);},
  scatter(){impulse({x:0,y:0},reduced?.07:.17,false);},
  gather(){velocity.fill(0);point=null;},
  setPointer,
  clearPointer(){point=null;}
 };
}
