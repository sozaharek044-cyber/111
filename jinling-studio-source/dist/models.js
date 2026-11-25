import * as T from './three.js';

const grain=new T.TextureLoader().load('./grain.png');
grain.wrapS=grain.wrapT=T.RepeatWrapping;
grain.repeat.set(3,3);
const sphere=new T.SphereGeometry(1,26,18);
sphere.userData.shared=true;
const palette=new Map();
function material(color,paper=false){
 const key=color+(paper?'p':'');
 if(!palette.has(key)){
  palette.set(key,new T.MeshStandardMaterial({color,roughness:paper?.94:.61,bumpMap:grain,bumpScale:paper?.018:.013}));
 }
 return palette.get(key);
}
function mesh(parent,geometry,color,paper=false){
 const object=new T.Mesh(geometry,material(color,paper));
 object.castShadow=true;object.receiveShadow=true;parent.add(object);
 return object;
}
export function ball(parent,color,x,y,z,sx,sy=sx,sz=sx){
 const object=mesh(parent,sphere,color);
 object.position.set(x,y,z);object.scale.set(sx,sy,sz);return object;
}
export function disc(parent,color,x,y,z,rt,rb,h){
 const object=mesh(parent,new T.CylinderGeometry(rt,rb,h,80),color);
 object.position.set(x,y,z);return object;
}
function dot(parent,x,y,h,sx,sy,depth,color,angle=0){
 const object=ball(parent,color,x,h,-y,sx,depth,sy);object.rotation.y=angle;return object;
}
function doughPath(parent,coordinates,r,color){
 const points=coordinates.map(([x,y,h])=>new T.Vector3(x,h,-y));
 const path=new T.CatmullRomCurve3(points);
 return mesh(parent,new T.TubeGeometry(path,Math.max(8,points.length*5),r,8,false),color);
}
function shape(parent,outline,x,y,h,color,depth=.09,edge=.033){
 const g=new T.ExtrudeGeometry(outline,{depth,bevelEnabled:true,bevelSegments:3,bevelThickness:edge,bevelSize:edge,curveSegments:14,steps:1});
 g.rotateX(-Math.PI/2);
 const object=mesh(parent,g,color);object.position.set(x,h,-y);return object;
}
function slab(parent,x,y,h,w,d,color,angle=0,depth=.1,corner=.075){
 const s=new T.Shape(),a=w*.5,b=d*.5,m=corner;
 s.moveTo(-a+m,-b);s.lineTo(a-m,-b);s.quadraticCurveTo(a,-b,a,-b+m);
 s.lineTo(a,b-m);s.quadraticCurveTo(a,b,a-m,b);s.lineTo(-a+m,b);
 s.quadraticCurveTo(-a,b,-a,b-m);s.lineTo(-a,-b+m);s.quadraticCurveTo(-a,-b,-a+m,-b);
 const object=shape(parent,s,x,y,h,color,depth,.024);object.rotation.y=angle;return object;
}
function circleLine(parent,x,y,h,r,t,color){
 const ring=mesh(parent,new T.TorusGeometry(r,t,8,76),color);
 ring.rotation.x=-Math.PI/2;ring.position.set(x,h,-y);return ring;
}
const ivory=0xf4e9d6,peach=0xe8a7ad,linen=0xe7c9a0,jade=0x518f78,darkJade=0x336a62,
 rose=0xb96062,bronze=0xad7555,tea=0x887461,ochre=0xd5914f,gold=0xf3c56f, sky=0x719cb5;
const grounds=[0xacc6be,0xb8c8c3,0x9fbfba,0xa9bfcc,0x8eb4b6,0xb0c5a9,0xb8bdad,0xb2a8c3,0xa5becb,0xaeb9c9];
function stampedPlate(base,index){
 const paper=new T.Group();paper.name='paper';base.add(paper);
 const rimProfile=[[0,.01],[1.46,.01],[1.73,.021],[2.02,.135],[2.081,.155],[2.095,.181],[2.06,.205],[1.98,.192],[1.70,.095],[1.58,.083],[0,.083]];
 const geometry=new T.LatheGeometry(rimProfile.map(([r,y])=>new T.Vector2(r,y)),128);
 const positions=geometry.attributes.position;
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),z=positions.getZ(i),r=Math.hypot(x,z);
  if(r<1.75)continue;
  const a=Math.atan2(z,x),p=Math.cos(56*a)*Math.min(1,(r-1.75)*3);
  positions.setXYZ(i,x*(1+p*.005),positions.getY(i)+p*.012,z*(1+p*.005));
 }
 geometry.computeVertexNormals();
 mesh(paper,geometry,0xf3e7d4,true);
 const field=disc(base,grounds[index],0,.091,0,1.76,1.70,.056);
 field.material=material(grounds[index],true);
 circleLine(base,0,0,.142,1.725,.012,ivory);
 return paper;
}
function flourPlateParts(index,build){
 return (parts)=>{stampedPlate(parts[0],index);build(parts);};
}
function blossom(petals,centers,x,y,r,h,pink=peach,offset=0,n=5){
 for(let i=0;i<n;i++){
  const a=i*Math.PI*2/n+offset;
  dot(petals,x+Math.cos(a)*r*.48,y+Math.sin(a)*r*.48,h,r*.48,r*.32,.066,i%3===0?ivory:pink,a);
 }
 dot(centers,x,y,h+.039,r*.24,r*.24,.061,gold);
 for(let k=0;k<7;k++){
  const a=k*Math.PI*2/7;dot(centers,x+Math.cos(a)*r*.18,y+Math.sin(a)*r*.18,h+.091,.019,.019,.018,0xfbe4a7);
 }
}
function sprig(parent,x,y,h,scale,angle){
 const c=Math.cos(angle),s=Math.sin(angle);
 const path=[[-.27,0],[0,0],[.25,.018]].map(([dx,dy])=>[x+(c*dx-s*dy)*scale,y+(s*dx+c*dy)*scale,h]);
 doughPath(parent,path,.017,jade);
 for(let k=0;k<3;k++){
  const u=(k-1)*.17*scale;
  dot(parent,x+c*u,y+s*u,h+.019,.115*scale,.042*scale,.030,k%2?jade:0x729d77,angle+(k%2?-.66:.66));
 }
}
function waves(parent,y,h,color,amount=5){
 for(let k=0;k<amount;k++){
  const x=(k-(amount-1)*.5)*.48;
  doughPath(parent,[[x-.16,y+(k%2)*.08,h],[x-.02,y-.046+(k%2)*.08,h],[x+.14,y+.012+(k%2)*.08,h]],.024,color);
 }
}
function plum([base,body,parts,details]){
 doughPath(body,[[-1.1,-.94,.19],[-.66,-.65,.21],[-.07,-.23,.23],[.42,.27,.23],[.75,.7,.22],[.76,1.19,.20]],.094,0x825147);
 doughPath(body,[[-.14,-.28,.224],[-.46,.22,.21],[-.79,.52,.21],[-1.12,.7,.20]],.066,0x92564d);
 doughPath(body,[[.37,.22,.24],[.69,.20,.23],[1.07,.33,.23],[1.25,.64,.21]],.057,0x8f5950);
 doughPath(body,[[.55,.51,.24],[.38,.75,.23],[.17,1.16,.22]],.049,0x9c6158);
 const flowers=[[-1.02,.54,.31,.2],[-.62,.3,.27,1],[-.38,-.47,.28,.66],[.20,.93,.34,.3],[.53,.45,.38,.63],[.79,1.12,.27,1],[1.13,.48,.29,.8],[.74,-.03,.27,.5]];
 flowers.forEach(([x,y,r,a],i)=>blossom(parts,details,x,y,r,.285,i%2?0xe4a0b0:0xc97b91,a));
 [[-1.24,.80],[.08,1.36],[1.28,.75],[.81,1.36]].forEach(([x,y])=>dot(details,x,y,.238,.095,.064,.055,0xc86f8e,.65));
 sprig(details,-.8,-.77,.17,1.3,.94);sprig(details,.76,-.64,.17,1.05,.24);
}
function wallOutline(){
 const s=new T.Shape();
 s.moveTo(-1.29,0);s.lineTo(-.36,0);s.lineTo(-.36,.39);
 s.absarc(0,.39,.36,Math.PI,0,true);s.lineTo(.36,0);s.lineTo(1.29,0);s.lineTo(1.26,.85);s.lineTo(-1.26,.85);s.closePath();
 return s;
}
function roof(parent,x,y,h,width,color=darkJade){
 const s=new T.Shape();
 s.moveTo(-width/2,-.08);s.quadraticCurveTo(-width*.23,-.06,-width*.24,.21);
 s.quadraticCurveTo(0,.16,width*.24,.21);s.quadraticCurveTo(width*.23,-.06,width/2,-.08);
 s.quadraticCurveTo(0,-.27,-width/2,-.08);
 return shape(parent,s,x,y,h,color,.087,.03);
}
function gate([base,body,parts,details]){
 shape(body,wallOutline(),0,-1,.155,0xb4a396,.088,.036);
 slab(body,0,-1.08,.17,2.73,.18,0xc5b292);
 slab(body,0,-.16,.176,2.65,.18,0xa99b8b);
 slab(parts,0,.28,.196,1.69,.73,0xba8263);
 slab(parts,0,.84,.222,1.23,.48,0xba8467);
 roof(parts,0,.63,.321,2.18);roof(parts,0,1.06,.345,1.64,0x467d72);
 for(let row=0;row<4;row++)for(let k=0;k<8;k++){
  const y=-.91+row*.188,x=(k-3.5)*.302+(row%2)*.05;
  if(Math.abs(x)<.47&&y<-.24)continue;
  slab(details,x,y,.257,.235,.108,(k+row)%3===0?0xc7b39d:0xa9998b,0,.025,.018);
 }
 for(let k=-3;k<=3;k++){
  const x=k*.22;
  slab(details,x,.28,.306,.057,.38,0xe2ad7d,0,.026,.016);
 }
 for(let k=-1;k<=1;k++)slab(details,k*.25,.88,.345,.115,.22,0x714b41,0,.02,.02);
}
function soup([base,body,parts,details]){
 dot(body,0,0,.20,1.36,1.21,.094,darkJade);
 circleLine(body,0,0,.31,1.15,.065,jade);
 dot(body,0,0,.282,1.11,1.06,.056,0xbd8955);
 for(let j=0;j<13;j++){
  const a=j*2.399,r=.12+.058*j;
  const points=Array.from({length:11},(_,k)=>{
   const t=k/10*Math.PI*1.76;
   return [Math.cos(a)*r+Math.cos(t+a)*.25,Math.sin(a)*r+Math.sin(t+a)*.19,.368+Math.sin(t)*.02];
  });
  doughPath(parts,points,.025,j%2?ivory:linen);
 }
 [[-.62,.25,.25],[.31,.50,-.40],[.6,-.30,.38],[-.2,-.39,-.22]].forEach(([x,y,a])=>slab(parts,x,y,.348,.33,.30,0x9d575c,a,.085,.042));
 [[-.04,.60],[.68,.06],[-.53,-.46]].forEach(([x,y])=>dot(parts,x,y,.384,.15,.13,.063,0xd6a466,.2));
 for(let i=0;i<22;i++){
  const a=i*2.4,r=.16+(i%6)*.135;dot(details,Math.cos(a)*r,Math.sin(a)*r,.425,.048,.024,.026,i%3?jade:0x87b478,a);
 }
 circleLine(details,0,0,.351,1.168,.018,ivory);
}
function pagoda([base,body,parts,details]){
 slab(body,0,-1.05,.163,1.64,.29,0xb9a181);
 for(let j=0;j<6;j++){
  const y=-.81+j*.344,w=1.24-j*.126;
  slab(body,0,y,.18,w,.30,0xefddba,0,.077,.05);
  roof(parts,0,y+.145,.291,w+.27,j%2?jade:darkJade);
  for(const x of [-w*.255,0,w*.255]){
   dot(details,x,y-.013,.278,.045,.081,.025,0x8a6854);
  }
  for(const x of [-w*.46,w*.46])dot(details,x,y+.075,.327,.045,.049,.03,gold);
 }
 dot(details,0,1.31,.26,.092,.112,.062,ochre);
 sprig(details,-.98,-.61,.17,1.34,.7);sprig(details,1,-.48,.18,1.28,2.42);
}
function bridge([base,body,parts,details]){
 dot(body,0,-.23,.16,1.47,.74,.067,0x568d98);
 waves(body,-.78,.227,0xb9d0ca,5);waves(body,-.46,.23,0x8ebcb8,4);
 const s=new T.Shape();
 s.moveTo(-1.29,-.08);s.quadraticCurveTo(0,1.63,1.29,-.08);s.lineTo(.73,-.08);
 s.quadraticCurveTo(0,1.05,-.73,-.08);s.closePath();
 shape(body,s,0,-.12,.228,0xc7b399,.112,.039);
 const handrail=Array.from({length:11},(_,i)=>{
  const t=i*.1,x=(t-.5)*2.46,y=3.37*t*(1-t)-.13;
  if(i%2===1)dot(parts,x,y-.055,.367,.039,.11,.047,ivory);
  return [x,y,.38];
 });
 doughPath(parts,handrail,.045,linen);
 for(const x of [-1.12,1.15]){
  doughPath(parts,[[x,.02,.21],[x,.63,.23],[x*.95,.84,.23],[x*.8,.84,.23]],.032,tea);
  dot(details,x*.81,.70,.245,.127,.152,.071,rose);
  dot(details,x*.81,.83,.27,.092,.029,.045,gold);
  doughPath(details,[[x*.81,.61,.27],[x*.81,.52,.245],[x*.84,.48,.237]],.019,ochre);
 }
}
function duck([base,body,parts,details]){
 dot(body,0,0,.17,1.48,.96,.053,0xc7d9d0);
 dot(body,0,0,.258,1.06,.58,.133,0xe4b27b,.24);
 for(const sign of [-1,1]){
  dot(parts,sign*.16,sign*.30,.333,.66,.126,.096,0xd19b62,.38);
  dot(parts,sign*.57,-sign*.47,.293,.39,.18,.09,0xe5b686,-.62);
  dot(details,sign*.82,-sign*.61,.303,.18,.072,.051,0xf3d4a1,-.55);
 }
 for(let k=0;k<7;k++){
  const x=(k-3)*.175;
  doughPath(details,[[x-.06,-.26,.356],[x,.03,.396],[x+.08,.28,.382]],.016,0xae7751);
 }
 [[-.98,-.47,1.18],[.82,.47,2.64],[.89,-.31,.76]].forEach(([x,y,a])=>sprig(details,x,y,.234,1.05,a));
}
function buns([base,body,parts,details]){
 dot(body,0,0,.171,1.33,1.27,.067,0xba8856);circleLine(body,0,0,.24,1.25,.064,0xd3a673);
 [[-.48,-.31],[.54,-.29],[.01,.57]].forEach(([x,y])=>{
  dot(body,x,y,.251,.445,.42,.14,0xf3dfbb);
  for(let k=0;k<11;k++){
   const a=k*Math.PI*2/11;
   doughPath(parts,[[x+.34*Math.cos(a),y+.32*Math.sin(a),.315],[x+.22*Math.cos(a+.27),y+.21*Math.sin(a+.27),.364],[x+.065*Math.cos(a+.72),y+.06*Math.sin(a+.72),.402]],.021,k%2?ivory:0xe7c49a);
  }
  dot(details,x,y,.408,.104,.095,.039,0xf1cfa1);
 });
 for(let k=0;k<27;k++){
  const a=k*Math.PI*2/27;dot(details,1.252*Math.cos(a),1.252*Math.sin(a),.284,.048,.026,.019,linen,a);
 }
}
function osmanthus([base,body,parts,details]){
 dot(body,0,-.17,.16,1.42,.93,.049,0x6b8e78);
 const cakes=[[-.63,-.35,.27],[.56,-.28,-.26],[-.06,.56,.36]];
 cakes.forEach(([x,y,a],i)=>{
  slab(body,x,y,.204,.69,.58,i===2?0xf0c583:0xe1a152,a,.117);
  slab(parts,x,y,.337,.64,.53,i===2?0xf8d899:0xedb863,a,.058);
  for(let k=0;k<12;k++){
   const t=k*2.399,r=.045+k*.013;
   dot(details,x+Math.cos(t)*r,y+Math.sin(t)*r,.426,.025,.018,.023,k%5?gold:0xd48c45,t);
  }
 });
 sprig(details,-.77,.48,.18,1.45,1.5);sprig(details,.94,.45,.18,1.33,1.99);
}
function lotus([base,body,parts,details]){
 for(const [x,y,s,a] of [[-.76,-.22,.54,.45],[.68,-.54,.61,-.23],[.69,.57,.45,.36]]){
  dot(body,x,y,.195,s,s*.69,.078,0x71a181,a);
  for(let k=0;k<6;k++){
   const u=k*1.03;
   doughPath(details,[[x,y,.269],[x+Math.cos(u)*s*.32,y+Math.sin(u)*s*.23,.265],[x+Math.cos(u)*s*.70,y+Math.sin(u)*s*.5,.245]],.012,0x98b88c);
  }
 }
 doughPath(body,[[-.29,-.84,.191],[-.23,-.31,.221],[-.28,.26,.223]],.053,jade);
 doughPath(body,[[.34,-.64,.19],[.57,-.02,.206],[.7,.70,.213]],.037,jade);
 const petals=[[.43,.48,.245,0xdc91a6],[.28,.44,.303,0xefb0ba],[.14,.31,.37,0xf7c9c6]];
 petals.forEach(([r,lift,h,color],row)=>{
  for(let k=0;k<8;k++){
   const a=k*Math.PI/4+row*.31;
   dot(parts,-.26+Math.cos(a)*r,.35+Math.sin(a)*r,h,lift,.141,.056,color,a);
  }
 });
 dot(parts,.71,.96,.247,.15,.238,.062,0xd892a5,-.32);
 dot(details,-.26,.35,.415,.165,.165,.046,ochre);
 for(let k=0;k<11;k++){
  const a=k*2.399,r=.035+k*.009;dot(details,-.26+Math.cos(a)*r,.35+Math.sin(a)*r,.459,.029,.027,.022,gold);
 }
 waves(details,-.93,.149,0xc1d7d5,5);
}
function stones([base,body,parts,details]){
 const pebbles=[[-.65,.58,.44,.36,0xc48164,0xf3caa2,-.44], [.46,.62,.46,.35,0x718c9a,0xc4d2bd,.47],[-.74,-.47,.46,.37,0xb07a56,0xe3b688,.59],[.59,-.54,.47,.37,0x876272,0xd5a0a4,-.36],[.02,-.04,.44,.37,0x738e72,0xd2c798,.25]];
 for(const [x,y,sx,sy,dark,light,a] of pebbles){
  dot(body,x,y,.225,sx,sy,.119,dark,a);
  const cos=Math.cos(a),sin=Math.sin(a);
  for(let j=-2;j<=2;j++){
   const path=Array.from({length:12},(_,k)=>{
    const dx=(k/11-.5)*sx*1.62,dy=j*.082+Math.sin(dx*8+j*.7)*.037;
    const h=.222+.12*Math.sqrt(Math.max(.14,1-(dx/sx)**2-(dy/sy)**2));
    return [x+dx*cos-dy*sin,y+dx*sin+dy*cos,h+.012];
   });
   doughPath(j===2?details:parts,path,j%2?.017:.031,light);
  }
 }
}
export const builders=[plum,gate,soup,pagoda,bridge,duck,buns,osmanthus,lotus,stones].map((build,i)=>flourPlateParts(i,build));
