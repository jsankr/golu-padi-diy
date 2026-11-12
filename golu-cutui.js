/* Cut plan view: sheet diagrams, cut order, piece tables, and links to the 3D model. */
(function(){
  var GP=window.GP, S=GP.state, PLAN=window.GP_CUTS;
  var $=function(id){return document.getElementById(id);};
  var SC=10, MX=46, MY=34;               /* px per inch, left and top margin */
  var cur=1, sel=null;
  var FILL={tread:'#dcbd8c',plate:'#c08a4c',rib:'#a97439',foot:'#8e6330',link:'#3f8f8a',panel:'#8cc2b4'};
  var INK={tread:'#2a1c08',plate:'#2a1c08',rib:'#fff',foot:'#fff',link:'#fff',panel:'#0e2a24'};
  var KIND={tread:'Tread',plate:'Wall plate',rib:'Spacer',foot:'Outrigger foot',link:'Hinged link',panel:'Back panel'};
  var STEPS={A:'steps 1 to 3',B:'steps 4 to 6',C:'steps 7 to 9'};

  function plan(){return PLAN[String(S.rise)];}
  function f(v,d){return (+v).toFixed(d==null?2:d).replace(/\.?0+$/,'');}
  function mm(v){return Math.round(v*25.4);}
  function css(n){return 'hsl('+Math.round((((n-1)*0.618033)%1)*360)+',55%,62%)';}

  function pname(id){
    var m;
    if((m=/^T(\d)$/.exec(id))) return 'Tread '+m[1];
    if((m=/^([ABC])(\d)([ab])$/.exec(id))) return 'Wall plate, block '+m[1]+' ('+STEPS[m[1]]+'), wall '+m[2]+', plate '+m[3];
    if((m=/^R-([ABC])(\d)(\d)$/.exec(id))) return 'Spacer, block '+m[1]+', wall '+m[2]+', step column '+m[3];
    if((m=/^F-([ABC])(\d)$/.exec(id))) return 'Outrigger foot, block '+m[1]+', wall '+m[2];
    if((m=/^L-([ABC])(\d)$/.exec(id))) return 'Hinged link '+m[2]+', block '+m[1];
    if((m=/^BP-([ABC])$/.exec(id))) return 'Back panel, block '+m[1];
    return id;
  }
  function piece(id){var a=plan().pieces;for(var i=0;i<a.length;i++) if(a[i].id===id) return a[i];return null;}
  function centroid(pts){
    var a=0,cx=0,cy=0;
    for(var i=0;i<pts.length;i++){
      var p=pts[i],q=pts[(i+1)%pts.length],c=p[0]*q[1]-q[0]*p[1];
      a+=c; cx+=(p[0]+q[0])*c; cy+=(p[1]+q[1])*c;
    }
    a/=2; return a?[cx/(6*a),cy/(6*a)]:pts[0];
  }
  function sx(X){return MX+X*SC;} function sy(Y){return MY+(48-Y)*SC;}

  function buildMaps(){
    GP.sheetOf={};
    plan().pieces.forEach(function(p){GP.sheetOf[p.id]=p.sheet;});
  }

  function chips(){
    var P=plan(), h='';
    P.sheets.forEach(function(s){
      h+='<button class="btn chip" data-n="'+s.n+'" aria-pressed="'+(s.n===cur)+'"><i style="background:'+css(s.n)+'"></i>Sheet '+s.n+' · '+s.thk+' mm</button>';
    });
    $('cv-chips').innerHTML=h;
    $('cv-sum').textContent=P.summary.total+' sheets of 8 × 4 ft';
    $('cv-sub').textContent=P.summary.s19+' sheets of 19 mm (¾ in) and '+P.summary.s12+' sheets of 12 mm (½ in) plywood, '+P.pieces.length+' pieces, '+(S.rise)+' in risers.';
    $('cut-total').textContent=P.summary.total;
    $('cut-split').textContent=P.summary.s19+' × 19 mm + '+P.summary.s12+' × 12 mm';
  }

  function sheetSvg(s){
    var W=MX+960+24, H=MY+480+44, o='';
    o+='<defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="var(--rule)" stroke-width="1.2"/></pattern></defs>';
    o+='<rect class="sheet" x="'+MX+'" y="'+MY+'" width="960" height="480"/>';
    s.free.forEach(function(r){
      o+='<rect x="'+sx(r[0])+'" y="'+sy(r[1]+r[3])+'" width="'+r[2]*SC+'" height="'+r[3]*SC+'" fill="url(#hatch)" opacity=".55"/>';
      if(r[2]>=9&&r[3]>=5) o+='<text class="off" x="'+sx(r[0]+r[2]/2)+'" y="'+(sy(r[1]+r[3]/2)+4)+'" text-anchor="middle">offcut '+f(r[2],1)+' × '+f(r[3],1)+'</text>';
    });
    s.items.forEach(function(it){
      it.shapes.forEach(function(sh){
        var pc=piece(sh.id), kind=pc?pc.kind:it.kind;
        var d=sh.pts.map(function(p,i){return (i?'L':'M')+sx(p[0]).toFixed(1)+' '+sy(p[1]).toFixed(1);}).join('')+'Z';
        o+='<path class="pc'+(sh.id===sel?' sel':'')+'" data-pid="'+sh.id+'" d="'+d+'" fill="'+FILL[kind]+'"/>';
      });
    });
    s.items.forEach(function(it){
      it.shapes.forEach(function(sh){
        var pc=piece(sh.id); if(!pc) return;
        var c=centroid(sh.pts), xs=sh.pts.map(function(p){return p[0];}), ys=sh.pts.map(function(p){return p[1];});
        var wpx=(Math.max.apply(0,xs)-Math.min.apply(0,xs))*SC, hpx=(Math.max.apply(0,ys)-Math.min.apply(0,ys))*SC;
        var size=pc.kind==='plate'?f(pc.w)+' × '+f(pc.h):f(pc.w)+' × '+f(pc.h);
        var fs=hpx<24?9:12, ink=INK[pc.kind];
        if(hpx<24||wpx<70){
          o+='<text class="pl" style="fill:'+ink+'" font-size="'+fs+'" x="'+sx(c[0])+'" y="'+(sy(c[1])+3)+'" text-anchor="middle">'+sh.id+(wpx>150?'  '+size:'')+'</text>';
        } else {
          o+='<text class="pl" style="fill:'+ink+'" font-size="13" font-weight="600" x="'+sx(c[0])+'" y="'+(sy(c[1])-2)+'" text-anchor="middle">'+sh.id+'</text>';
          o+='<text class="pl" style="fill:'+ink+'" font-size="11" x="'+sx(c[0])+'" y="'+(sy(c[1])+13)+'" text-anchor="middle">'+size+' in</text>';
        }
      });
    });
    s.cuts.forEach(function(c){
      var x1,y1,x2,y2;
      if(c.o==='V'){x1=x2=sx(c.pos);y1=sy(c.a);y2=sy(c.b);} else {y1=y2=sy(c.pos);x1=sx(c.a);x2=sx(c.b);}
      o+='<line class="cut" x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'"/>';
    });
    s.cuts.forEach(function(c){
      var bx=c.o==='V'?sx(c.pos):sx(c.a)+10, by=c.o==='V'?sy(c.b)+10:sy(c.pos);
      o+='<circle class="bdg" cx="'+bx+'" cy="'+by+'" r="9"/><text class="bdt" x="'+bx+'" y="'+(by+3.5)+'" text-anchor="middle">'+c.n+'</text>';
    });
    for(var i=0;i<=96;i+=12) o+='<line class="tick" x1="'+sx(i)+'" y1="'+(MY+480)+'" x2="'+sx(i)+'" y2="'+(MY+486)+'"/><text class="ax" x="'+sx(i)+'" y="'+(MY+500)+'" text-anchor="middle">'+i+'</text>';
    for(var j=0;j<=48;j+=12) o+='<line class="tick" x1="'+(MX-6)+'" y1="'+sy(j)+'" x2="'+MX+'" y2="'+sy(j)+'"/><text class="ax" x="'+(MX-10)+'" y="'+(sy(j)+4)+'" text-anchor="end">'+j+'</text>';
    o+='<text class="ax" x="'+(MX+480)+'" y="'+(MY-12)+'" text-anchor="middle">Sheet '+s.n+' · '+s.thk+' mm plywood · 96 in (8 ft) × 48 in (4 ft) · '+f(s.util,1)+'% used · origin bottom left</text>';
    $('cv-svg').setAttribute('viewBox','0 0 '+W+' '+H);
    $('cv-svg').innerHTML=o;
  }

  function cutList(s){
    var h='';
    s.cuts.forEach(function(c){
      if(c.o==='V') h+='<li><b>Crosscut</b> along X = '+f(c.pos)+' in, from Y = '+f(c.a)+' to '+f(c.b)+' in</li>';
      else h+='<li><b>Rip</b> along Y = '+f(c.pos)+' in, from X = '+f(c.a)+' to '+f(c.b)+' in</li>';
    });
    var pl=s.items.filter(function(i){return i.kind==='pair'||i.kind==='plate';});
    if(pl.length) h+='<li class="pf"><b>Then cut the stair outline</b> of each wall plate with a circular saw and jigsaw. Corner points are in the piece card.</li>';
    $('cv-cuts').innerHTML=h||'<li>No cuts.</li>';
  }

  function table(s){
    var rows='';
    s.items.forEach(function(it){
      it.shapes.forEach(function(sh){
        var pc=piece(sh.id); if(!pc) return;
        var note=pc.kind==='plate'?'Stair '+pc.cols.map(function(v){return f(v);}).join(' / '):'';
        rows+='<tr data-pid="'+sh.id+'"'+(sh.id===sel?' class="sel"':'')+'><td><b>'+sh.id+'</b></td><td>'+KIND[pc.kind]+'</td><td>'+f(pc.w)+' × '+f(pc.h)+'</td><td>'+mm(pc.w)+' × '+mm(pc.h)+'</td><td>'+f(pc.x)+', '+f(pc.y)+'</td><td>'+note+'</td></tr>';
      });
    });
    $('cv-tab').innerHTML='<thead><tr><th>Piece</th><th>Type</th><th>Size, in</th><th>Size, mm</th><th>Lower left X, Y</th><th>Note</th></tr></thead><tbody>'+rows+'</tbody>';
  }

  function totals(){
    var g={}, P=plan();
    P.pieces.forEach(function(p){
      var key=p.kind+'|'+p.thk+'|'+p.w+'|'+p.h+(p.kind==='plate'?'|'+p.id[0]:'');
      if(!g[key]) g[key]={p:p,n:0}; g[key].n++;
    });
    var order=['tread','plate','panel','foot','rib','link'];
    var rows=Object.keys(g).map(function(k){return g[k];}).sort(function(a,b){return order.indexOf(a.p.kind)-order.indexOf(b.p.kind)||a.p.thk-b.p.thk||a.p.h-b.p.h;});
    var h='<thead><tr><th>Piece</th><th>Qty</th><th>Thickness</th><th>Size, in</th><th>Size, mm</th></tr></thead><tbody>', tot=0;
    rows.forEach(function(r){
      var p=r.p; tot+=r.n;
      var nm=KIND[p.kind]+(p.kind==='plate'?', block '+p.id[0]:'');
      h+='<tr><td>'+nm+'</td><td>'+r.n+'</td><td>'+p.thk+' mm</td><td>'+f(p.w)+' × '+f(p.h)+'</td><td>'+mm(p.w)+' × '+mm(p.h)+'</td></tr>';
    });
    h+='<tr class="tot"><td>All pieces</td><td>'+tot+'</td><td colspan="3">'+P.summary.total+' sheets of 8 × 4 ft</td></tr></tbody>';
    $('cv-tot').innerHTML=h;
  }

  function card(id){
    var el=$('cv-sel');
    if(!id){el.innerHTML='Hover or click a piece on the sheet or in the 3D model.'; return;}
    var p=piece(id); if(!p){el.textContent=id; return;}
    var h='<b>'+id+'</b> · '+pname(id)+'<br>'+p.thk+' mm plywood, on <button class="lnk" data-go="'+p.sheet+'">sheet '+p.sheet+'</button><br>'
      +f(p.w)+' × '+f(p.h)+' in ('+mm(p.w)+' × '+mm(p.h)+' mm)<br>Lower left corner at X '+f(p.x)+', Y '+f(p.y)+' in';
    if(p.kind==='plate'){
      var sh=null; plan().sheets[p.sheet-1].items.forEach(function(it){it.shapes.forEach(function(s){if(s.id===id) sh=s;});});
      h+='<br>Step heights '+p.cols.map(function(v){return f(v);}).join(', ')+' in (columns 12, 12 and 11.53 in wide)';
      if(sh) h+='<div class="vx">Corner points, in:<br>'+sh.pts.map(function(q,i){return (i+1)+': '+f(q[0])+', '+f(q[1]);}).join('<br>')+'</div>';
    }
    el.innerHTML=h;
  }

  function markSel(){
    document.querySelectorAll('#cv-svg .pc').forEach(function(e){e.classList.toggle('sel',e.dataset.pid===sel);});
    document.querySelectorAll('#cv-tab tr[data-pid]').forEach(function(e){e.classList.toggle('sel',e.dataset.pid===sel);});
  }

  function render(){
    var s=plan().sheets[cur-1]||plan().sheets[0]; cur=s.n;
    chips(); sheetSvg(s); cutList(s); table(s); totals(); card(sel); markSel();
  }

  function select(id,go){
    sel=id; GP.highlight(id);
    if(go&&id&&GP.sheetOf[id]&&GP.sheetOf[id]!==cur){cur=GP.sheetOf[id]; render();} else {card(id); markSel();}
  }

  /* events */
  $('cv-chips').addEventListener('click',function(e){
    var b=e.target.closest('button[data-n]'); if(!b) return;
    cur=+b.dataset.n; render();
  });
  var svg=$('cv-svg');
  svg.addEventListener('mouseover',function(e){var t=e.target.closest('[data-pid]'); if(t){GP.highlight(t.dataset.pid); card(t.dataset.pid);}});
  svg.addEventListener('mouseout',function(e){if(e.target.closest('[data-pid]')){GP.highlight(sel); card(sel);}});
  svg.addEventListener('click',function(e){var t=e.target.closest('[data-pid]'); if(t) select(sel===t.dataset.pid?null:t.dataset.pid,false);});
  $('cv-tab').addEventListener('click',function(e){var t=e.target.closest('tr[data-pid]'); if(t) select(t.dataset.pid,false);});
  $('cv-sel').addEventListener('click',function(e){var b=e.target.closest('[data-go]'); if(b){cur=+b.dataset.go; render();}});
  $('cb-sheet').addEventListener('change',function(e){S.colorBy=e.target.checked?'sheet':'type'; GP.refreshMats();});

  var ray=new THREE.Raycaster(), mouse=new THREE.Vector2(), down=null, el=GP.renderer.domElement;
  el.addEventListener('pointerdown',function(e){down={x:e.clientX,y:e.clientY};});
  el.addEventListener('pointerup',function(e){
    if(S.mode!=='cut'||!down) return;
    var far=Math.hypot(e.clientX-down.x,e.clientY-down.y)>5; down=null; if(far) return;
    var r=el.getBoundingClientRect();
    mouse.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
    ray.setFromCamera(mouse,GP.camera);
    var list=[];
    Object.keys(GP.pid).forEach(function(id){
      var m=GP.pid[id], ok=true;
      for(var o=m;o;o=o.parent){if(!o.visible){ok=false;break;}}
      if(ok) list.push(m);
    });
    var hit=ray.intersectObjects(list,false)[0];
    select(hit?hit.object.userData.pid:null,true);
  });

  GP.onBuilt=function(){buildMaps(); GP.refreshMats(); render();};
  GP.cutActivate=function(on){
    S.colorBy=on&&$('cb-sheet').checked?'sheet':'type';
    if(on){GP.setView('iso'); render();}
    sel=on?sel:null; GP.highlight(sel);
  };
})();
