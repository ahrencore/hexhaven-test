(() => {
const TERRAIN = {
  grass:{name:'Meadow',color:0x91b879,edge:0x6e9d62},
  forest:{name:'Forest',color:0x39734c,edge:0x245b3b},
  river:{name:'River',color:0x63b7c6,edge:0x398ba4},
  mountain:{name:'Mountain',color:0xa8a99c,edge:0x777f78},
  village:{name:'Village',color:0xd7b978,edge:0xa9894c},
  beach:{name:'Beach',color:0xe8d49a,edge:0xc4aa6d}
};
const TYPES = Object.keys(TERRAIN);
const DIRECTIONS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
const ODD = n => (n & 1) === 1;
const key = (q,r) => `${q},${r}`;
const rotateEdges = (edges,n) => Array.from({length:6},(_,i)=>edges[(i-n+6)%6]);
const rand = arr => arr[Math.floor(Math.random()*arr.length)];

class HexHaven extends Phaser.Scene {
  constructor(){super('world');this.tiles=new Map();this.history=[];this.rotation=0;this.turn=0;this.score=0;this.next=null;this.objectives={forest:0,river:0,village:0};this.landmarks=[];this.hexSize=39;this.origin={x:0,y:0};}
  create(){
    this.bg=this.add.graphics();this.boardLayer=this.add.container(0,0);this.hintLayer=this.add.container(0,0);
    this.createWorld();
    this.next=this.makeTile();this.drawPreview();this.updateUI();
    this.scale.on('resize',()=>this.layoutBoard());this.layoutBoard();
    this.input.on('pointerdown',p=>this.handleBoardTap(p));
    document.getElementById('rotate-left').onclick=()=>this.rotate(-1);
    document.getElementById('rotate-right').onclick=()=>this.rotate(1);
    document.getElementById('undo').onclick=()=>this.undo();
    document.getElementById('restart').onclick=()=>this.restart();
  }
  createWorld(){
    const starter={q:0,r:0,edges:['grass','forest','river','grass','village','mountain'],id:0};
    this.tiles.set(key(0,0),starter);
    this.drawTile(starter,false);
    this.refreshHints();
  }
  makeTile(){
    // Hybrid tiles: each hex has six terrain edges, with 2–3 related terrain types.
    const theme=rand(['woodland','waterway','highland','settlement','coast']);
    const palettes={
      woodland:['forest','forest','grass','grass','village'],
      waterway:['river','river','grass','beach','forest'],
      highland:['mountain','mountain','grass','forest','river'],
      settlement:['village','village','grass','grass','forest'],
      coast:['beach','beach','river','grass','village']
    };
    let edges=Array.from({length:6},()=>rand(palettes[theme]));
    // Encourage a coherent tile while retaining interesting mixed edges.
    edges[rand([0,1,2,3,4,5])]=palettes[theme][0];
    return {edges,id:this.turn+1,theme};
  }
  axialToPixel(q,r){
    const s=this.hexSize;
    return {x:this.origin.x+s*Math.sqrt(3)*(q+r/2),y:this.origin.y+s*1.5*r};
  }
  hexPoints(x,y,s){const pts=[];for(let i=0;i<6;i++){const a=(Math.PI/180)*(60*i-30);pts.push({x:x+s*Math.cos(a),y:y+s*Math.sin(a)});}return pts;}
  polygon(g,pts,fill,line=0x23372c,width=2){g.fillStyle(fill,1);g.lineStyle(width,line,1);g.beginPath();g.moveTo(pts[0].x,pts[0].y);pts.slice(1).forEach(p=>g.lineTo(p.x,p.y));g.closePath();g.fillPath();g.strokePath();}
  drawTile(tile,isNew=true){
    const pos=this.axialToPixel(tile.q,tile.r),s=this.hexSize;
    const container=this.add.container(pos.x,pos.y);this.boardLayer.add(container);
    const shadow=this.add.graphics();shadow.fillStyle(0x0b1711,.34);shadow.fillPoints(this.hexPoints(2,6,s*.98),true);container.add(shadow);
    const base=this.add.graphics();this.polygon(base,this.hexPoints(0,3,s*.97),0x50654b,0x263d31,2);container.add(base);
    const top=this.add.graphics();this.polygon(top,this.hexPoints(0,-1,s*.91),0x879e70,0x344e3b,2);container.add(top);
    // Six wedge-shaped terrain regions, like a little diorama on a flat board.
    for(let i=0;i<6;i++){
      const a=(Math.PI/180)*(60*i-30),a2=(Math.PI/180)*(60*(i+1)-30);
      const p1={x:Math.cos(a)*s*.87,y:Math.sin(a)*s*.87-1},p2={x:Math.cos(a2)*s*.87,y:Math.sin(a2)*s*.87-1};
      const wedge=this.add.graphics();wedge.fillStyle(TERRAIN[tile.edges[i]].color,1);wedge.lineStyle(1,0x405844,.7);wedge.beginPath();wedge.moveTo(0,-1);wedge.lineTo(p1.x,p1.y);wedge.lineTo(p2.x,p2.y);wedge.closePath();wedge.fillPath();wedge.strokePath();container.add(wedge);
      this.addTerrainDetail(container,tile.edges[i],i,s);
    }
    // Center medallion and tiny terrain landmarks.
    const center=this.add.graphics();center.fillStyle(0x1c3428,.22);center.fillCircle(0,0,s*.19);center.lineStyle(1,0xd4d9a0,.5);center.strokeCircle(0,0,s*.19);container.add(center);
    const outline=this.add.graphics();outline.lineStyle(isNew?2.5:1.4,isNew?0xf1d58b:0x344d3c,isNew?1:.8);outline.strokePoints(this.hexPoints(0,-1,s*.91),true);container.add(outline);
    tile.container=container;
  }
  addTerrainDetail(c,type,i,s){
    const a=(Math.PI/180)*(60*i-30+30),r=s*.52,x=Math.cos(a)*r,y=Math.sin(a)*r-1;
    const g=this.add.graphics();
    if(type==='forest'){
      g.fillStyle(0x234b35,1);g.fillTriangle(x-7,y+5,x,y-10,x+7,y+5);g.fillStyle(0x4e9254,1);g.fillTriangle(x-5,y+2,x,y-9,x+5,y+2);g.fillStyle(0x73553c,1);g.fillRect(x-1.3,y+3,2.6,5);
    } else if(type==='mountain'){
      g.fillStyle(0x717e78,1);g.fillTriangle(x-10,y+7,x,y-11,x+10,y+7);g.fillStyle(0xe4e6d9,1);g.fillTriangle(x-4,y-3,x,y-11,x+5,y-2);g.fillStyle(0x87928a,1);g.fillTriangle(x,y-1,x+5,y-2,x+10,y+7);
    } else if(type==='river'){
      g.lineStyle(5,0x398ba4,1);g.beginPath();g.moveTo(x-9,y+4);g.bezierCurveTo(x-3,y-5,x+3,y+8,x+9,y-3);g.strokePath();g.lineStyle(1.5,0xa9e5e7,.8);g.beginPath();g.moveTo(x-7,y+3);g.bezierCurveTo(x-2,y-3,x+3,y+6,x+7,y-2);g.strokePath();
    } else if(type==='village'){
      g.fillStyle(0x9b6646,1);g.fillRect(x-6,y-1,12,9);g.fillStyle(0x754b3a,1);g.fillTriangle(x-8,y,x,y-8,x+8,y);g.fillStyle(0xf1d9a0,1);g.fillRect(x-2,y+2,4,6);
    } else if(type==='beach'){
      g.fillStyle(0xf6e2a9,.9);g.fillEllipse(x,y+2,18,8);g.lineStyle(1,0xffffff,.6);g.beginPath();g.moveTo(x-6,y);g.lineTo(x-1,y-2);g.lineTo(x+5,y);g.strokePath();
    } else {
      g.fillStyle(0x6b9d59,1);g.fillEllipse(x,y+2,17,8);g.fillStyle(0xb8d28a,1);g.fillEllipse(x-2,y,7,4);
    }
    c.add(g);
  }
  layoutBoard(){
    const w=this.scale.width,h=this.scale.height;
    this.hexSize=Math.max(27,Math.min(43,Math.min(w/13,h/11)));
    this.origin={x:w/2,y:h/2};
    this.boardLayer.removeAll(true);this.hintLayer.removeAll(true);
    for(const tile of this.tiles.values())this.drawTile(tile,false);
    this.refreshHints();
  }
  neighbours(q,r){return DIRECTIONS.map(([dq,dr])=>({q:q+dq,r:r+dr}));}
  refreshHints(){
    this.hintLayer.removeAll(true);const candidates=new Map();
    for(const t of this.tiles.values())for(const p of this.neighbours(t.q,t.r)){if(!this.tiles.has(key(p.q,p.r)))candidates.set(key(p.q,p.r),p);}
    for(const p of candidates.values()){
      const pos=this.axialToPixel(p.q,p.r),g=this.add.graphics();g.fillStyle(0xd7e9b2,.055);g.lineStyle(1.5,0xc5df9c,.5);g.fillPoints(this.hexPoints(pos.x,pos.y,this.hexSize*.88),true);g.strokePoints(this.hexPoints(pos.x,pos.y,this.hexSize*.88),true);this.hintLayer.add(g);
      
    }
  }
  handleBoardTap(pointer){
    const world=this.cameras.main.getWorldPoint(pointer.x,pointer.y);
    let best=null,dist=Infinity;
    const candidates=new Map();for(const t of this.tiles.values())for(const p of this.neighbours(t.q,t.r))if(!this.tiles.has(key(p.q,p.r)))candidates.set(key(p.q,p.r),p);
    for(const p of candidates.values()){const xy=this.axialToPixel(p.q,p.r),d=Math.hypot(xy.x-world.x,xy.y-world.y);if(d<dist){dist=d;best=p;}}
    if(best&&dist<this.hexSize*.88)this.place(best.q,best.r);
  }
  rotate(n){this.rotation=(this.rotation+n+6)%6;this.drawPreview();}
  place(q,r){
    if(!this.next||this.tiles.has(key(q,r)))return;
    const tile={q,r,edges:rotateEdges(this.next.edges,this.rotation),id:this.turn+1};
    this.history.push({tiles:new Map([...this.tiles].map(([k,v])=>[k,{q:v.q,r:v.r,edges:[...v.edges],id:v.id}])),score:this.score,objectives:{...this.objectives},landmarks:[...this.landmarks],turn:this.turn,nextEdges:[...this.next.edges]});
    this.tiles.set(key(q,r),tile);
    const matches=this.countMatches(tile);
    const points=matches*10+(matches>=3?15:0);this.score+=points;
    this.turn++;this.rotation=0;this.checkLandmarks();this.next=this.makeTile();
    this.drawPreview();this.layoutBoard();this.updateUI();
  }
  countMatches(tile){
    let matches=0;
    for(let d=0;d<6;d++){const [dq,dr]=DIRECTIONS[d],n=this.tiles.get(key(tile.q+dq,tile.r+dr));if(!n)continue;
      const opposite=(d+3)%6;if(tile.edges[d]===n.edges[opposite]){matches++;const type=tile.edges[d];if(this.objectives[type]!==undefined)this.objectives[type]++;}}
    return matches;
  }
  checkLandmarks(){
    const total=this.tiles.size;
    if(total>=7&&!this.landmarks.includes('Woodland Shrine')&&this.objectives.forest>=3)this.landmarks.push('Woodland Shrine');
    if(total>=10&&!this.landmarks.includes('River Arch')&&this.objectives.river>=3)this.landmarks.push('River Arch');
    if(total>=13&&!this.landmarks.includes('Market Hamlet')&&this.objectives.village>=2)this.landmarks.push('Market Hamlet');
  }
  drawPreview(){
    const host=document.getElementById('preview');host.innerHTML='';
    const w=150,h=116,canvas=document.createElement('canvas');canvas.width=w*2;canvas.height=h*2;canvas.style.width=w+'px';canvas.style.height=h+'px';host.appendChild(canvas);
    const ctx=canvas.getContext('2d');ctx.scale(2,2);const s=43,edges=rotateEdges(this.next.edges,this.rotation);
    const pts=this.hexPoints(w/2,h/2,s);ctx.fillStyle='#0b1711';ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x+1,p.y+5):ctx.moveTo(p.x+1,p.y+5));ctx.closePath();ctx.fill();
    ctx.fillStyle='#879e70';ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();
    for(let i=0;i<6;i++){const a=(Math.PI/180)*(60*i-30),b=(Math.PI/180)*(60*(i+1)-30),p1={x:w/2+Math.cos(a)*s,y:h/2+Math.sin(a)*s},p2={x:w/2+Math.cos(b)*s,y:h/2+Math.sin(b)*s};ctx.fillStyle='#'+TERRAIN[edges[i]].color.toString(16).padStart(6,'0');ctx.beginPath();ctx.moveTo(w/2,h/2);ctx.lineTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.closePath();ctx.fill();ctx.strokeStyle='#405844';ctx.stroke();}
    ctx.strokeStyle='#e4d49b';ctx.lineWidth=2;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();
    document.getElementById('turn').textContent='TILE '+String(this.turn+1).padStart(2,'0');
    document.getElementById('tile-caption').textContent=[...new Set(this.next.edges)].map(t=>TERRAIN[t].name).join(' · ');
  }
  updateUI(){
    document.getElementById('score').textContent=this.score.toLocaleString();
    for(const k of ['forest','river','village']){const target={forest:5,river:4,village:3}[k],v=Math.min(this.objectives[k],target);document.getElementById(k+'-count').textContent=v+'/'+target;document.getElementById(k+'-progress').style.width=(v/target*100)+'%';}
    const status=document.getElementById('landmark-status');status.innerHTML=this.landmarks.length?'<span class="sparkle">✧</span><span>You've shaped a landmark into your world!</span>':'<span class="sparkle">✧</span><span>Your first landmark is waiting to be discovered.</span>';
    document.getElementById('landmark-list').innerHTML=this.landmarks.map(x=>`<span class="landmark-chip">✦ ${x}</span>`).join('');
    document.getElementById('undo').disabled=this.history.length===0;
  }
  undo(){
    const state=this.history.pop();if(!state)return;this.tiles=state.tiles;this.score=state.score;this.objectives=state.objectives;this.landmarks=state.landmarks;this.turn=state.turn;this.next={edges:[...state.nextEdges]};this.rotation=0;this.layoutBoard();this.drawPreview();this.updateUI();
  }
  restart(){
    this.tiles.clear();this.history=[];this.turn=0;this.score=0;this.objectives={forest:0,river:0,village:0};this.landmarks=[];this.rotation=0;this.next=this.makeTile();this.createWorld();this.drawPreview();this.updateUI();
  }
}
const config={type:Phaser.AUTO,parent:'game-container',backgroundColor:'#263b31',scale:{mode:Phaser.Scale.RESIZE,width:'100%',height:'100%'},scene:[HexHaven],render:{antialias:true,roundPixels:false},fps:{target:60}};
new Phaser.Game(config);
})();