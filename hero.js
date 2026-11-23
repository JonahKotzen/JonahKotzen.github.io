/* Night-drive hero: sweep a flashlight across a desert road near Portal, AZ and log what turns up. */
(()=>{
const hero=document.getElementById('hl');if(!hero)return;const cv=document.getElementById('hl-c'),ctx=cv.getContext('2d');
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
let W=0,H=0,DPR=1,hy=0,vx=0,hwk=0,mobile=false;
const bg=document.createElement('canvas'),bx=bg.getContext('2d');
const sky=document.createElement('canvas'),sx=sky.getContext('2d');
const scn=document.createElement('canvas'),nx=scn.getContext('2d');
const bm=document.createElement('canvas'),mx=bm.getContext('2d');const mtn=document.createElement('canvas');
const R=i=>{const s=Math.sin(i*127.1+311.7)*43758.5453;return s-Math.floor(s)};
const TAU=Math.PI*2;

// road geometry: lateral position (-1..1 is the road), depth d (0 horizon → 1 bottom)
function P(lat,d){const y=hy+d*(H-hy);const hw=d*W*hwk;let x=vx+lat*hw;if(mobile)x=Math.max(40,Math.min(W-40,x));return{x,y,s:(0.25+d*0.9)*Math.min(W,H*1.4)/780}}

const animals=[
 {id:'spade',name:'Mexican spadefoot',sci:'Spea multiplicata',note:'Out after the first monsoon storm. Its tadpoles might turn carnivore.',lat:-.32,d:.8,eyes:[[24,-12]],eye:'#ffd27a',draw:spadefoot},
 {id:'bufo',name:'Sonoran desert toad',sci:'Incilius alvarius',note:'Biggest toad in the Southwest. Do not lick.',lat:-1.2,d:.68,eyes:[[30,-18]],eye:'#ffcf6a',draw:bufo},
 {id:'rattle',name:'Mojave rattlesnake',sci:'Crotalus scutulatus',note:'Give it the whole road.',lat:-1.25,d:.5,eyes:[[62,-6]],eye:'#ffe2a0',draw:rattler},
 {id:'king',name:'Desert kingsnake',sci:'Lampropeltis splendida',note:'Eats rattlesnakes. Crosses on its own schedule.',lat:0,d:.42,eyes:[[60,-3]],eye:'#ffe2a0',draw:king,move:t=>{const p=(t/70)%1;return -1.3+2.6*p}},
 {id:'tar',name:'Desert tarantula',sci:'Aphonopelma chalcodes',note:'Males wander after the rains, looking for mates.',lat:.3,d:.9,eyes:[[10,-9],[13,-9]],eye:'#9ff0ff',draw:tarantula,move:t=>.3-.16*Math.sin(t/14)},
 {id:'shrimp',name:'Red-tailed fairy shrimp',sci:'Streptocephalus sealii',note:'Hatched days ago from cysts in the dust. Carnivore food.',lat:.9,d:.7,eyes:[[-20,-2],[18,3],[0,-6]],eye:'#cfe6ff',draw:puddle},
 {id:'poor',name:'Common poorwill',sci:'Phalaenoptilus nuttallii',note:'Sitting on warm asphalt. The eyeshine gives it away.',lat:.05,d:.25,eyes:[[9,-11]],eye:'#ff7a2e',draw:poorwill,strong:true,size:2.1},
];
animals.forEach(a=>{a.found=false;a.dwell=0;a.at=-99});

const dots=document.getElementById('hl-dots'),count=document.getElementById('hl-count');
animals.forEach(a=>{const c=document.createElement('i');c.title=a.name;c.setAttribute('aria-label',a.name+' (not found yet)');a.chip=c;dots.appendChild(c)});

function resize(){
  const r=hero.getBoundingClientRect();W=r.width;H=r.height;DPR=Math.min(2,devicePixelRatio||1);
  mobile=W<760;hy=H*(mobile?.6:.5);vx=W*(mobile?.5:.66);hwk=mobile?.55:.42;
  for(const c of [cv,bg,sky,scn,bm]){c.width=W*DPR;c.height=H*DPR}
  for(const x of [ctx,bx,sx,nx,mx])x.setTransform(DPR,0,0,DPR,0,0);
  buildBg();buildSky();
}

function buildSky(){
  sx.clearRect(0,0,W,H);
  // milky way: soft diagonal band
  sx.save();sx.translate(W*.55,hy*.45);sx.rotate(-.5);
  for(let i=0;i<5;i++){const g=sx.createRadialGradient(0,0,0,0,0,W*.5);g.addColorStop(0,'rgba(150,160,220,.07)');g.addColorStop(1,'rgba(150,160,220,0)');sx.fillStyle=g;sx.save();sx.scale(1,.14+i*.03);sx.beginPath();sx.arc((i-2)*W*.08,0,W*.55,0,TAU);sx.fill();sx.restore()}
  for(let i=0;i<1400;i++){const x=(R(i)-.5)*W*1.3,y=(R(i+9e3)+R(i+7e3)-1)*W*.05;sx.fillStyle=`rgba(220,225,255,${.15+R(i+3)*.4})`;sx.fillRect(x,y,.8,.8)}
  // dark rift
  sx.fillStyle='rgba(5,8,26,.35)';sx.beginPath();sx.ellipse(W*.05,W*.006,W*.32,W*.012,0,0,TAU);sx.fill();
  sx.restore();
  for(let i=0;i<260;i++){const x=R(i+50)*W,y=R(i+90)*hy*.92;sx.fillStyle=`rgba(230,235,255,${.25+R(i+5)*.6})`;const s=R(i+11)>.93?1.6:1;sx.fillRect(x,y,s,s)}
}

function buildBg(){
  const g=bx;g.clearRect(0,0,W,H);
  // ground (lit colors; darkness is laid over later)
  const gr=g.createLinearGradient(0,hy,0,H);gr.addColorStop(0,'#6b5640');gr.addColorStop(1,'#8a6d4e');g.fillStyle=gr;g.fillRect(0,hy,W,H-hy);
  // pebbles
  for(let i=0;i<900;i++){const d=R(i+400);const y=hy+d*d*(H-hy);g.fillStyle=R(i)>.5?'rgba(60,45,30,.35)':'rgba(190,160,120,.25)';const s=.6+d*2.4;g.beginPath();g.ellipse(R(i+800)*W,y,s*1.4,s*.7,0,0,TAU);g.fill()}
  // road
  const L=lat=>[P(lat,0),P(lat,1)];
  g.fillStyle='#4a4748';g.beginPath();g.moveTo(vx,hy);g.lineTo(P(-1,1).x,H);g.lineTo(P(1,1).x,H);g.closePath();g.fill();
  g.strokeStyle='#d9d4c6';g.lineWidth=2;for(const s of[-.94,.94]){g.beginPath();g.moveTo(vx,hy);g.lineTo(P(s,1).x,H);g.stroke()}
  // dashed center line with perspective
  g.fillStyle='#e0b53c';for(let k=0;k<30;k++){const d0=Math.pow(k/30,1.6),d1=Math.pow((k+.45)/30,1.6);const a=P(0,d0),b=P(0,d1);const w0=a.s*2.2,w1=b.s*2.2;g.beginPath();g.moveTo(a.x-w0,a.y);g.lineTo(a.x+w0,a.y);g.lineTo(b.x+w1,b.y);g.lineTo(b.x-w1,b.y);g.fill()}
  // asphalt speckle
  for(let i=0;i<500;i++){const d=Math.sqrt(R(i+1200));const p=P((R(i+1300)-.5)*1.9,d);g.fillStyle='rgba(0,0,0,.18)';g.fillRect(p.x,p.y,1.2*p.s,1.2*p.s)}
  // creosote and grasses
  for(let i=0;i<46;i++){const d=.08+R(i+2e3)*.92;let lat=(R(i+2100)-.5)*7;if(Math.abs(lat)<1.25)lat+=lat<0?-1.3:1.3;const p=P(lat,d);if(p.x<-40||p.x>W+40)continue;bush(g,p.x,p.y,p.s*(.7+R(i)*.6),i)}
  // mountains (Chiricahua silhouette)
  mtn.width=W*DPR;mtn.height=H*DPR;const m=mtn.getContext('2d');m.setTransform(DPR,0,0,DPR,0,0);ridge(m,'#121732',hy,.20,1);ridge(m,'#090c1e',hy,.12,2);
}
function ridge(g,col,base,amp,seed){g.fillStyle=col;g.beginPath();g.moveTo(0,base);for(let x=0;x<=W;x+=6){const u=x/W;const y=base-H*amp*(.35+.35*Math.sin(u*5+seed)+.2*Math.sin(u*13+seed*3)+.1*Math.sin(u*31))*(seed==1?1:.7);g.lineTo(x,Math.min(y,base-2))}g.lineTo(W,base+1);g.lineTo(0,base+1);g.fill()}
function bush(g,x,y,s,i){g.save();g.translate(x,y);g.scale(s,s);g.strokeStyle='#4a3a28';g.lineWidth=1.4;for(let k=0;k<7;k++){const a=-Math.PI/2+(R(i*9+k)-.5)*1.6;g.beginPath();g.moveTo(0,0);g.lineTo(Math.cos(a)*34,Math.sin(a)*34);g.stroke()}g.fillStyle='#5f7438';for(let k=0;k<26;k++){const a=-Math.PI/2+(R(i*31+k)-.5)*1.9,r=12+R(i*17+k)*26;g.beginPath();g.arc(Math.cos(a)*r,Math.sin(a)*r,3+R(k+i)*3,0,TAU);g.fill()}g.restore()}

// ---------- animals (local units, facing right) ----------
function spadefoot(g,t){
  const hop=(t%9)<.6?Math.sin((t%9)/.6*Math.PI)*12:0;g.translate(0,-hop);
  g.fillStyle='#5e5a36';g.beginPath();g.ellipse(-14,6,15,7,-.3,0,TAU);g.fill();
  g.fillStyle='#111';g.beginPath();g.ellipse(-26,12,5,2.2,0,0,TAU);g.fill(); // the spade
  g.fillStyle='#8f8a55';g.beginPath();g.ellipse(0,0,27,17,0,0,TAU);g.fill();
  g.fillStyle='#9b9660';g.beginPath();g.ellipse(18,-4,14,11,0,0,TAU);g.fill();
  g.fillStyle='#6b6a3c';for(const[a,b,r]of[[-10,-6,3],[2,-9,2.5],[-4,3,2.2],[8,-2,2]]){g.beginPath();g.arc(a,b,r,0,TAU);g.fill()}
  const th=1+.25*Math.max(0,Math.sin(t*3));g.fillStyle='#c9c39a';g.beginPath();g.ellipse(24,6,6*th,4*th,0,0,TAU);g.fill();
  g.strokeStyle='#5e5a36';g.lineWidth=4;g.lineCap='round';g.beginPath();g.moveTo(14,8);g.lineTo(18,17);g.stroke();
  eye(g,24,-12,5,'#e0b850',true);
}
function bufo(g,t){
  g.scale(-1,1);g.translate(-0,0);
  g.fillStyle='#4f5a30';g.beginPath();g.ellipse(-20,10,20,9,-.3,0,TAU);g.fill();
  g.fillStyle='#6b7840';g.beginPath();g.ellipse(0,0,42,26,0,0,TAU);g.fill();
  g.fillStyle='#76844a';g.beginPath();g.ellipse(26,-6,22,17,0,0,TAU);g.fill();
  g.fillStyle='#86935a';g.strokeStyle='#4f5a30';g.lineWidth=1.5;g.beginPath();g.ellipse(10,-18,14,7,-.15,0,TAU);g.fill();g.stroke(); // parotoid gland
  g.fillStyle='#f1ecd8';g.beginPath();g.arc(40,4,3,0,TAU);g.fill();
  g.strokeStyle='#4f5a30';g.lineWidth=6;g.lineCap='round';g.beginPath();g.moveTo(26,10);g.lineTo(32,24);g.stroke();
  eye(g,30,-18,6,'#b9893a',false);
}
function eye(g,x,y,r,iris,vertical){g.fillStyle=iris;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();g.fillStyle='#000';g.beginPath();vertical?g.ellipse(x,y,r*.28,r*.8,0,0,TAU):g.ellipse(x,y,r*.8,r*.32,0,0,TAU);g.fill();g.fillStyle='rgba(255,255,255,.8)';g.beginPath();g.arc(x+r*.35,y-r*.35,r*.22,0,TAU);g.fill()}
function snakePts(t,len,waves,amp,speed){const pts=[];for(let k=0;k<=60;k++){const p=k/60;pts.push([-len/2+len*p,amp*Math.sin(p*TAU*waves-t*speed)*(.4+.6*p)])}return pts}
function rattler(g,t){
  const pts=snakePts(t,130,1.4,14,.6);
  for(let k=0;k<pts.length;k++){const p=k/60,r=2.5+6*Math.sin(Math.min(1,p*1.1)*Math.PI*.9);const[x,y]=pts[k];g.fillStyle=k%6<2?'#7d6a45':'#c8b78a';g.beginPath();g.arc(x,y,r,0,TAU);g.fill()}
  const[hx,hy2]=pts[60];g.fillStyle='#b8a57a';g.beginPath();g.ellipse(hx+2,hy2,11,8,0,0,TAU);g.fill();
  if((t%4)<.35){g.strokeStyle='#c0392b';g.lineWidth=1.5;g.beginPath();g.moveTo(hx+12,hy2);g.lineTo(hx+20,hy2-2);g.moveTo(hx+20,hy2-2);g.lineTo(hx+23,hy2-5);g.moveTo(hx+20,hy2-2);g.lineTo(hx+23,hy2+1);g.stroke()}
  const[tx,ty]=pts[0];const j=Math.sin(t*70)*2;g.fillStyle='#d8c79d';for(let i=0;i<4;i++){g.beginPath();g.ellipse(tx-6-i*5+j,ty,3.5,3-i*.3,0,0,TAU);g.fill()}
  g.strokeStyle='rgba(216,199,157,.35)';g.beginPath();g.moveTo(tx-26,ty-6);g.lineTo(tx-24,ty+6);g.stroke();
  g.fillStyle='#111';g.beginPath();g.arc(hx+5,hy2-3,1.6,0,TAU);g.fill();
}
function king(g,t){
  const pts=snakePts(t,130,1.2,10,1.6);
  for(let k=0;k<pts.length;k++){const p=k/60,r=2+5.5*Math.sin(Math.min(1,p*1.1)*Math.PI*.9);const[x,y]=pts[k];g.fillStyle=(k%7==0)?'#efe7c0':'#16161a';g.beginPath();g.arc(x,y,r,0,TAU);g.fill()}
  const[hx,hy2]=pts[60];g.fillStyle='#1c1c20';g.beginPath();g.ellipse(hx+3,hy2,8,6,0,0,TAU);g.fill();
}
function tarantula(g,t){
  const w=t*5;
  g.strokeStyle='#4a3524';g.lineWidth=3;g.lineCap='round';
  for(let side of[-1,1])for(let k=0;k<4;k++){const ph=w+k*1.6+(side>0?Math.PI:0);const bx2=2+k*3,by=0;const kx=bx2+(k-1.5)*10+Math.sin(ph)*3,ky=-14-side*2;const fx=bx2+(k-1.5)*17+Math.sin(ph)*5,fy=8+Math.max(0,Math.cos(ph))*-3;g.globalAlpha=side>0?1:.65;g.beginPath();g.moveTo(bx2,by);g.lineTo(kx,ky);g.lineTo(fx,fy);g.stroke()}
  g.globalAlpha=1;g.fillStyle='#3a281b';g.beginPath();g.ellipse(-16,-4,14,11,0,0,TAU);g.fill();
  g.fillStyle='#6a4f34';g.beginPath();g.ellipse(6,-5,11,8,0,0,TAU);g.fill();
  g.fillStyle='rgba(200,170,120,.25)';for(let i=0;i<14;i++){g.fillRect(-26+R(i)*20,-12+R(i+3)*14,1,2)}
}
function puddle(g,t){
  g.fillStyle='#5c4630';g.beginPath();g.ellipse(0,2,64,20,0,0,TAU);g.fill();
  const w=g.createLinearGradient(0,-16,0,16);w.addColorStop(0,'#3b5a7e');w.addColorStop(1,'#22374f');g.fillStyle=w;g.beginPath();g.ellipse(0,0,58,16,0,0,TAU);g.fill();
  g.save();g.beginPath();g.ellipse(0,0,58,16,0,0,TAU);g.clip();
  g.fillStyle='rgba(220,230,255,.6)';for(let i=0;i<10;i++)g.fillRect(-50+R(i+60)*100,-12+R(i+70)*22,1,1);
  for(let i=0;i<6;i++){const a=t*.7+i*TAU/6,x=Math.cos(a)*(22+R(i)*16),y=Math.sin(a*1.3)*7;const dir=Math.sign(-Math.sin(a))||1;g.save();g.translate(x,y);g.scale(dir,1);
    g.strokeStyle='rgba(235,225,200,.9)';g.lineWidth=2.2;g.beginPath();g.moveTo(-6,0);g.quadraticCurveTo(1,-3,8,0);g.stroke();
    g.strokeStyle='rgba(240,230,210,.6)';g.lineWidth=.8;for(let k=0;k<5;k++){const lx=-2+k*2.2;g.beginPath();g.moveTo(lx,-1);g.lineTo(lx+Math.sin(t*14+k)*1.2,3);g.stroke()}
    g.strokeStyle='#ff3b2f';g.lineWidth=2;g.beginPath();g.moveTo(-6,0);g.lineTo(-11,1);g.stroke();
    g.fillStyle='#ff3b2f';g.beginPath();g.moveTo(-11,1);g.lineTo(-15,-1.5);g.lineTo(-14,3);g.fill();
    g.fillStyle='#111';g.beginPath();g.arc(8.5,-.5,1,0,TAU);g.fill();g.restore()}
  g.restore();
}
function poorwill(g,t){
  const bob=Math.sin(t*1.1)*.8;g.translate(0,bob);
  g.fillStyle='#7d6c57';g.beginPath();g.ellipse(-4,0,18,9,-.1,0,TAU);g.fill();
  g.fillStyle='#6a5a47';g.beginPath();g.moveTo(-18,-2);g.lineTo(-30,2);g.lineTo(-18,5);g.fill();
  g.fillStyle='#8e7c65';g.beginPath();g.arc(10,-6,8,0,TAU);g.fill();
  g.fillStyle='#e9e0cc';g.fillRect(4,0,10,2);
  g.fillStyle='#5a4a39';for(let i=0;i<8;i++){g.beginPath();g.arc(-16+R(i+30)*24,-5+R(i+40)*9,1.3,0,TAU);g.fill()}
  g.fillStyle='#222';g.beginPath();g.moveTo(17,-6);g.lineTo(20,-5);g.lineTo(17,-4);g.fill();
  g.fillStyle='#120c08';g.beginPath();g.arc(10,-8,2.6,0,TAU);g.fill();
}

// ---------- state ----------
let shoot=null,beam={x:0,y:0,tx:0,ty:0},last=performance.now(),t0=last,lastMove=-1e9,lightsOn=false,touchy=matchMedia('(hover: none)').matches,dragging=false,doneToast=false;
const toast=document.getElementById('hl-toast');
function aimAt(e){const r=hero.getBoundingClientRect();beam.tx=e.clientX-r.left;beam.ty=e.clientY-r.top;lastMove=performance.now()}
hero.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'||dragging)aimAt(e)});
hero.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'){dragging=true;aimAt(e)}});
addEventListener('pointerup',()=>dragging=false);
hero.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')lastMove=-1e9});
function setMode(m){lightsOn=m==='truck';hero.classList.toggle('truck',lightsOn);hero.querySelectorAll('.hl-mode button').forEach(b=>{b.classList.toggle('on',b.dataset.m===m);b.setAttribute('aria-pressed',b.dataset.m===m)});if(lightsOn)animals.forEach(a=>found(a,(performance.now()-t0)/1000,true));if(reduce)draw((performance.now()-t0)/1000,0)}
hero.querySelectorAll('.hl-mode button').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.m)));

function found(a,t,quiet){if(a.found)return;a.found=true;a.at=quiet?-99:t;a.chip.classList.add('on');a.chip.setAttribute('aria-label',a.name+' (found)');const n=animals.filter(x=>x.found).length;count.textContent=`${n} / ${animals.length}`;if(n===animals.length&&!doneToast&&!quiet){doneToast=true;toast.classList.add('on');setTimeout(()=>toast.classList.remove('on'),3800)}}

function pos(a,t){const lat=a.move?a.move(t):a.lat;return P(lat,a.d)}

function draw(t,dt){
  const now=performance.now();
  // beam target: pointer, or auto-sweep when idle / on touch
  const idle=now-lastMove>3500;
  if(idle&&!dragging){beam.tx=W*(mobile?.5:.64)+W*(mobile?.36:.26)*Math.sin(t*.23);beam.ty=hy+(H-hy)*(.5+.38*Math.sin(t*.37+1))}
  const k=1-Math.exp(-dt*(idle?2.5:12));beam.x+=(beam.tx-beam.x)*k;beam.y+=(beam.ty-beam.y)*k;
  const BR=Math.min(W,H)*(mobile?.26:.2);

  // 1. lit scene buffer
  nx.clearRect(0,0,W,H);nx.drawImage(bg,0,0,W,H);
  const order=[...animals].sort((a,b)=>a.d-b.d);
  for(const a of order){const p=pos(a,t);nx.save();nx.translate(p.x,p.y);const z=p.s*(a.size||1);nx.scale(z,z);a.draw(nx,t);nx.restore();a.p=p}

  // 2. base: night sky + darkened ground
  const sg=ctx.createLinearGradient(0,0,0,hy);sg.addColorStop(0,'#03050f');sg.addColorStop(1,'#151b3a');ctx.fillStyle=sg;ctx.fillRect(0,0,W,hy+2);
  ctx.globalAlpha=.85+.15*Math.sin(t*.5);ctx.drawImage(sky,0,0,W,H);ctx.globalAlpha=1;
  ctx.drawImage(scn,0,0,W,H);
  ctx.fillStyle=lightsOn?'rgba(4,6,18,.3)':'rgba(4,6,18,.93)';ctx.fillRect(0,hy,W,H);
  ctx.drawImage(mtn,0,0,W,H);
  // shooting stars
  if(!reduce&&!shoot&&Math.random()<dt/7)shoot={x:W*(.25+Math.random()*.7),y:hy*(.05+Math.random()*.35),a:Math.PI*(.78+Math.random()*.12),t:0,len:90+Math.random()*90};
  if(shoot){shoot.t+=dt;const p=shoot.t/.9;if(p>=1)shoot=null;else{const v=W*.35,hx=shoot.x+Math.cos(shoot.a)*v*p,hy2=shoot.y+Math.sin(shoot.a)*v*p;const tx=hx-Math.cos(shoot.a)*shoot.len,ty=hy2-Math.sin(shoot.a)*shoot.len;const al=Math.sin(p*Math.PI);const g=ctx.createLinearGradient(hx,hy2,tx,ty);g.addColorStop(0,`rgba(255,255,255,${al})`);g.addColorStop(1,'rgba(255,255,255,0)');ctx.strokeStyle=g;ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(hx,hy2);ctx.lineTo(tx,ty);ctx.stroke()}}
  if(lightsOn){const g=ctx.createRadialGradient(vx,H*1.15,0,vx,H*1.15,H*.9);g.addColorStop(0,'rgba(255,235,190,.16)');g.addColorStop(1,'rgba(255,235,190,0)');ctx.fillStyle=g;ctx.fillRect(0,hy,W,H-hy)}

  // 3. headlamp beam
  if(!lightsOn){
    mx.globalCompositeOperation='source-over';mx.clearRect(0,0,W,H);mx.drawImage(scn,0,0,W,H);
    mx.globalCompositeOperation='destination-in';
    const g=mx.createRadialGradient(beam.x,beam.y,0,beam.x,beam.y,BR);g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.55,'rgba(0,0,0,.85)');g.addColorStop(1,'rgba(0,0,0,0)');mx.fillStyle=g;mx.fillRect(0,0,W,H);
    mx.globalCompositeOperation='source-over';
    ctx.drawImage(bm,0,0,W,H);
    const h=ctx.createRadialGradient(beam.x,beam.y,0,beam.x,beam.y,BR*1.5);h.addColorStop(0,'rgba(255,236,200,.10)');h.addColorStop(1,'rgba(255,236,200,0)');ctx.fillStyle=h;ctx.fillRect(0,0,W,H);
  }

  // 4. eyeshine glints in the dark + discovery
  for(const a of animals){const p=a.p,d=Math.hypot(p.x-beam.x,p.y-beam.y);
    if(!lightsOn&&!reduce){if(d<BR*.55){a.dwell+=dt;if(a.dwell>.35)found(a,t)}else a.dwell=Math.max(0,a.dwell-dt)}
    const lit=lightsOn||d<BR*.8;
    if(!lit){const near=Math.max(0,1-d/(W*.6));const tw=a.strong?.9:(.25+.75*Math.max(0,Math.sin(t*1.3+a.d*20))**6);const al=Math.min(1,tw*(.35+near));
      for(const[ex,ey]of a.eyes){const dir=a.id==='bufo'?-1:1;const z=p.s*(a.size||1);const x=p.x+ex*z*dir,y=p.y+ey*z;const r=(a.strong?3.2:2)*Math.max(.7,p.s);
        const gg=ctx.createRadialGradient(x,y,0,x,y,r*4);gg.addColorStop(0,a.eye);gg.addColorStop(1,'rgba(0,0,0,0)');ctx.globalAlpha=al*.5;ctx.fillStyle=gg;ctx.fillRect(x-r*4,y-r*4,r*8,r*8);ctx.globalAlpha=al;ctx.fillStyle=a.eye;ctx.beginPath();ctx.arc(x,y,r*.6,0,TAU);ctx.fill();ctx.globalAlpha=1}}
  }

  // 5. field-note labels
  let best=null,bd=1e9;for(const a of animals){if(!a.found)continue;const d=Math.hypot(a.p.x-beam.x,a.p.y-beam.y);if(d<bd){bd=d;best=a}}
  const used=[];
  for(const a of animals){if(!a.found||a===best&&bd<BR*1.2)continue;const fresh=t-a.at<3.5;if(lightsOn||fresh)tag(a,a.p,lightsOn?1:Math.min(1,3.5-(t-a.at)),used)}
  if(best&&bd<BR*1.2){label(best,best.p,Math.max(0,Math.min(1,(BR*1.2-bd)/(BR*.4))),t)}

  // cursor ring
  if(!touchy&&!idle&&!lightsOn)flashlight(beam.x,beam.y);
}

function label(a,p,al,t){
  ctx.save();ctx.globalAlpha=al;
  const side=p.x>W*.78?-1:1;const z=p.s*(a.size||1);const lx=p.x+side*(30+40*z),ly=p.y-60*z-26;
  ctx.font='italic 15px Newsreader, Georgia, serif';const w1=ctx.measureText(a.sci).width;
  ctx.font='600 10.5px "JetBrains Mono", monospace';const nm=a.name.toUpperCase();const w2=ctx.measureText(nm).width;
  ctx.font='400 11px "JetBrains Mono", monospace';const lines=wrap(a.note,230);const w3=Math.max(...lines.map(l=>ctx.measureText(l).width));
  const bw=Math.max(w1,w2,w3)+22,bh=46+lines.length*15;let bx0=side>0?lx:lx-bw;bx0=Math.max(8,Math.min(W-bw-8,bx0));const by0=Math.max(8,Math.min(H-74-bh,ly-bh));
  ctx.strokeStyle='rgba(140,157,240,.8)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.x,p.y-20*p.s);ctx.lineTo(side>0?bx0:bx0+bw,by0+bh);ctx.stroke();
  ctx.fillStyle='rgba(8,11,30,.82)';ctx.beginPath();ctx.roundRect(bx0,by0,bw,bh,8);ctx.fill();ctx.stroke();
  ctx.fillStyle='#8C9DF0';ctx.font='600 10.5px "JetBrains Mono", monospace';ctx.fillText(nm,bx0+10,by0+17);
  ctx.fillStyle='#EDEFF7';ctx.font='italic 15px Newsreader, Georgia, serif';ctx.fillText(a.sci,bx0+10,by0+35);
  ctx.fillStyle='#B8C0E0';ctx.font='400 11px "JetBrains Mono", monospace';lines.forEach((l,i)=>ctx.fillText(l,bx0+10,by0+52+i*15));
  ctx.restore();
}
function tag(a,p,al,used){
  ctx.save();ctx.globalAlpha=al;ctx.font='600 10px "JetBrains Mono", monospace';const nm=a.name.toUpperCase();const w=ctx.measureText(nm).width+14,h=20;
  let x=Math.max(6,Math.min(W-w-6,p.x-w/2)),y=p.y-46*p.s*(a.size||1)-h;
  for(let k=0;k<12;k++){const hit=used.find(u=>x<u.x+u.w&&x+w>u.x&&y<u.y+u.h+3&&y+h+3>u.y);if(!hit)break;y=hit.y-h-4}
  y=Math.min(y,H-74-h);used.push({x,y,w,h});
  ctx.strokeStyle='rgba(140,157,240,.6)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.x,p.y-14*p.s);ctx.lineTo(Math.max(x+6,Math.min(x+w-6,p.x)),y+h);ctx.stroke();
  ctx.fillStyle='rgba(8,11,30,.8)';ctx.beginPath();ctx.roundRect(x,y,w,h,10);ctx.fill();ctx.stroke();
  ctx.fillStyle='#EDEFF7';ctx.fillText(nm,x+7,y+13.5);ctx.restore();
}
function flashlight(x,y){
  // torch sits below-right of the spot and points at it, with a faint beam between
  const fx=x+(x>W-70?-46:46),fy=y+(y>H-80?-62:62),ang=Math.atan2(y-fy,x-fx);
  const g=ctx.createLinearGradient(fx,fy,x,y);g.addColorStop(0,'rgba(255,236,190,.22)');g.addColorStop(1,'rgba(255,236,190,0)');
  ctx.fillStyle=g;ctx.beginPath();const px=Math.cos(ang+Math.PI/2),py=Math.sin(ang+Math.PI/2);
  ctx.moveTo(fx+px*5,fy+py*5);ctx.lineTo(x+px*26,y+py*26);ctx.lineTo(x-px*26,y-py*26);ctx.lineTo(fx-px*5,fy-py*5);ctx.fill();
  ctx.save();ctx.translate(fx,fy);ctx.rotate(ang);
  ctx.fillStyle='#1d2547';ctx.strokeStyle='#8C9DF0';ctx.lineWidth=1.3;
  ctx.beginPath();ctx.roundRect(-30,-5,24,10,3);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(-7,-5);ctx.lineTo(2,-8);ctx.lineTo(2,8);ctx.lineTo(-7,5);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#ffe9b8';ctx.beginPath();ctx.ellipse(2.5,0,2,7,0,0,TAU);ctx.fill();
  ctx.fillStyle='#8C9DF0';ctx.fillRect(-22,-2,5,4);
  ctx.restore();
}
function wrap(s,w){const out=[];let cur='';for(const word of s.split(' ')){const tr=cur?cur+' '+word:word;if(ctx.measureText(tr).width>w&&cur){out.push(cur);cur=word}else cur=tr}if(cur)out.push(cur);return out}
function fit(s,w){if(ctx.measureText(s).width<=w)return s;while(s.length&&ctx.measureText(s+'…').width>w)s=s.slice(0,-1);return s+'…'}

let visible=true;new IntersectionObserver(es=>visible=es[0].isIntersecting).observe(hero);
function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(visible&&!document.hidden)draw((now-t0)/1000,dt);requestAnimationFrame(loop)}
addEventListener('resize',()=>{resize();if(reduce)draw(0,0)});
resize();beam.x=beam.tx=W*.64;beam.y=beam.ty=hy+(H-hy)*.5;
if(reduce){setMode('truck');document.fonts.ready.then(()=>draw(0,0));draw(0,0);
  // still allow turning the headlamp on once, as a single static frame per move
  hero.addEventListener('pointermove',()=>{if(!lightsOn)draw((performance.now()-t0)/1000,.016)})}
else requestAnimationFrame(loop);
})();
