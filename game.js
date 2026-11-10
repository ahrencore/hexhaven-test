'use strict';
// Hexhaven: self-contained, dependency-free hex tile puzzle.
const canvas=document.getElementById('board'),ctx=canvas.getContext('2d');
const preview=document.getElementById('preview'),pctx=preview.getContext('2d');
const $=id=>document.getElementById(id);
const DIRS=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
const COLORS={forest:'#4f9563',water:'#6eafcf',field:'#e9c978',village:'#c78b68'};
const LABELS={forest:'Forest',water:'River',field:'Meadow',village:'Village'};
const TYPES=Object.keys(COLORS);
const key=(q,r)=>`${q},${r}`;
let board=new Map(),next=null,rotation=0,score=0,left=20,over=false,showHints=true,hover=null;
let best=Number(localStorage.getItem('hexhaven-best')||0);
const rand=n=>Math.floor(Math.random()*n);
function randomTile(){const main=TYPES[rand(TYPES.length)],second=TYPES[rand(TYPES.length)];return Array.from({length:6},()=>Math.random()<.7?main:second)}
function rotated(edges,steps){return edges.map((_,i)=>edges[(i-steps+6)%6])}
function legal(q,r){if(board.has(key(q,r)))return false;return DIRS.some(([dq,dr])=>board.has(key(q+dq,r+dr)))}
function candidates(){const out=new Map();for(const t of board.values())for(const [dq,dr] of DIRS){const q=t.q+dq,r=t.r+dr;if(legal(q,r))out.set(key(q,r),{q,r})}return [...out.values()]}
function evaluate(q,r,edges){let matched=0,neighbors=0;DIRS.forEach(([dq,dr],i)=>{const n=board.get(key(q+dq,r+dr));if(n){neighbors++;if(edges[i]===n.edges[(i+3)%6])matched++}});return {matched,neighbors,points:matched*10+(neighbors>0&&matched===neighbors?20:0)}}
function coords(q,r,size,cx,cy){return [cx+size*Math.sqrt(3)*(q+r/2),cy+size*1.5*r]}
function hexPath(c,x,y,s){c.beginPath();for(let i=0;i<6;i++){const a=Math.PI/180*(60*i-30),px=x+s*Math.cos(a),py=y+s*Math.sin(a);i?c.lineTo(px,py):c.moveTo(px,py)}c.closePath()}
function drawTile(c,x,y,s,edges,alpha=1){c.save();c.globalAlpha=alpha;c.shadowColor='#2c5c4560';c.shadowBlur=s*.15;c.shadowOffsetY=3;hexPath(c,x,y,s);c.fillStyle='#f8f2dd';c.fill();c.shadowColor='transparent';for(let i=0;i<6;i++){const a1=Math.PI/180*(60*i-30),a2=Math.PI/180*(60*(i+1)-30);c.beginPath();c.moveTo(x,y);c.lineTo(x+s*.94*Math.cos(a1),y+s*.94*Math.sin(a1));c.lineTo(x+s*.94*Math.cos(a2),y+s*.94*Math.sin(a2));c.closePath();c.fillStyle=COLORS[edges[i]];c.fill()}hexPath(c,x,y,s);c.strokeStyle='#fff8';c.lineWidth=2;c.stroke();c.beginPath();c.arc(x,y,s*.20,0,Math.PI*2);c.fillStyle='#ffffffb5';c.fill();c.restore()}
function dimensions(){const r=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);return {w:r.width,h:r.height}}
function geometry(w,h){const points=[...board.values(),...candidates()];const maxQ=Math.max(2,...points.map(p=>Math.abs(p.q+p.r/2)));const maxR=Math.max(2,...points.map(p=>Math.abs(p.r)));const size=Math.min(48,(w-70)/(Math.sqrt(3)*2*(maxQ+.7)),(h-70)/(3*(maxR+.7)));return {size:Math.max(12,size),cx:w/2,cy:h/2}}
function render(){const {w,h}=dimensions();ctx.clearRect(0,0,w,h);const g=geometry(w,h);ctx.fillStyle='#ffffff25';for(let x=0;x<w;x+=28)for(let y=0;y<h;y+=28){ctx.beginPath();ctx.arc(x,y,1,0,Math.PI*2);ctx.fill()}
for(const t of board.values()){const [x,y]=coords(t.q,t.r,g.size,g.cx,g.cy);drawTile(ctx,x,y,g.size-2,t.edges)}
if(!over)for(const p of candidates()){const [x,y]=coords(p.q,p.r,g.size,g.cx,g.cy),selected=hover&&hover.q===p.q&&hover.r===p.r;hexPath(ctx,x,y,g.size-3);ctx.fillStyle=selected?'#fff8':'#fff4';ctx.fill();ctx.lineWidth=selected?3:1.5;ctx.strokeStyle=selected?'#347b61':'#6c9f87aa';ctx.stroke();if(selected){drawTile(ctx,x,y,g.size-3,rotated(next,rotation),.8);const e=evaluate(p.q,p.r,rotated(next,rotation));ctx.fillStyle='#245d48';ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.fillText(`+${e.points}`,x,y-g.size-10)}else if(showHints){ctx.fillStyle='#629781';ctx.textAlign='center';ctx.font=`${Math.max(12,g.size*.45)}px system-ui`;ctx.fillText('+',x,y+5)}}
renderPreview();$('score').textContent=score;$('left').textContent=left;$('best').textContent=best}
function renderPreview(){pctx.clearRect(0,0,220,220);if(!next)return;drawTile(pctx,110,104,87,rotated(next,rotation));$('tileName').textContent=LABELS[next[0]]+' mix'}
function pick(ev){const rect=canvas.getBoundingClientRect(),x=ev.clientX-rect.left,y=ev.clientY-rect.top,g=geometry(rect.width,rect.height);let chosen=null,min=Infinity;for(const p of candidates()){const [px,py]=coords(p.q,p.r,g.size,g.cx,g.cy),d=Math.hypot(x-px,y-py);if(d<g.size*.88&&d<min){min=d;chosen=p}}return chosen}
function place(p){if(over||!p||!legal(p.q,p.r))return;const edges=rotated(next,rotation),e=evaluate(p.q,p.r,edges);board.set(key(p.q,p.r),{...p,edges});score+=e.points;left--;if(score>best){best=score;localStorage.setItem('hexhaven-best',best)}next=randomTile();rotation=0;hover=null;if(left===0){over=true;$('message').textContent=score>=250?`You win! Final score: ${score} 🎉`:`Game over — ${score} points. Try again!`}else $('message').textContent=e.points?`Nice placement! +${e.points} points`:'No matches this time — keep building!';render()}
function restart(){board=new Map([[key(0,0),{q:0,r:0,edges:['forest','forest','water','field','field','water']}]]);next=randomTile();rotation=0;score=0;left=20;over=false;hover=null;$('message').textContent='Click a highlighted hex to place your tile.';render()}
canvas.addEventListener('pointermove',ev=>{const p=pick(ev);if(key(p?.q,p?.r)!==key(hover?.q,hover?.r)){hover=p;render()}});canvas.addEventListener('pointerleave',()=>{hover=null;render()});canvas.addEventListener('click',ev=>place(pick(ev)));
$('rotate').onclick=()=>{rotation=(rotation+1)%6;render()};$('placeHint').onclick=()=>{showHints=!showHints;render()};$('restart').onclick=restart;
window.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='r'){$('rotate').click()}if(e.key.toLowerCase()==='h'){$('placeHint').click()}});window.addEventListener('resize',render);
restart();
