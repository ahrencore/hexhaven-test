import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
const $=id=>document.getElementById(id),canvas=$('world'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color('#080d13');const camera=new THREE.OrthographicCamera(-5,5,7,-7,.1,100);camera.position.set(10,15,19);camera.lookAt(0,0,0);scene.add(new THREE.HemisphereLight(0xc6dded,0x27392f,2.0));const sun=new THREE.DirectionalLight(0xffe2b1,2.1);sun.position.set(-6,15,9);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-22;sun.shadow.camera.right=22;sun.shadow.camera.top=22;sun.shadow.camera.bottom=-22;scene.add(sun);
const R=1,ROOT3=Math.sqrt(3),TYPES=['meadow','forest','water','village'],COL={meadow:0x648e4c,forest:0x315f57,water:0x48aebc,village:0x8a9b55};const levels=[{name:'First Meadow',count:12,seed:21,stars:[70,125,185]},{name:'Riverbend',count:18,seed:47,stars:[130,220,330]},{name:'Little Village',count:24,seed:89,stars:[200,340,500]}];let levelIndex=0,deck=[],board=new Map(),score=0,undoUsed=false,history=null,drag=null,hover=null,zoom=7.3,pan=new THREE.Vector3(),pointers=new Map(),gesture=null,locked=false,pending=null,previewPointer=null;
const group=new THREE.Group();scene.add(group);const outlines=new THREE.Group();scene.add(outlines);const raycaster=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),ndc=new THREE.Vector2();const mat=c=>new THREE.MeshStandardMaterial({color:c,roughness:.96,metalness:0});const mats=Object.fromEntries(Object.entries(COL).map(([k,c])=>[k,mat(c)]));const outlineMat=new THREE.LineBasicMaterial({color:0xfaf7df,transparent:true,opacity:.65});
function rng(seed){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}function makeTile(random){let a=Array.from({length:6},()=>TYPES[Math.floor(random()*4)]);if(random()<.6){let t=TYPES[Math.floor(random()*4)];a=Array.from({length:6},(_,i)=>i<3?t:a[i])}return {edges:a,rot:0}}function edges(t){return Array.from({length:6},(_,i)=>t.edges[(i-t.rot+6)%6])}const DIR=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]],key=(q,r)=>q+','+r,position=(q,r)=>new THREE.Vector3(ROOT3*(q+r/2),0,1.5*r);function neighbors(q,r){return DIR.map(([dq,dr])=>[q+dq,r+dr])}
function hexShape(){let s=new THREE.Shape();for(let i=0;i<6;i++){let a=Math.PI/3*i+Math.PI/6,x=Math.cos(a)*.985,y=Math.sin(a)*.985;i?s.lineTo(x,y):s.moveTo(x,y)}s.closePath();return s}const hex=hexShape();const groundGeometry=new THREE.ExtrudeGeometry(hex,{depth:.12,bevelEnabled:false});groundGeometry.rotateX(-Math.PI/2);// ART TEST 1: all board tiles and tray previews use the same reusable 3D geometry.
const trunkMat=mat(0x665142),roofMat=mat(0x718b3b),wallMat=mat(0xe2bf8d),rockMat=mat(0x8a929b),goldMat=new THREE.MeshStandardMaterial({color:0xffc577,emissive:0x9a4a17,emissiveIntensity:.42}),glowMat=new THREE.MeshStandardMaterial({color:0xb5f8b9,emissive:0x56ce99,emissiveIntensity:.8});
const treeMat=[mat(0x287b77),mat(0x3d9a91),mat(0x9274ad),mat(0x4a8069)];
const stemGeo=new THREE.CylinderGeometry(.042,.075,.31,6),canopyGeo=new THREE.IcosahedronGeometry(.26,1),pineGeo=new THREE.ConeGeometry(.26,.65,7),rockGeo=new THREE.DodecahedronGeometry(.105,0),flowerGeo=new THREE.IcosahedronGeometry(.026,0),houseBox=new THREE.BoxGeometry(.31,.27,.28),houseRoof=new THREE.ConeGeometry(.32,.25,4),windowGeo=new THREE.BoxGeometry(.075,.09,.015),mushStem=new THREE.CylinderGeometry(.013,.017,.08,5),mushCap=new THREE.SphereGeometry(.055,7,5),baseMat=mat(0x4a3b30),bankMat=mat(0x6c8b52),waterMat=new THREE.MeshStandardMaterial({color:0x3aafbf,roughness:.25,metalness:.08,emissive:0x084954,emissiveIntensity:.27});
const edgeGeo=[];const waterGeo=[];
for(let i=0;i<6;i++){
 const a=Math.PI/3*i+Math.PI/6,b=a+Math.PI/3;
 const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(Math.cos(a)*.984,Math.sin(a)*.984);shape.lineTo(Math.cos(b)*.984,Math.sin(b)*.984);shape.closePath();
 const g=new THREE.ShapeGeometry(shape);g.rotateX(-Math.PI/2);edgeGeo.push(g);
 const w=new THREE.Shape();w.moveTo(0,0);w.lineTo(Math.cos(a)*.985,Math.sin(a)*.985);w.lineTo(Math.cos(b)*.985,Math.sin(b)*.985);w.closePath();const wg=new THREE.ShapeGeometry(w);wg.rotateX(-Math.PI/2);waterGeo.push(wg);
}
const sharedGeos=new Set([groundGeometry,stemGeo,canopyGeo,pineGeo,rockGeo,flowerGeo,houseBox,houseRoof,windowGeo,mushStem,mushCap,...edgeGeo,...waterGeo]);
const sharedMats=new Set([...Object.values(mats),trunkMat,roofMat,wallMat,rockMat,goldMat,glowMat,...treeMat,baseMat,bankMat,waterMat,outlineMat]);
function mesh(geo,m,x,y,z,parent,rotation=0){let o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.rotation.y=rotation;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
function tileSeed(t){let n=2166136261;for(const c of t.edges.join('|'))n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;return n>>>0}
function drawTile(q,r,t,parent=group){
 const g=new THREE.Group();g.position.copy(position(q,r));parent.add(g);const e=edges(t),random=rng(tileSeed(t));
 mesh(groundGeometry,baseMat,0,.12,0,g);
 for(let i=0;i<6;i++){
  const type=e[i],a=Math.PI/3*(i+.5)+Math.PI/6,x=Math.cos(a)*.53,z=-Math.sin(a)*.53;
  mesh(edgeGeo[i],mats[type],0,.255,0,g);
  if(type==='water'){
   mesh(waterGeo[i],waterMat,0,.263,0,g);
   for(let j=0;j<2;j++){let rr=.36+.35*random(),theta=a+(random()-.5)*.53;mesh(rockGeo,rockMat,Math.cos(theta)*rr,.32,-Math.sin(theta)*rr,g).scale.setScalar(.55+random()*.35)}
  }else if(type==='forest'){
   const count=1+(random()>.45?1:0);
   for(let j=0;j<count;j++){
    let xx=x+(random()-.5)*.19,zz=z+(random()-.5)*.19;
    const h=.8+random()*.35;
    mesh(stemGeo,trunkMat,xx,.43,zz,g).scale.y=h;
    const c=mesh(random()>.78?pineGeo:canopyGeo,treeMat[Math.floor(random()*4)],xx,.72+random()*.05,zz,g,random()*6.28);
    c.scale.set(.82+random()*.4,.9+random()*.48,.82+random()*.4);
   }
   if(random()>.48){mesh(mushStem,wallMat,x+.16,.30,z+.12,g);mesh(mushCap,glowMat,x+.16,.35,z+.12,g)}
  }else if(type==='village'){
   mesh(houseBox,wallMat,x,.40,z,g);
   const roof=mesh(houseRoof,roofMat,x,.68,z,g,Math.PI/4);roof.scale.z=1.1;
   mesh(windowGeo,goldMat,x,.44,z+.148,g);
   if(random()>.55)mesh(rockGeo,rockMat,x-.20,.31,z-.15,g);
  }else{
   for(let j=0;j<4;j++){
    let rr=.2+.45*random(),theta=a+(random()-.5)*.75;
    const f=mesh(flowerGeo,random()>.4?treeMat[2]:goldMat,Math.cos(theta)*rr,.282,-Math.sin(theta)*rr,g);f.scale.setScalar(.55+random()*.7);
   }
   if(random()>.65)mesh(rockGeo,rockMat,x,.32,z,g).scale.setScalar(.7);
  }
 }
 return g;
}
function clearGroup(g){while(g.children.length){const c=g.children[0];g.remove(c);c.traverse(o=>{if(o.geometry&&!sharedGeos.has(o.geometry))o.geometry.dispose();if(o.material&&!sharedMats.has(o.material))o.material.dispose()})}}
function candidates(){let set=new Set();for(let item of board.values())for(let [q,r] of neighbors(item.q,item.r)){let k=key(q,r);if(!board.has(k))set.add(k)}return [...set].map(k=>k.split(',').map(Number))}function refresh(){clearGroup(group);clearGroup(outlines);for(let t of board.values())drawTile(t.q,t.r,t.tile);for(let [q,r] of candidates()){let p=position(q,r);let points=[];for(let i=0;i<=6;i++){let a=Math.PI/3*i+Math.PI/6;points.push(new THREE.Vector3(p.x+Math.cos(a)*.98,.28,p.z-Math.sin(a)*.98))}let line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),outlineMat);line.userData={q,r};outlines.add(line)}updateUI()}
function scoreAt(q,r,t){let e=edges(t),matched=0,touch=0;neighbors(q,r).forEach(([nq,nr],i)=>{let n=board.get(key(nq,nr));if(n){touch++;if(e[i]===edges(n.tile)[(i+3)%6])matched++}});return {points:matched*10+(touch>=2&&matched===touch?20:0)+(touch===6?30:0),matched,touch}}
// Render actual 3D tile meshes into the existing toolbar canvases.
const trayScene=new THREE.Scene();trayScene.background=new THREE.Color(0x101b23);trayScene.add(new THREE.HemisphereLight(0xd8f0ed,0x42533a,2.3));
const trayLight=new THREE.DirectionalLight(0xffe4b4,2.4);trayLight.position.set(-3,8,6);trayScene.add(trayLight);
const trayCamera=new THREE.OrthographicCamera(-1.48,1.48,1.48,-1.48,.1,30);trayCamera.position.set(3.6,5.6,7.4);trayCamera.lookAt(0,.35,0);
const trayGroup=new THREE.Group();trayScene.add(trayGroup);
const targets=new Map();
function tile2d(c,t){const ctx=c.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,c.width,c.height);if(!t)return;
 clearGroup(trayGroup);drawTile(0,0,t,trayGroup);
 let target=targets.get(c);if(!target){target=new THREE.WebGLRenderTarget(c.width,c.height,{depthBuffer:true});targets.set(c,target)}
 renderer.setRenderTarget(target);renderer.clear();renderer.render(trayScene,trayCamera);renderer.setRenderTarget(null);
 const pixels=new Uint8Array(c.width*c.height*4);renderer.readRenderTargetPixels(target,0,0,c.width,c.height,pixels);
 const img=ctx.createImageData(c.width,c.height);for(let y=0;y<c.height;y++)img.data.set(pixels.subarray((c.height-y-1)*c.width*4,(c.height-y)*c.width*4),y*c.width*4);ctx.putImageData(img,0,0);
}
function updateUI(){let l=levels[levelIndex];$('score').textContent='★ '+score;$('level').textContent='Level '+(levelIndex+1);$('remaining').textContent=deck.length+' tiles left';$('undo').innerHTML='↶<small>'+(undoUsed?'Used':'Undo 1')+'</small>';$('undo').disabled=!!pending||undoUsed||!history;$('active').classList.toggle('waiting',!!pending);tile2d($('tile'),deck[0]);tile2d($('next1'),deck[1]);tile2d($('next2'),deck[2])}
function save(){localStorage.setItem('hexhaven-v02',JSON.stringify({levelIndex,score,deck,tiles:[...board.values()],undoUsed,history,pending}))}function load(){try{let d=JSON.parse(localStorage.getItem('hexhaven-v02'));if(!d||!levels[d.levelIndex]||!Array.isArray(d.deck)||!Array.isArray(d.tiles))return false;levelIndex=d.levelIndex;score=d.score;deck=d.deck;board=new Map(d.tiles.map(t=>[key(t.q,t.r),t]));undoUsed=!!d.undoUsed;history=d.history;pending=d.pending||null;return true}catch{return false}}
function start(i){clearPending();levelIndex=i;score=0;undoUsed=false;history=null;board=new Map();let random=rng(levels[i].seed);board.set(key(0,0),{q:0,r:0,tile:{edges:['meadow','forest','meadow','water','village','forest'],rot:0}});deck=Array.from({length:levels[i].count},()=>makeTile(random));pan.set(0,0,0);zoom=7.3;updateCamera();refresh();save();hideModal()}
function place(q,r){if(!deck.length||board.has(key(q,r))||!candidates().some(([x,y])=>x===q&&y===r))return false;history={q,r,score,tile:structuredClone(deck[0])};let pts=scoreAt(q,r,deck[0]);board.set(key(q,r),{q,r,tile:deck.shift()});score+=pts.points;refresh();save();if(!deck.length)setTimeout(finish,450);return true}
function finish(){let l=levels[levelIndex],stars=l.stars.filter(x=>score>=x).length;let unlocked=Number(localStorage.getItem('hexhaven-unlocked')||0);localStorage.setItem('hexhaven-unlocked',String(Math.max(unlocked,Math.min(2,levelIndex+1))));showModal('Puzzle complete!','★'.repeat(stars)+'☆'.repeat(3-stars)+'\nScore: '+score+' · '+(stars?stars+' star'+(stars>1?'s':''):'Try again for a star!'),[{label:'Replay',fn:()=>start(levelIndex)},{label:levelIndex<2?'Next level':'Play again',fn:()=>start(levelIndex<2?levelIndex+1:levelIndex)}])}
function showModal(title,msg,actions){locked=true;$('modalTitle').textContent=title;$('modalText').style.whiteSpace='pre-line';$('modalText').textContent=msg;let el=$('modalActions');el.replaceChildren();actions.forEach(a=>{let b=document.createElement('button');b.textContent=a.label;b.addEventListener('click',a.fn);el.append(b)});$('overlay').classList.remove('hidden')}function hideModal(){locked=false,pending=null,previewPointer=null;$('overlay').classList.add('hidden')}
function updateCamera(){let w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);let aspect=w/h;camera.left=-zoom*aspect;camera.right=zoom*aspect;camera.top=zoom;camera.bottom=-zoom;camera.position.set(10+pan.x,15+pan.y,19+pan.z);camera.lookAt(pan);camera.updateProjectionMatrix();updateFloatingControls()}
function worldAt(x,y){let rect=canvas.getBoundingClientRect();ndc.set((x-rect.left)/rect.width*2-1,-((y-rect.top)/rect.height*2-1));raycaster.setFromCamera(ndc,camera);let p=new THREE.Vector3();return raycaster.ray.intersectPlane(plane,p)?p:null}function nearest(x,y){let p=worldAt(x,y);if(!p)return null;let best=null,dist=Infinity;for(let [q,r] of candidates()){let v=position(q,r),d=p.distanceTo(v);if(d<dist){best={q,r};dist=d}}return dist<1.35?best:null}
// Placement is a two-phase transaction: preview/reposition/rotate, then explicit confirmation.
const previewGroup=new THREE.Group();scene.add(previewGroup);
const matchLines=new THREE.Group();scene.add(matchLines);
const feedback=$('placementFeedback'),actions=$('placementActions');
const matchMat=new THREE.LineBasicMaterial({color:0x57b878,depthTest:false});
const mismatchMat=new THREE.LineBasicMaterial({color:0xdba986,depthTest:false});
let ghost=new THREE.Group();scene.add(ghost);let ghostMat=mat(0xf3e4a3);ghostMat.transparent=true;ghostMat.opacity=.65;
mesh(groundGeometry,ghostMat,0,.24,0,ghost);ghost.visible=false;
function clearPending(){pending=null;previewPointer=null;clearGroup(previewGroup);clearGroup(matchLines);actions.classList.add('hidden');feedback.classList.add('hidden');ghost.visible=false;hover=null}
function renderPending(){
 clearGroup(previewGroup);clearGroup(matchLines);
 if(!pending||!deck.length){actions.classList.add('hidden');feedback.classList.add('hidden');return}
 const {q,r}=pending;drawTile(q,r,deck[0],previewGroup);
 // Subtle luminous border indicates that this is not yet committed.
 const center=position(q,r),ed=edges(deck[0]);let matched=0,touch=0;
 neighbors(q,r).forEach(([nq,nr],i)=>{
  const neighbor=board.get(key(nq,nr));if(!neighbor)return;
  touch++;const good=ed[i]===edges(neighbor.tile)[(i+3)%6];if(good)matched++;
  const a=Math.PI/3*i+Math.PI/6,b=a+Math.PI/3;
  const pts=[new THREE.Vector3(center.x+Math.cos(a)*.985,.38,center.z-Math.sin(a)*.985),new THREE.Vector3(center.x+Math.cos(b)*.985,.38,center.z-Math.sin(b)*.985)];
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),good?matchMat:mismatchMat);line.renderOrder=8;matchLines.add(line);
 });
 const pts=scoreAt(q,r,deck[0]);feedback.textContent=`+${pts.points} potential · ${matched}/${touch} matching edges`;
 feedback.classList.remove('hidden');actions.classList.remove('hidden');updateFloatingControls();
}
function updateFloatingControls(){if(!pending)return;const v=position(pending.q,pending.r);v.y=1.2;v.project(camera);const x=(v.x+1)*innerWidth/2,y=(1-v.y)*innerHeight/2;
 // Keep controls reachable near screen edges and away from the bottom tray.
 actions.style.left=Math.max(98,Math.min(innerWidth-98,x))+'px';actions.style.top=Math.max(105,Math.min(innerHeight-158,y-65))+'px';
 feedback.style.left=Math.max(90,Math.min(innerWidth-90,x))+'px';feedback.style.top=Math.max(64,Math.min(innerHeight-220,y-123))+'px';
}
function setPending(q,r){if(!deck.length||board.has(key(q,r))||!candidates().some(([x,y])=>x===q&&y===r))return;
 pending={q,r};ghost.visible=false;renderPending();updateUI();save();$('hint').textContent='Rotate, move, or tap ✓ to place';}
function moveDrag(x,y){if(!drag)return;drag.x=x;drag.y=y;const cell=nearest(x,y);hover=cell;ghost.visible=!!cell;if(cell){ghost.position.copy(position(cell.q,cell.r));const pts=scoreAt(cell.q,cell.r,deck[0]);ghostMat.color.set(pts.matched?'#b9e8a6':'#f1dc9c')}}
function beginDrag(e){if(locked||!deck.length||pending)return;e.preventDefault();drag={id:e.pointerId,x:e.clientX,y:e.clientY};$('active').setPointerCapture(e.pointerId);moveDrag(e.clientX,e.clientY);$('hint').textContent='Release over an outlined space to preview'}
$('active').addEventListener('pointerdown',beginDrag);
$('active').addEventListener('pointermove',e=>{if(drag?.id===e.pointerId)moveDrag(e.clientX,e.clientY)});
function endDrag(e){if(drag?.id!==e.pointerId)return;const target=nearest(e.clientX,e.clientY);drag=null;hover=null;ghost.visible=false;if(target)setPending(target.q,target.r);else $('hint').textContent='Drag a tile to grow your enchanted town'}
$('active').addEventListener('pointerup',endDrag);
$('active').addEventListener('pointercancel',()=>{drag=null;hover=null;ghost.visible=false});
function rotate(n){if(locked||!deck.length)return;deck[0].rot=(deck[0].rot+n+6)%6;updateUI();if(pending)renderPending();save();if(drag)moveDrag(drag.x,drag.y)}
$('left').onclick=()=>rotate(-1);$('right').onclick=()=>rotate(1);
$('previewLeft').onclick=()=>rotate(-1);$('previewRight').onclick=()=>rotate(1);
$('previewCancel').onclick=()=>{if(!pending)return;clearPending();updateUI();save();$('hint').textContent='Drag a tile to grow your enchanted town'};
$('previewConfirm').onclick=()=>{if(!pending||locked)return;const {q,r}=pending;clearPending();place(q,r);$('hint').textContent='Drag a tile to grow your enchanted town'};
$('undo').onclick=()=>{if(locked||pending||undoUsed||!history)return;board.delete(key(history.q,history.r));deck.unshift(history.tile);score=history.score;history=null;undoUsed=true;refresh();save()};
$('pause').onclick=()=>showModal('Hexhaven','Drag a tile to an outline. Rotate or reposition the preview, then tap ✓ to confirm. Tap × to cancel. Match adjacent terrain edges for points. Pinch to zoom and swipe to pan.',[{label:'Resume',fn:hideModal},{label:'Restart level',fn:()=>start(levelIndex)},{label:'Choose level',fn:chooseLevel}]);
function chooseLevel(){let unlocked=Number(localStorage.getItem('hexhaven-unlocked')||0);showModal('Choose a puzzle','Replay completed puzzles or try the next unlocked level.',levels.map((l,i)=>({label:l.name+(i>unlocked?' 🔒':''),fn:()=>{if(i<=unlocked)start(i)}})).concat([{label:'Back',fn:hideModal}]))}
canvas.addEventListener('pointerdown',e=>{if(locked)return;const cell=pending&&nearestOccupiedPending(e.clientX,e.clientY);if(cell){previewPointer={id:e.pointerId};canvas.setPointerCapture(e.pointerId);return;}canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){let a=[...pointers.values()];gesture={distance:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),zoom}}});canvas.addEventListener('pointermove',e=>{if(previewPointer?.id===e.pointerId){const cell=nearest(e.clientX,e.clientY);if(cell&&(!pending||cell.q!==pending.q||cell.r!==pending.r))setPending(cell.q,cell.r);return;}if(!pointers.has(e.pointerId)||locked)return;let old=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){let a=[...pointers.values()];let d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(gesture){zoom=Math.max(3.6,Math.min(17,gesture.zoom*gesture.distance/Math.max(1,d)));updateCamera()}return}if(pointers.size===1){let p1=worldAt(old.x,old.y),p2=worldAt(e.clientX,e.clientY);if(p1&&p2){pan.add(p1.sub(p2));updateCamera()}}});for(let ev of ['pointerup','pointercancel'])canvas.addEventListener(ev,e=>{if(previewPointer?.id===e.pointerId)previewPointer=null;pointers.delete(e.pointerId);if(pointers.size<2)gesture=null});canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(3.6,Math.min(17,zoom*(e.deltaY>0?1.08:.92)));updateCamera()},{passive:false});
function nearestOccupiedPending(x,y){if(!pending)return false;const p=worldAt(x,y);return !!p&&p.distanceTo(position(pending.q,pending.r))<1.05}
addEventListener('resize',updateCamera);updateCamera();if(!load())start(0);else{refresh();if(pending)renderPending();if(!deck.length)finish()}function animate(){requestAnimationFrame(animate);renderer.render(scene,camera)}animate();
