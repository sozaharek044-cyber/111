import {Box3, Color, Group, Vector3} from './three.js';
import {builders} from './models.js';

export function randomSequence(seed){
 let state=seed>>>0;
 return ()=>{
  state=(Math.imul(1664525,state)+1013904223)>>>0;
  return state/4294967296;
 };
}

export function sampleModel(index,count){
 const group=new Group();
 const parts=Array.from({length:4},()=>new Group());
 group.add(...parts);builders[index](parts);
 group.rotation.x=Math.PI/2;
 group.updateMatrixWorld(true);
 const bounds=new Box3().setFromObject(group);
 const center=bounds.getCenter(new Vector3());
 const size=bounds.getSize(new Vector3());
 const normalization=1/Math.max(size.x,size.y,size.z);
 const meshes=[];
 const vertices=[new Vector3(),new Vector3(),new Vector3()];
 const edgeA=new Vector3(),edgeB=new Vector3(),normal=new Vector3();
 const tint=new Color();
 const geometrySet=new Set();
 let surfaceArea=0;

 parts.forEach((part,partIndex)=>part.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const geometry=mesh.geometry,position=geometry.attributes.position;
  geometrySet.add(geometry);
  const indices=geometry.index?.array;
  const triangles=(indices?.length??position.count)/3;
  const trianglesArea=new Float64Array(triangles);
  let area=0;
  for(let tri=0;tri<triangles;tri++){
   for(let v=0;v<3;v++){
    const offset=tri*3+v;
    vertices[v].fromBufferAttribute(position,indices?indices[offset]:offset).applyMatrix4(mesh.matrixWorld);
   }
   edgeA.subVectors(vertices[1],vertices[0]);edgeB.subVectors(vertices[2],vertices[0]);
   area+=normal.crossVectors(edgeA,edgeB).length()*.5;
   trianglesArea[tri]=area;
  }
  if(area<=0)return;
  const priority=partIndex===0?.16:partIndex===3?1.8:1;
  surfaceArea+=area*priority;
  tint.copy(mesh.material.color).convertLinearToSRGB();
  meshes.push({mesh,position,indices,trianglesArea,area,limit:surfaceArea,rgb:[tint.r,tint.g,tint.b]});
 }));

 function lookup(length,limit,target){
  let lo=0,hi=length-1;
  while(lo<hi){
   const middle=(lo+hi)>>>1;
   if(target<limit(middle))hi=middle;else lo=middle+1;
  }
  return lo;
 }

 const random=randomSequence(214588+index*7919);
 const points=new Float32Array(count*3),colors=new Float32Array(count*3);
 const lighting=new Vector3(-.55,.83,.73).normalize();
 const sample=new Vector3();
 for(let i=0;i<count;i++){
  const chosen=meshes[lookup(meshes.length,k=>meshes[k].limit,random()*surfaceArea)];
  const {position,indices,mesh,area,trianglesArea,rgb}=chosen;
  const tri=lookup(trianglesArea.length,k=>trianglesArea[k],random()*area);
  for(let v=0;v<3;v++){
   const offset=tri*3+v;
   vertices[v].fromBufferAttribute(position,indices?indices[offset]:offset).applyMatrix4(mesh.matrixWorld);
  }
  const u=Math.sqrt(random()),v=random(),offset=i*3;
  sample.copy(vertices[0]).multiplyScalar(1-u).addScaledVector(vertices[1],u*(1-v)).addScaledVector(vertices[2],u*v);
  sample.sub(center).multiplyScalar(normalization).toArray(points,offset);
  edgeA.subVectors(vertices[1],vertices[0]);edgeB.subVectors(vertices[2],vertices[0]);
  normal.crossVectors(edgeA,edgeB).normalize();
  const shade=.63+Math.max(0,normal.dot(lighting))*.37;
  const glint=random();
  for(let k=0;k<3;k++){
   const lift=k===2?.27:.21;
   colors[offset+k]=Math.min(1,(rgb[k]*.89+lift)*shade*(.89+glint*.27)+(glint>.94?.22:0));
  }
 }

 // Builders share some geometry with the workshop. Only free buffers unique to this sampling run.
 geometrySet.forEach(geometry=>{if(!geometry.userData.shared)geometry.dispose();});
 return {points,colors};
}
