/* Scene, materials and piece builder. Units are inches. Every sheet-cut piece carries an id that matches the cut plan. */
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
  var renderer=GP.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  stage.insertBefore(renderer.domElement,stage.firstChild);

  var scene=GP.scene=new THREE.Scene();
  var camera=GP.camera=new THREE.PerspectiveCamera(36,1,1,3000);
  var controls=GP.controls=new THREE.OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true; controls.dampingFactor=.08;
  controls.maxPolarAngle=Math.PI*0.495; controls.minDistance=60; controls.maxDistance=900;

  scene.add(new THREE.HemisphereLight(0xffffff,0x8a97a0,.75));
  var sun=new THREE.DirectionalLight(0xffffff,.8);
  sun.position.set(-120,260,170); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048);
  var sc=sun.shadow.camera; sc.left=-260;sc.right=260;sc.top=260;sc.bottom=-260;sc.near=10;sc.far=800;
  scene.add(sun);
  var floor=new THREE.Mesh(new THREE.PlaneGeometry(1600,1600),new THREE.ShadowMaterial({opacity:.22}));
  floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);
  var grid=new THREE.GridHelper(960,80,0x7d8b95,0x7d8b95);
  grid.material.transparent=true; grid.material.opacity=.2; grid.position.y=.02; scene.add(grid);

  var root=GP.root=new THREE.Group(); root.position.set(-54,0,-36); scene.add(root);

  function mat(c,r,m){return new THREE.MeshStandardMaterial({color:c,roughness:r||.85,metalness:m||0});}
  var M=GP.M={tread:mat(0xdcbd8c),plate:mat(0xc08a4c),rib:mat(0xa97439,.9),foot:mat(0x8e6330,.9),
    dowel:mat(0x6b4a22,.9),link:mat(0x3f8f8a,.8),pin:mat(0xe3b341,.4,.3),panel:mat(0x8cc2b4,.85),
    head:mat(0xf0d6b8,.7),steel:mat(0x8d98a1,.4,.6),hi:new THREE.MeshStandardMaterial({color:0xff8a1f,emissive:0xff6a00,emissiveIntensity:.55,roughness:.6})};
  var edgeMat=new THREE.LineBasicMaterial({color:0x4a3318,transparent:true,opacity:.55});
  var dollCols=[0xc0392b,0x2e86ab,0x8e44ad,0xd68910,0x1e8449];

  function edged(m){
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry),edgeMat));
    m.castShadow=true; m.receiveShadow=true; return m;
  }
  function box(w,h,d,mt,x,y,z){
    var m=edged(new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mt)); m.position.set(x,y,z); return m;
  }
  function cyl(r,h,mt,x,y,z){
    var m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,14),mt); m.position.set(x,y,z); m.castShadow=true; return m;
  }
  function tag(m,pid){m.userData.pid=pid; m.userData.mat0=m.material; GP.pid[pid]=m; return m;}
  function label(n,x,y,z){
    var c=document.createElement('canvas'); c.width=c.height=64;
    var g=c.getContext('2d');
    g.fillStyle='#17232c'; g.beginPath(); g.arc(32,32,28,0,6.3); g.fill();
    g.fillStyle='#f3f5f6'; g.font='bold 36px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(String(n),32,34);
    var s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:false}));
    s.scale.set(5.5,5.5,1); s.position.set(x,y,z); s.renderOrder=5; return s;
  }
  function reg(b,parent,obj,ex,ey,ez){
    parent.add(obj);
    b.pieces.push({obj:obj,base:obj.position.clone(),ex:new THREE.Vector3(ex,ey,ez)});
  }

  /* material state: type colours, sheet colours, highlight */
  var sheetMats={};
  GP.sheetColor=function(n){return new THREE.Color().setHSL(((n-1)*0.618033)%1,.55,.62);};
  GP.refreshMats=function(){
    Object.keys(GP.pid).forEach(function(id){
      var m=GP.pid[id], sel=(GP.hiId===id);
      if(sel){m.material=M.hi; return;}
      if(GP.state.colorBy==='sheet'&&GP.sheetOf[id]){
        var n=GP.sheetOf[id];
        if(!sheetMats[n]) sheetMats[n]=new THREE.MeshStandardMaterial({color:GP.sheetColor(n),roughness:.8});
        m.material=sheetMats[n];
      } else m.material=m.userData.mat0;
    });
  };
  GP.highlight=function(id){GP.hiId=id||null; GP.refreshMats();};

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

      for(var s=0;s<3;s++){
        var wg=new THREE.Group(); bg.add(wg); b.walls.push(wg);
        var zc=Z[s], wn=s+1;
        ['a','b'].forEach(function(side){
          var dz=side==='a'?-dzp:dzp;
          var p=edged(new THREE.Mesh(geo,M.plate)); p.position.set(0,0,zc+dz-pt/2);
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
      tg.add(label(i,cx,top+2,-7));
      var dg=new THREE.Group(); tg.add(dg);
      var nd=Math.max(3,6-Math.floor(i/3));
      for(var q2=0;q2<nd;q2++){
        var z=36+(q2-(nd-1)/2)*(C.L-12)/Math.max(1,nd-1);
        var h=3.6+((i+q2)%3)*1.6;
        var body=new THREE.Mesh(new THREE.ConeGeometry(2.1,h,14),mat(dollCols[(i*2+q2)%5],.6));
        body.position.set(cx,top+h/2,z); body.castShadow=true; dg.add(body);
        var head=new THREE.Mesh(new THREE.SphereGeometry(1,14,12),M.head);
        head.position.set(cx,top+h+.8,z); head.castShadow=true; dg.add(head);
      }
      GP.treads.push({g:tg,i:i,cx:cx,dolls:dg});
    }
    GP.refreshMats();
    if(GP.applyState) GP.applyState();
    if(GP.onBuilt) GP.onBuilt();
  };

  var views={
    iso:[-150,95,150,0,26,0], front:[-260,40,0,0,28,0], side:[0,35,270,0,28,0],
    back:[260,70,90,0,28,0], top:[0,330,.1,0,0,0], wide:[-300,230,420,0,10,75]
  };
  GP.setView=function(n){
    var v=views[n]; camera.position.set(v[0],v[1],v[2]); controls.target.set(v[3],v[4],v[5]); controls.update();
  };
  function resize(){
    var w=stage.clientWidth,h=stage.clientHeight;
    renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix();
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
