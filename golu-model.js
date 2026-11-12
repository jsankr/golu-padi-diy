/* Scene, materials and piece builder. Units are inches. Every sheet-cut piece carries an id that matches the cut plan.
   Look: studio render. Filmic tone mapping, image-based lighting from a procedural softbox room,
   procedural birch plywood (grain on faces, ply layers on cut edges), brushed steel and brass hardware. */
(function(){
  var GP=window.GP={};
  var C=GP.C={T:.75,D:12,TW:11.85,L:72,FT:.75,PTP:.47,WL:35.53,WT:4.47,B:1.1,L0:24.33,LD:6.67,LINK:26.33,LH:1.75,PANEL:66.47};
  var Z=GP.Z=[5,36,67], LET='ABC';
  var PTB=[.75,.47,.47], GAPB=[2.97,3.53,3.53];
  GP.YA={6:2.0,30:4.2};
  GP.FOOTX=[6,18,30];
  GP.state={mode:'explode',rise:6,e:0,p:0,colorBy:'type',show:{treads:true,panels:true,links:true,dolls:true}};
  GP.pid={}; GP.sheetOf={};

  var stage=document.getElementById('stage');
  var renderer=GP.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.setClearColor(0x000000,0);
  renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.82;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  stage.insertBefore(renderer.domElement,stage.firstChild);
  var ANISO=renderer.capabilities&&renderer.capabilities.getMaxAnisotropy?Math.min(8,renderer.capabilities.getMaxAnisotropy()):1;

  var scene=GP.scene=new THREE.Scene();
  var camera=GP.camera=new THREE.PerspectiveCamera(30,1,1,4000);
  var controls=GP.controls=new THREE.OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true; controls.dampingFactor=.07;
  controls.maxPolarAngle=Math.PI*0.48; controls.minDistance=60; controls.maxDistance=1100;
  controls.autoRotateSpeed=.55;

  /* ---------- image-based lighting: a softbox studio rendered once into a prefiltered env map ---------- */
  (function(){
    if(!THREE.PMREMGenerator) return;
    var env=new THREE.Scene();
    function panel(w,h,k,x,y,z,rx,ry,tint){
      var m=new THREE.MeshBasicMaterial({color:tint||0xffffff,side:THREE.DoubleSide});
      m.color.multiplyScalar(k);
      var p=new THREE.Mesh(new THREE.PlaneGeometry(w,h),m); p.position.set(x,y,z); p.rotation.set(rx||0,ry||0,0); env.add(p);
    }
    var room=new THREE.Mesh(new THREE.BoxGeometry(80,40,80),new THREE.MeshBasicMaterial({color:0x3e4045,side:THREE.BackSide}));
    room.position.y=18; env.add(room);
    var floorEnv=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshBasicMaterial({color:0x8a837a}));
    floorEnv.rotation.x=-Math.PI/2; floorEnv.position.y=-1.9; env.add(floorEnv);
    panel(34,34,2.2,0,37,0,Math.PI/2,0);                       /* overhead softbox */
    panel(22,26,3.4,-38,14,10,0,Math.PI/2,0xffe6c8);           /* warm key, left */
    panel(18,22,1.0,38,12,-8,0,-Math.PI/2,0xdde8ff);           /* cool fill, right */
    panel(40,8,3.0,0,22,-38,0,0);                              /* rim strip, back */
    panel(16,10,1.4,10,8,38,0,Math.PI);                        /* front kicker */
    var pm=new THREE.PMREMGenerator(renderer);
    var rt=pm.fromScene(env,.035);
    scene.environment=rt.texture;
    pm.dispose();
  })();

  scene.add(new THREE.HemisphereLight(0xfff6ea,0x6b625a,.22));
  var sun=new THREE.DirectionalLight(0xffe9cf,1.25);
  sun.position.set(-150,280,190); sun.castShadow=true; sun.shadow.mapSize.set(4096,4096);
  sun.shadow.bias=-.00025; sun.shadow.normalBias=.04;
  var sc=sun.shadow.camera; sc.left=-280;sc.right=280;sc.top=280;sc.bottom=-280;sc.near=10;sc.far=900;
  scene.add(sun);
  var rim=new THREE.DirectionalLight(0xd9e6ff,.35); rim.position.set(220,120,-200); scene.add(rim);
  var floor=new THREE.Mesh(new THREE.PlaneGeometry(2400,2400),new THREE.ShadowMaterial({opacity:.32}));
  floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);
  GP.floor=floor;

  var root=GP.root=new THREE.Group(); root.position.set(-54,0,-36); scene.add(root);

  /* ---------- procedural plywood textures ---------- */
  function rnd(seed){return function(){seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};}
  function canvas(w,h){var c=document.createElement('canvas'); c.width=w; c.height=h; return c;}
  function tex(c,srgb){
    var t=new THREE.CanvasTexture(c);
    t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=ANISO;
    if(srgb) t.encoding=THREE.sRGBEncoding;
    return t;
  }
  /* birch face veneer: long soft grain lines that tile left-right, faint flecks, broad tone bands */
  function faceCanvas(seed){
    var W=1024,H=1024,c=canvas(W,H),g=c.getContext('2d'),r=rnd(seed);
    if(!g||!g.createLinearGradient) return c;
    g.fillStyle='#ead6b4'; g.fillRect(0,0,W,H);
    for(var b=0;b<9;b++){                                 /* broad tone bands */
      var y=r()*H, hh=60+r()*180, gr=g.createLinearGradient(0,y-hh,0,y+hh);
      gr.addColorStop(0,'rgba(196,160,112,0)'); gr.addColorStop(.5,'rgba(176,128,72,'+(.10+r()*.16)+')'); gr.addColorStop(1,'rgba(196,160,112,0)');
      g.fillStyle=gr; g.fillRect(0,y-hh,W,hh*2);
    }
    for(var i=0;i<420;i++){                               /* grain lines */
      var y0=r()*H, k=1+Math.floor(r()*3), amp=2+r()*9, ph=r()*6.28, a=.06+r()*.16, lw=.5+r()*1.9;
      g.strokeStyle='rgba('+(120+Math.floor(r()*30))+','+(80+Math.floor(r()*25))+',40,'+a+')'; g.lineWidth=lw;
      for(var dy=-H;dy<=H;dy+=H){
        g.beginPath();
        for(var x=0;x<=W;x+=16){
          var yy=y0+dy+amp*Math.sin(x/W*6.2832*k+ph)+1.5*Math.sin(x/W*6.2832*7*k+ph*2);
          if(x) g.lineTo(x,yy); else g.moveTo(x,yy);
        }
        g.stroke();
      }
    }
    for(var j=0;j<1400;j++){                              /* pores and flecks */
      g.fillStyle='rgba(110,70,30,'+(.03+r()*.08)+')';
      g.fillRect(r()*W,r()*H,1+r()*6,.6+r()*1.2);
    }
    return c;
  }
  /* cut edge: 7 cross-banded plies with glue lines, tiles along the edge */
  function edgeCanvas(seed){
    var W=512,H=128,c=canvas(W,H),g=c.getContext('2d'),r=rnd(seed),n=7;
    if(!g||!g.createLinearGradient) return c;
    for(var i=0;i<n;i++){
      var y=i*H/n, h=H/n, cross=i%2===1;
      g.fillStyle=cross?'#c99b62':'#e4c795'; g.fillRect(0,y,W,h);
      for(var k=0;k<(cross?160:60);k++){
        g.fillStyle='rgba(90,55,20,'+(.05+r()*.12)+')';
        if(cross) g.fillRect(r()*W,y+r()*h,1+r()*2,h*(.3+r()*.7));
        else g.fillRect(r()*W,y+r()*h,8+r()*40,.8);
      }
      g.fillStyle='rgba(70,40,15,.55)'; g.fillRect(0,y+h-1,W,1.2);
    }
    return c;
  }
  var TX={face:tex(faceCanvas(7),true),edge:tex(edgeCanvas(11),true),bump:tex(faceCanvas(7),false)};
  GP.TX=TX;

  /* UVs from geometry: faces get grain along the longest in-plane axis (1 uv = 24 in), cut edges map plies across the thickness */
  function woodUV(geo){
    var pos=geo.attributes&&geo.attributes.position, nor=geo.attributes&&geo.attributes.normal, uv=geo.attributes&&geo.attributes.uv;
    if(!pos||!nor||!uv) return;
    geo.computeBoundingBox();
    var bb=geo.boundingBox, mn=[bb.min.x,bb.min.y,bb.min.z], mx=[bb.max.x,bb.max.y,bb.max.z];
    var sz=[mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2]];
    var thin=sz.indexOf(Math.min.apply(0,sz)), ax=[0,1,2].filter(function(i){return i!==thin;});
    var a=sz[ax[0]]>=sz[ax[1]]?ax[0]:ax[1], b=a===ax[0]?ax[1]:ax[0];
    for(var i=0;i<pos.count;i++){
      var p=[pos.getX(i),pos.getY(i),pos.getZ(i)], n=[Math.abs(nor.getX(i)),Math.abs(nor.getY(i)),Math.abs(nor.getZ(i))];
      if(n[thin]>.5) uv.setXY(i,p[a]/24,p[b]/24);
      else uv.setXY(i,(n[a]>n[b]?p[b]:p[a])/12,(p[thin]-mn[thin])/sz[thin]);
    }
    uv.needsUpdate=true;
    if(geo.index&&geo.groups&&geo.groups.length===6){          /* box: face groups by normal direction */
      var groups=geo.groups.slice(); geo.clearGroups();
      groups.forEach(function(gr){
        var vi=geo.index.getX(gr.start), isFace=Math.abs([nor.getX(vi),nor.getY(vi),nor.getZ(vi)][thin])>.5;
        geo.addGroup(gr.start,gr.count,isFace?0:1);
      });
    }
    return thin;
  }

  function std(o){return new THREE.MeshStandardMaterial(o);}
  function wood(tint,edgeTint,rough){
    var face=std({color:tint,map:TX.face,bumpMap:TX.bump,bumpScale:.012,roughness:rough||.62,metalness:0,envMapIntensity:.85});
    var edge=std({color:edgeTint||tint,map:TX.edge,roughness:.8,metalness:0,envMapIntensity:.6});
    return [face,edge];
  }
  function glaze(c){
    return THREE.MeshPhysicalMaterial?new THREE.MeshPhysicalMaterial({color:c,roughness:.38,metalness:0,clearcoat:.8,clearcoatRoughness:.15,envMapIntensity:.7})
      :std({color:c,roughness:.35});
  }
  var M=GP.M={
    tread:wood(0xf7e6cc,0xfff4e2,.5), plate:wood(0xdca66a,0xf3d2a4), rib:wood(0xc58d52), foot:wood(0xa36d3c),
    link:wood(0x4f9e93,0xb9e0d8,.5), panel:wood(0xa7cfc1,0xe2f2ec,.6),
    dowel:std({color:0x9a6533,roughness:.7}),
    steel:std({color:0xd3d9de,roughness:.28,metalness:1,envMapIntensity:1.2}),
    pin:std({color:0xe2ad4c,roughness:.24,metalness:1,envMapIntensity:1.25}),
    head:glaze(0xf6dcc0),
    hi:std({color:0xff9a3c,emissive:0xff6a00,emissiveIntensity:.6,roughness:.45})
  };
  var dollCols=[0xb3261e,0x1f6fa3,0x7a3aa0,0xd17a00,0x177a3e].map(glaze);
  var goldTrim=std({color:0xe8b54a,roughness:.3,metalness:1});

  function solid(m){m.castShadow=true; m.receiveShadow=true; return m;}
  function box(w,h,d,mt,x,y,z){
    var g=new THREE.BoxGeometry(w,h,d);
    if(Array.isArray(mt)) woodUV(g);
    var m=solid(new THREE.Mesh(g,mt)); m.position.set(x,y,z); return m;
  }
  function cyl(r,h,mt,x,y,z){
    var m=solid(new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,20),mt)); m.position.set(x,y,z); return m;
  }
  function tag(m,pid){m.userData.pid=pid; m.userData.mat0=m.material; GP.pid[pid]=m; return m;}
  function label(n,x,y,z){
    var c=canvas(128,128), g=c.getContext('2d');
    if(g&&g.createLinearGradient){
      var gr=g.createLinearGradient(0,0,0,128); gr.addColorStop(0,'rgba(40,48,58,.92)'); gr.addColorStop(1,'rgba(14,18,24,.92)');
      g.fillStyle=gr; g.beginPath(); g.arc(64,64,56,0,6.2832); g.fill();
      g.strokeStyle='rgba(255,255,255,.55)'; g.lineWidth=4; g.beginPath(); g.arc(64,64,54,0,6.2832); g.stroke();
      g.fillStyle='#ffd79a'; g.font='700 64px "Plus Jakarta Sans",sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(String(n),64,68);
    }
    var t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding;
    var s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:false,toneMapped:false}));
    s.scale.set(5,5,1); s.position.set(x,y,z); s.renderOrder=5; return s;
  }
  function reg(b,parent,obj,ex,ey,ez){
    parent.add(obj);
    b.pieces.push({obj:obj,base:obj.position.clone(),ex:new THREE.Vector3(ex,ey,ez)});
  }

  /* material state: type colours, sheet colours, highlight */
  var sheetMats={};
  GP.sheetColor=function(n){return new THREE.Color().setHSL(((n-1)*0.618033)%1,.5,.66);};
  GP.refreshMats=function(){
    Object.keys(GP.pid).forEach(function(id){
      var m=GP.pid[id], sel=(GP.hiId===id);
      if(sel){m.material=M.hi; return;}
      if(GP.state.colorBy==='sheet'&&GP.sheetOf[id]){
        var n=GP.sheetOf[id];
        if(!sheetMats[n]) sheetMats[n]=std({color:GP.sheetColor(n),map:TX.face,roughness:.6,envMapIntensity:.8});
        m.material=sheetMats[n];
      } else m.material=m.userData.mat0;
    });
  };
  GP.highlight=function(id){GP.hiId=id||null; GP.refreshMats();};

  function doll(dg,x,top,z,h,col){
    var base=solid(new THREE.Mesh(new THREE.CylinderGeometry(2.3,2.5,.35,28),goldTrim)); base.position.set(x,top+.18,z); dg.add(base);
    var body=solid(new THREE.Mesh(new THREE.ConeGeometry(2.05,h,28),col)); body.position.set(x,top+.35+h/2,z); dg.add(body);
    var collar=solid(new THREE.Mesh(new THREE.CylinderGeometry(.75,.95,.3,20),goldTrim)); collar.position.set(x,top+.35+h-.2,z); dg.add(collar);
    var head=solid(new THREE.Mesh(new THREE.SphereGeometry(1,24,18),M.head)); head.position.set(x,top+.35+h+.75,z); dg.add(head);
    var crown=solid(new THREE.Mesh(new THREE.ConeGeometry(.55,.9,16),goldTrim)); crown.position.set(x,top+.35+h+1.95,z); dg.add(crown);
  }

  GP.build=function(){
    var R=GP.state.rise;
    while(root.children.length) root.remove(root.children[0]);
    GP.blocks=[]; GP.treads=[]; GP.panels=[]; GP.pid={};

    for(var k=0;k<3;k++){
      var Lt=LET[k], pt=PTB[k], gap=GAPB[k], dzp=gap/2+pt/2;
      var bg=new THREE.Group(); root.add(bg);
      var hs=[1,2,3].map(function(j){return (3*k+j)*R-C.T-C.FT;});
      var b={k:k,g:bg,hs:hs,walls:[],pieces:[],links:[],pins:[]};
      var sh=new THREE.Shape();
      sh.moveTo(0,0); sh.lineTo(C.WL,0); sh.lineTo(C.WL,hs[2]); sh.lineTo(24,hs[2]);
      sh.lineTo(24,hs[1]); sh.lineTo(12,hs[1]); sh.lineTo(12,hs[0]); sh.lineTo(0,hs[0]); sh.closePath();
      var geo=new THREE.ExtrudeGeometry(sh,{depth:pt,bevelEnabled:false});
      woodUV(geo);

      for(var s=0;s<3;s++){
        var wg=new THREE.Group(); bg.add(wg); b.walls.push(wg);
        var zc=Z[s], wn=s+1;
        ['a','b'].forEach(function(side){
          var dz=side==='a'?-dzp:dzp;
          var p=solid(new THREE.Mesh(geo,M.plate)); p.position.set(0,0,zc+dz-pt/2);
          tag(p,Lt+wn+side); reg(b,wg,p,0,0,dz>0?6:-6);
          for(var j=0;j<3;j++) reg(b,wg,cyl(.25,1.1,M.dowel,12*j+6,hs[j]+.5,zc+dz),0,34,dz>0?6:-6);
        });
        for(var r=1;r<3;r++){
          var rib=box(10.6,.75,gap-.03,M.rib,12*r+6,hs[r]-2.4,zc);
          tag(rib,'R-'+Lt+wn+(r+1)); reg(b,wg,rib,0,22,0);
        }
        var ft=box(7,C.FT,18,M.foot,GP.FOOTX[s],-C.FT/2,zc);
        tag(ft,'F-'+Lt+wn); reg(b,wg,ft,-24,0,0);
      }

      var n=0;
      for(var q=0;q<2;q++){
        [6,30].forEach(function(xa){
          n++;
          var ya=GP.YA[xa];
          var lm=box(.75,C.LH,C.LINK,M.link,0,0,0); tag(lm,'L-'+Lt+n); bg.add(lm);
          b.links.push({m:lm,q:q,xa:xa,ya:ya});
          [q,q+1].forEach(function(ws){
            var face=ws===q?1:-1;
            var pn=cyl(.32,2.8,M.pin,0,0,0); bg.add(pn);
            b.pins.push({m:pn,s:ws,face:face,xa:xa,ya:ya});
            var tab=box(1.8,.15,2.2,M.steel,xa,ya-.95,Z[ws]+face*(C.WT/2+C.B));
            reg(b,b.walls[ws],tab,0,40,0);
          });
        });
      }
      GP.blocks.push(b);

      var H=Math.min(hs[2]-3,47.5);
      var pg=new THREE.Group(); root.add(pg);
      var pm=box(C.PTP,H,C.PANEL,M.panel,0,0,0); tag(pm,'BP-'+Lt); pg.add(pm);
      GP.panels.push({g:pg,k:k,H:H,base:new THREE.Vector3(36*k+C.WL+C.PTP/2,C.FT+.5+H/2,36)});
    }

    for(var i=1;i<=9;i++){
      var tg=new THREE.Group(); root.add(tg);
      var cx=(i-.5)*C.D, top=i*R;
      var tm=box(C.TW,C.T,C.L,M.tread,cx,top-C.T/2,36); tag(tm,'T'+i); tg.add(tm);
      var lab=label(i,cx,top+2.4,-7.5); tg.add(lab);
      var dg=new THREE.Group(); tg.add(dg);
      var nd=Math.max(3,6-Math.floor(i/3));
      for(var q2=0;q2<nd;q2++){
        var z=36+(q2-(nd-1)/2)*(C.L-12)/Math.max(1,nd-1);
        doll(dg,cx,top,z,3.4+((i+q2)%3)*1.5,dollCols[(i*2+q2)%5]);
      }
      GP.treads.push({g:tg,i:i,cx:cx,dolls:dg,lab:lab});
    }
    GP.refreshMats();
    if(GP.applyState) GP.applyState();
    if(GP.onBuilt) GP.onBuilt();
  };

  var views={
    iso:[-165,105,165,2,24,0], front:[-280,46,0,0,28,0], side:[0,40,290,0,28,0],
    back:[280,80,100,0,28,0], top:[0,360,.1,0,0,0], wide:[-310,240,430,0,10,75],
    hero:[-175,78,215,4,24,2]
  };
  GP.setView=function(n){
    var v=views[n]; camera.position.set(v[0],v[1],v[2]); controls.target.set(v[3],v[4],v[5]); controls.update();
    GP.baseDist=Math.hypot(v[0]-v[3],v[1]-v[4],v[2]-v[5]);
  };
  /* keep the whole model in frame as it explodes: dolly out along the current view direction */
  GP.frameExplode=function(e){
    if(!GP.baseDist) return;
    var t=controls.target, d=camera.position.clone ? camera.position.clone() : null; if(!d) return;
    var dx=d.x-t.x, dy=d.y-t.y, dz=d.z-t.z, L=Math.hypot(dx,dy,dz)||1, want=GP.baseDist*(1+1.05*e);
    camera.position.set(t.x+dx/L*want, t.y+dy/L*want, t.z+dz/L*want); controls.update();
  };
  function resize(){
    var w=stage.clientWidth,h=stage.clientHeight;
    renderer.setSize(w,h,false); camera.aspect=w/h;
    /* keep the same horizontal coverage on tall phone screens */
    var asp=w/h; camera.fov=asp<1.45?Math.min(64,2*Math.atan(Math.tan(16.5*Math.PI/180)/asp)*180/Math.PI):30;
    /* on wide screens the control rail covers the right side: shift the projection so the model centres in the open area */
    var off=w>980?190:0;
    if(camera.setViewOffset){ if(off) camera.setViewOffset(w,h,off,0,w,h); else camera.clearViewOffset(); }
    camera.updateProjectionMatrix();
  }
  if(window.ResizeObserver) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize',resize);
  resize();
  var last=0;
  (function loop(t){
    requestAnimationFrame(loop);
    var dt=Math.min(.05,(t-last)/1000||0); last=t;
    if(GP.onFrame) GP.onFrame(dt);
    controls.update(); renderer.render(scene,camera);
  })(0);
})();
