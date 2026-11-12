/* Headless smoke test: fake THREE + DOM, run all page scripts, drive every mode, check solid-piece collisions (SAT in plan, overlap in height). */
const fs=require('fs'), vm=require('vm');
class V3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z);}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}clone(){return new V3(this.x,this.y,this.z);}addScaledVector(v,s){this.x+=v.x*s;this.y+=v.y*s;this.z+=v.z*s;return this;}}
class O3{constructor(){this.position=new V3();this.rotation={x:0,y:0,z:0,set(a,b,c){this.x=a;this.y=b;this.z=c;}};this.children=[];this.parent=null;this.visible=true;this.userData={};}
  add(c){if(c.parent)c.parent.remove(c);c.parent=this;this.children.push(c);return this;}
  remove(c){const i=this.children.indexOf(c);if(i>=0){this.children.splice(i,1);c.parent=null;}}
  traverse(f){f(this);this.children.forEach(c=>c.traverse(f));}}
class Mesh extends O3{constructor(g,m){super();this.geometry=g;this.material=m;}}
class Col{constructor(){}setHSL(){return this;}multiplyScalar(){return this;}}
class Shape{constructor(){this.pts=[];}moveTo(x,y){this.pts.push([x,y]);}lineTo(x,y){this.pts.push([x,y]);}closePath(){}}
const noop=()=>{};
const T={Vector3:V3,Vector2:class{set(){}},Group:class extends O3{},Mesh,LineSegments:class extends O3{},Sprite:class extends O3{constructor(){super();this.scale=new V3();}},
  Shape,BoxGeometry:class{constructor(w,h,d){this.k='box';this.s=[w,h,d];}},
  ExtrudeGeometry:class{constructor(s,o){this.k='ext';this.p=s.pts;this.d=o.depth;}},
  CylinderGeometry:class{constructor(){this.k='cyl';}},ConeGeometry:class{constructor(){this.k='cone';}},SphereGeometry:class{constructor(){this.k='sph';}},PlaneGeometry:class{},
  EdgesGeometry:class{constructor(g){this.g=g;}},MeshStandardMaterial:class{constructor(o){Object.assign(this,o);this.color=new Col();}},MeshPhysicalMaterial:class{constructor(o){Object.assign(this,o);}},MeshBasicMaterial:class{constructor(o){Object.assign(this,o);this.color=new Col();}},
  PMREMGenerator:class{fromScene(){return {texture:{}};}dispose(){}},sRGBEncoding:1,ACESFilmicToneMapping:1,RepeatWrapping:1,BackSide:1,DoubleSide:2,LineBasicMaterial:class{},ShadowMaterial:class{},SpriteMaterial:class{},
  CanvasTexture:class{},Color:Col,HemisphereLight:class extends O3{},
  DirectionalLight:class extends O3{constructor(){super();this.shadow={mapSize:{set:noop},camera:{}};}},AmbientLight:class extends O3{},GridHelper:class extends O3{constructor(){super();this.material={};}},
  Scene:class extends O3{},PerspectiveCamera:class extends O3{updateProjectionMatrix(){}},
  WebGLRenderer:class{constructor(){this.domElement=el('canvas');this.shadowMap={};this.capabilities={getMaxAnisotropy:()=>8};}setPixelRatio(){}setClearColor(){}setSize(){}render(){}},
  OrbitControls:class{constructor(){this.target=new V3();}update(){}},
  Raycaster:class{setFromCamera(){}intersectObjects(){return [];}},PCFSoftShadowMap:1};
const CTX=new Proxy(function(){},{get:()=>CTX,apply:()=>CTX,set:()=>true});
const els={};
function el(id){return els[id]||(els[id]={id,addEventListener:noop,setAttribute:noop,innerHTML:'',textContent:'',value:'',hidden:false,checked:true,clientWidth:900,clientHeight:600,
  closest:()=>null,insertBefore:noop,firstChild:null,style:{},dataset:{},getBoundingClientRect:()=>({left:0,top:0,width:900,height:600}),
  getContext:()=>CTX,classList:{toggle:noop}});}
global.window=global; global.THREE=T;
global.document={getElementById:el,createElement:()=>el('c'+Math.random()),querySelectorAll:()=>[]};
global.requestAnimationFrame=noop; global.devicePixelRatio=1; global.addEventListener=noop;
const src=f=>fs.readFileSync(__dirname+'/'+f,'utf8');
for(const f of ['golu-model.js','golu-cuts.js','golu-cutui.js','golu-anim.js']) vm.runInThisContext(src(f),{filename:f});
const GP=global.GP, S=GP.state;
console.log('loaded; blocks',GP.blocks.length,'treads',GP.treads.length,'panels',GP.panels.length,'pids',Object.keys(GP.pid).length);

/* solids: list of rotated rects in plan (x,z) with a y range */
function solids(m){
  let x=0,y=0,z=0,rotz=0;
  for(let o=m;o;o=o.parent){x+=o.position.x;y+=o.position.y;z+=o.position.z; if(o.rotation&&o.rotation.z) rotz=o.rotation.z;}
  const g=m.geometry, out=[], ang=m.rotation.y||0;
  const ax=(cx,cz,hx,hz,y0,y1,a)=>out.push({cx,cz,hx,hz,a:a||0,y0,y1});
  if(g.k==='box'){
    let [w,h,d]=g.s;
    if(rotz){ ax(x,z,h/2,d/2,y-w/2,y+w/2,0); }   /* panel lying flat after -90 deg about z: height becomes x extent */
    else ax(x,z,w/2,d/2,y-h/2,y+h/2,ang);
  } else if(g.k==='ext'){
    const p=g.p, WL=p[1][0], h2=p[2][1], h1=p[4][1], h0=p[6][1];
    [[0,12,h0],[12,24,h1],[24,WL,h2]].forEach(c=>ax(x+(c[0]+c[1])/2,z+g.d/2,(c[1]-c[0])/2,g.d/2,y,y+c[2],0));
  }
  return out;
}
function corners(s){const c=Math.cos(s.a),n=Math.sin(s.a);return [[-s.hx,-s.hz],[s.hx,-s.hz],[s.hx,s.hz],[-s.hx,s.hz]].map(([u,v])=>[s.cx+u*c+v*n,s.cz-u*n+v*c]);}
function axes(s){const c=Math.cos(s.a),n=Math.sin(s.a);return [[c,-n],[n,c]];}
function hit(a,b,e){
  const oy=Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0); if(oy<=e) return null;
  const ca=corners(a), cb=corners(b); let minO=1e9;
  for(const ax of [...axes(a),...axes(b)]){
    const pa=ca.map(p=>p[0]*ax[0]+p[1]*ax[1]), pb=cb.map(p=>p[0]*ax[0]+p[1]*ax[1]);
    const o=Math.min(Math.max(...pa),Math.max(...pb))-Math.max(Math.min(...pa),Math.min(...pb));
    if(o<=e) return null; minO=Math.min(minO,o);
  }
  return [minO,oy];
}
function vis(m){for(let o=m;o;o=o.parent) if(o.visible===false) return false; return true;}
function check(label){
  const ids=Object.keys(GP.pid).filter(i=>vis(GP.pid[i]));
  const sol=ids.map(i=>({id:i,s:solids(GP.pid[i])}));
  const bad=[];
  for(let i=0;i<sol.length;i++)for(let j=i+1;j<sol.length;j++){
    let h=null;
    for(const a of sol[i].s){for(const b of sol[j].s){const r=hit(a,b,0.03); if(r){h=r;break;}} if(h)break;}
    if(h) bad.push(sol[i].id+' x '+sol[j].id+' ('+h[0].toFixed(2)+','+h[1].toFixed(2)+')');
  }
  console.log(label.padEnd(24),bad.length?('OVERLAPS '+bad.length+': '+bad.slice(0,6).join(' | ')):'ok');
  return bad.length;
}
let fails=0;
for(const R of [6,5]){
  S.rise=R; GP.build();
  console.log('--- riser',R);
  S.mode='explode'; S.e=0; GP.applyState(); fails+=check('assembled');
  S.e=100; GP.applyState(); fails+=check('exploded 100%'); S.e=0; GP.applyState();
  S.mode='pack';
  for(let p=0;p<=1.0001;p+=0.01){S.p=Math.min(1,p);GP.applyState();fails+=check('pack p='+S.p.toFixed(2));}
  S.mode='cut'; S.p=0; GP.cutActivate(true); GP.applyState(); GP.highlight('A1a'); GP.highlight(null);
}
console.log(fails?('TOTAL OVERLAP STATES: '+fails):'all states clear');
