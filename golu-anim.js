/* Piece explosion, hinged-link folding, pack/stack timeline and mode switching. */
(function(){
  var GP=window.GP, C=GP.C, S=GP.state, Z=GP.Z;
  var SIG=[-1,1,1], FOLD=84*Math.PI/180;
  var SPREAD=[-26,0,26], XF=[24.2,0,0], ZF=[0,38.5,77];
  var TREAD_STACK={x:30,z:175}, PANEL_STACK={x:100,z:175};
  var $=function(id){return document.getElementById(id);};

  function clamp(x){return Math.max(0,Math.min(1,x));}
  function seg(p,a,b){return clamp((p-a)/(b-a));}
  function ez(t){return t*t*(3-2*t);}
  function route(v,pts,u){
    var n=pts.length-1, f=clamp(u)*n, i=Math.min(n-1,Math.floor(f)), t=ez(f-i), a=pts[i], b=pts[i+1];
    v.set(a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t);
  }

  GP.applyState=function(){
    var pack=S.mode==='pack', e=pack?0:S.e/100, p=pack?S.p:0, R=S.rise;
    var s3=ez(seg(p,.52,.58)), th=FOLD*ez(seg(p,.58,.76)), s5a=ez(seg(p,.76,.85)), s5b=ez(seg(p,.85,1));
    var sin=Math.sin(th), cos=Math.cos(th);
    var d=C.L0*cos+C.LD;                       /* wall-to-wall spacing, 31 in when open */
    var off=C.WT/2+C.B;

    GP.blocks.forEach(function(b){
      var k=b.k, x0=36*k+SPREAD[k]*s3;
      x0+=(XF[k]-(36*k+SPREAD[k]))*s5b;
      b.g.position.set(x0+(k-1)*62*e, C.FT, ZF[k]*s5a);
      for(var s=0;s<3;s++){
        var dx=s===1?SIG[k]*C.L0*sin:0;
        b.walls[s].position.set(dx,0,s*(d-31)+(s-1)*38*e);
      }
      b.pieces.forEach(function(pc){pc.obj.position.copy(pc.base).addScaledVector(pc.ex,e);});
      function pv(s,xa,ya,face){return {x:xa+(s===1?SIG[k]*C.L0*sin:0), y:ya, z:Z[s]+s*(d-31)+(s-1)*38*e+face*off};}
      b.links.forEach(function(l){
        var a=pv(l.q,l.xa,l.ya,1), c=pv(l.q+1,l.xa,l.ya,-1);
        l.m.position.set((a.x+c.x)/2,l.ya+32*e,(a.z+c.z)/2);
        l.m.rotation.y=Math.atan2(c.x-a.x,c.z-a.z);
        l.m.visible=S.show.links;
      });
      b.pins.forEach(function(n){
        var a=pv(n.s,n.xa,n.ya,n.face); n.m.position.set(a.x,a.y+52*e,a.z); n.m.visible=S.show.links;
      });
    });

    GP.treads.forEach(function(t){
      var i=t.i, g=t.g;
      g.visible=S.show.treads; t.dolls.visible=S.show.dolls&&!pack; if(t.lab) t.lab.visible=!pack;
      if(!pack){g.position.set(0,e*(24+i*5),0); return;}
      /* all treads rise together to their own height, then fly to the stack one after another, top step first */
      var u=seg(p,.04+(9-i)*.022,.04+(9-i)*.022+.12), lift=ez(seg(p,0,.04));
      var dy1=84+(9-i)*3-i*R, dxf=TREAD_STACK.x-t.cx, dzf=TREAD_STACK.z-36;
      var dyf=((9-i)*C.T+C.T/2)-(i*R-C.T/2);
      if(u<=0) g.position.set(0,dy1*lift,0);
      else route(g.position,[[0,dy1,0],[dxf,dy1,dzf],[dxf,dyf,dzf]],u);
    });

    GP.panels.forEach(function(pn){
      var g=pn.g, b0=pn.base, k=pn.k;
      g.visible=S.show.panels;
      if(!pack){g.position.set(b0.x+(k-1)*62*e+26*e,b0.y,b0.z); g.rotation.z=0; return;}
      var a0=.36+(2-k)*.03, u=seg(p,a0,a0+.10), yf=.235+(2-k)*C.PTP, alt=108+(2-k)*4;
      route(g.position,[[b0.x,b0.y,b0.z],[b0.x,alt,b0.z],[PANEL_STACK.x,alt,PANEL_STACK.z],[PANEL_STACK.x,yf,PANEL_STACK.z]],u);
      g.rotation.z=-Math.PI/2*ez(clamp(u*3-1));
    });

    $('d-h').textContent=(9*R)+' in ('+Math.round(9*R*2.54)+' cm)';
    $('exv').textContent=S.e+'%';
    if($('exv2')) $('exv2').textContent=S.e+'%';
    var ph=$('phase');
    if(ph) ph.textContent=p<=0?'Set up and ready for dolls'
      :p<.36?'1 · Lift the treads off the dowels and stack them flat'
      :p<.52?'2 · Pull the back panels out and lay them flat'
      :p<.58?'3 · Slide the three blocks apart to make room'
      :p<.76?'4 · Release the hinged links. They swing the three walls of each block together'
      :p<.85?'5 · Line the folded blocks up in a row'
      :p<1?'6 · Nest the folded blocks side by side'
      :'Packed: 3 slim blocks, 1 tread stack, 3 flat panels';
    $('pp').value=Math.round(p*1000);
  };

  var dir=0;
  GP.onFrame=function(dt){
    if(!dir) return;
    S.p=clamp(S.p+dir*dt/16);
    if(S.p<=0||S.p>=1) dir=0;
    GP.applyState();
  };

  GP.setMode=function(m){
    S.mode=m; dir=0;
    ['explode','pack','cut'].forEach(function(n){
      $('m-'+n).setAttribute('aria-pressed',m===n);
      $('g-'+n).hidden=m!==n;
    });
    $('cutview').hidden=m!=='cut';
    if(m==='pack'){S.e=0; $('ex').value=0; GP.setView('wide');}
    else{S.p=0; if(m==='explode'){GP.setView('iso'); GP.frameExplode(S.e/100);}}
    if(GP.cutActivate) GP.cutActivate(m==='cut');
    GP.applyState();
  };

  ['explode','pack','cut'].forEach(function(n){$('m-'+n).addEventListener('click',function(){GP.setMode(n);});});
  document.querySelectorAll('.views button').forEach(function(b){b.addEventListener('click',function(){GP.setView(b.dataset.v);});});
  document.querySelectorAll('input[name=rise]').forEach(function(r){r.addEventListener('change',function(){S.rise=+r.value;GP.build();});});
  function onEx(ev){S.e=+ev.target.value;$('ex').value=S.e;$('ex2').value=S.e;GP.applyState();GP.frameExplode(S.e/100);}
  $('ex').addEventListener('input',onEx);
  $('ex2').addEventListener('input',onEx);
  $('pp').addEventListener('input',function(ev){dir=0;S.p=ev.target.value/1000;GP.applyState();});
  $('play-pack').addEventListener('click',function(){if(S.p>=1)S.p=0;dir=1;});
  $('play-unpack').addEventListener('click',function(){if(S.p<=0)S.p=1;dir=-1;});
  document.querySelectorAll('#g-pack .chips .btn').forEach(function(b){b.addEventListener('click',function(){dir=0;S.p=+b.dataset.p;GP.applyState();});});
  [['tg-t','treads'],['tg-b','panels'],['tg-l','links'],['tg-d','dolls']].forEach(function(x){
    $(x[0]).addEventListener('change',function(ev){S.show[x[1]]=ev.target.checked;GP.applyState();});
  });

  GP.build(); GP.setView('iso');
})();
