/* ── 전역 상태 ── */
var tab='calendar', cd=new Date(), sel=null;
var cSt='work', ol=[], wwList=[], repList=[];
var annualYear=new Date().getFullYear();
var swipeStartX=0, swipeStartY=0, swipeLock=false;
var navLock=false;

/* ── 데이터 로드 ── */
var logs = JSON.parse(localStorage.getItem('rl9_logs')||localStorage.getItem('rl8_logs')||'{}');
var cfg  = JSON.parse(localStorage.getItem('rl9_cfg') ||localStorage.getItem('rl8_cfg') ||
  '{"unitPrice":74300,"fuelRate":0.55,"otRate":18000,"fuelPrice":1500,"toll1":3600,"toll2":2400,"initKm":125000,"ot2Pay":0,"theme":"default"}');
if(!cfg.ot2Pay)  cfg.ot2Pay=0;
if(!cfg.theme||['dark','red','green','orange','purple','kakao','linear'].indexOf(cfg.theme)>=0) cfg.theme='default';
cfg.monthlyUnitPrices = cfg.monthlyUnitPrices || {};
if(cfg.wwRate===undefined) cfg.wwRate=0;

/* ── 테마 목록 ── */
var THEMES=[
  {id:'default',name:'SpaceX',  color:'#000000'},
  {id:'white',  name:'화이트',  color:'#ffffff'},
];

/* ★ 테마 적용 — html 요소에만 class 조작 */
function applyTheme(t){
  var el=document.documentElement;
  /* 기존 theme-* 클래스만 제거 */
  var keep=el.className.split(' ').filter(function(c){return c&&!c.startsWith('theme-');});
  el.className=keep.join(' ');
  if(t&&t!=='default') el.classList.add('theme-'+t);
}
applyTheme(cfg.theme);

/* ── 유틸 ── */
function getUnitPrice(y, m) {
  var key = y + '-' + String(m + 1).padStart(2, '0');
  if (cfg.monthlyUnitPrices && cfg.monthlyUnitPrices[key] !== undefined) {
    return cfg.monthlyUnitPrices[key];
  }
  return cfg.unitPrice;
}
function setMonthlyPrice(y, m, price) {
  cfg.monthlyUnitPrices = cfg.monthlyUnitPrices || {};
  var key = y + '-' + String(m + 1).padStart(2, '0');
  cfg.monthlyUnitPrices[key] = price;
}
function sv(){
  localStorage.setItem('rl9_logs',JSON.stringify(logs));
  localStorage.setItem('rl9_cfg', JSON.stringify(cfg));
}
function dk(y,m,d){return y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');}
function cc(n){
  var C=[null,{b:'#E6F1FB',t:'#0C447C'},{b:'#EAF3DE',t:'#27500A'},{b:'#E1F5EE',t:'#085041'},
         {b:'#FAEEDA',t:'#633806'},{b:'#FAC775',t:'#412402'},{b:'#FBEAF0',t:'#72243E'},
         {b:'#FAECE7',t:'#711B13'},{b:'#F09595',t:'#501313'}];
  n=parseInt(n)||0; if(!n)return null;
  return n<C.length?C[n]:{b:'#E24B4A',t:'#fff'};
}
function tollTotal(t1,t2){return(parseInt(t1)||0)*cfg.toll1+(parseInt(t2)||0)*cfg.toll2;}

/* ── 연료: 이달 데이터만 (월별 리셋) ── */
function fuelMonth(y,m){
  var mp=y+'-'+String(m+1).padStart(2,'0');
  var mf=0,mu=0;
  Object.keys(logs).filter(function(k){return k.startsWith(mp);}).forEach(function(k){
    var v=logs[k],km=parseInt(v.ekm||0)-parseInt(v.skm||0);
    mf+=parseFloat(v.fuel||0); mu+=km*cfg.fuelRate;
  });
  return{mf:+mf.toFixed(2),mu:+mu.toFixed(2)};
}
/* 기록 탭용: 해당 날짜 제외한 이달 나머지 합계 */
function fuelMonthExclude(targetDate){
  var mp=targetDate.substring(0,7);
  var mf=0,mu=0;
  Object.keys(logs).filter(function(k){return k.startsWith(mp)&&k!==targetDate;}).forEach(function(k){
    var v=logs[k],km=parseInt(v.ekm||0)-parseInt(v.skm||0);
    mf+=parseFloat(v.fuel||0); mu+=km*cfg.fuelRate;
  });
  return{mf:+mf.toFixed(2),mu:+mu.toFixed(2)};
}

function calcPrevKm(targetDate){
  var keys=Object.keys(logs).filter(function(k){return k<targetDate;}).sort();
  var t=0;
  keys.forEach(function(k){
    var v=logs[k];
    t+=parseInt(v.ekm||0)-parseInt(v.skm||0);
    JSON.parse(v.repList||'[]').forEach(function(r){t+=parseInt(r.km||0);});
  });
  return t;
}

/* ── 네비게이션 ── */
function go(t){
  if(navLock) return;
  navLock=true;
  setTimeout(function(){navLock=false;},300);

  tab=t;
  ['Calendar','Entry','Stats','Annual','Config'].forEach(function(x){
    var btn=document.getElementById('nb'+x);
    if(btn) btn.classList.remove('on');
  });
  var activeBtn=document.getElementById('nb'+t.charAt(0).toUpperCase()+t.slice(1));
  if(activeBtn) activeBtn.classList.add('on');
  render();
}
var slideDir=0;
function pm(){slideDir=-1;cd=new Date(cd.getFullYear(),cd.getMonth()-1,1);render();}
function nm(){slideDir=1;cd=new Date(cd.getFullYear(),cd.getMonth()+1,1);render();}
function render(){
  var mc=document.getElementById('mc');
  mc.classList.toggle('cal-mode',tab==='calendar');
  if(tab==='calendar') rCal();
  else if(tab==='entry') rEntry();
  else if(tab==='stats') rStats();
  else if(tab==='annual') rAnnual();
  else rConfig();
}

/* ── 달력 ── */
function rCal(){
  var y=cd.getFullYear(),m=cd.getMonth();
  document.getElementById('hS').textContent=y+'년 '+(m+1)+'월';
  var days=new Date(y,m+1,0).getDate(), first=new Date(y,m,1).getDay();
  var td=new Date(), tdk=dk(td.getFullYear(),td.getMonth(),td.getDate());
  var mp=y+'-'+String(m+1).padStart(2,'0');
  var ml=Object.entries(logs).filter(function(e){return e[0].startsWith(mp);});
  var wd=ml.filter(function(e){return e[1].st==='work'||!e[1].st;}).length;
  var tc=ml.reduce(function(s,e){return s+(parseInt(e[1].calls)||0);},0);
  var ep=tc*getUnitPrice(y,m);
  var epStr=ep>0?ep.toLocaleString()+'원':'0원';

  var animClass=slideDir===1?'anim-left':(slideDir===-1?'anim-right':'');
  slideDir=0;

  var h='<div class="cal-page '+animClass+'">';
  h+='<div class="mnav"><button class="ma" onclick="pm()">‹</button>'
    +'<span class="ml">'+y+'년 '+(m+1)+'월</span>'
    +'<button class="ma" onclick="nm()">›</button></div>';
  /* 요일 헤더 (고정) */
  h+='<div class="cweek">';
  ['일','월','화','수','목','금','토'].forEach(function(d){h+='<div class="ch">'+d+'</div>';});
  h+='</div>';
  /* 날짜 그리드 (꽉차게) */
  h+='<div class="cgrid">';
  for(var i=0;i<first;i++) h+='<div class="cc empty"></div>';
  for(var d=1;d<=days;d++){
    var key=dk(y,m,d), log=logs[key]||{};
    var isT=key===tdk;
    var calls=parseInt(log.calls)||0, col=cc(calls);
    var ww=(JSON.parse(log.wwList||'[]')).length;
    var ot2=(JSON.parse(log.ot2List||'[]')).length>0;
    var badge='';
    if(log.st==='vacation') badge='<div class="cbadge-off off-v">휴무</div>';
    else if(log.st==='repair') badge='<div class="cbadge-off off-r">정비</div>';
    else if(col) badge='<div class="cbadge" style="background:'+col.b+';color:'+col.t+'">'+calls+'</div>';
    var mn='';
    if(ww>0) mn+='<div class="mbadge ww">'+(ww>1?ww:'')+'W</div>';
    if(ot2) mn+='<div class="mbadge ot2">2시↑</div>';
    h+='<div class="cc'+(isT?' today':'')+'" onclick="openDay(\''+key+'\')">'
      +'<span class="dn">'+d+'</span>'+badge
      +(mn?'<div class="mini-row">'+mn+'</div>':'')
      +'<div class="mini-row" style="margin-top:1px">'
      +(parseFloat(log.fuel)>0?'<div class="mbadge fuel">주유</div>':'')
      +(parseFloat(log.ot)>0?'<div class="mbadge ot">OT</div>':'')
      +(tollTotal(log.t1,log.t2)>0?'<div class="mbadge toll">톨비</div>':'')
      +''
      +'</div></div>';
  }
  h+='</div>';
  /* 하단 요약 바 */
  h+='<div class="sbar">'
    +'<div class="si"><div class="sl">이달 바리수</div><div class="sv">'+tc+'<span class="su">바리</span></div></div>'
    +'<div class="si"><div class="sl">근무일</div><div class="sv">'+wd+'<span class="su">일</span></div></div>'
    +'<div class="si"><div class="sl">예상급여</div><div class="sv" style="font-size:'+(ep>=1000000?'11px':'14px')+'">'+epStr+'</div></div>'
    +'</div>';
  h+='</div>';
  document.getElementById('mc').innerHTML=h;
}

function openDay(k){sel=k;go('entry');}

/* 스와이프 (한 번만 등록) */
document.getElementById('mc').parentNode.addEventListener('touchstart',function(e){
  if(tab!=='calendar')return;
  swipeStartX=e.touches[0].clientX; swipeStartY=e.touches[0].clientY;
},{passive:true});
document.getElementById('mc').parentNode.addEventListener('touchend',function(e){
  if(tab!=='calendar'||swipeLock)return;
  var dx=e.changedTouches[0].clientX-swipeStartX;
  var dy=e.changedTouches[0].clientY-swipeStartY;
  if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*2){
    swipeLock=true;
    if(dx<0)nm();else pm();
    setTimeout(function(){swipeLock=false;},400);
  }
},{passive:true});

/* ── OT2 (2시간 초과) ── */
function mkOT2(){
  if(!ol.length)return'<div style="font-size:13px;color:var(--th-muted);padding:4px 0 8px">없음</div>';
  return ol.map(function(e,i){
    var isS=e.settled===true||e.settled==='true';
    return'<div class="item-card" style="border-left:3px solid '+(isS?'#94a3b8':'#7c3aed')+';">'
      +'<div class="item-hdr">'
      +'<span class="item-title" style="'+(isS?'text-decoration:line-through;color:#94a3b8':'')+'">현장 '+(i+1)+' '+(isS?'✅ 정산완료':'')+'</span>'
      +'<button class="item-rm" onclick="rmO2('+i+')">삭제</button>'
      +'</div>'
      +'<div class="item-fields">'
      +'<div class="field"><label class="fl">현장명</label><input type="text" id="o2s'+i+'" value="'+(e.site||'')+'" placeholder="현장명" oninput="upO2('+i+')"'+(isS?' disabled':'')+'></div>'
      +'<div class="field"><label class="fl">담당 영업사원</label><input type="text" id="o2m'+i+'" value="'+(e.mgr||'')+'" placeholder="이름" oninput="upO2('+i+')"'+(isS?' disabled':'')+'></div>'
      +'<div class="field"><label class="fl">결산 방식</label><div class="tbts">'
      +'<button id="o2ta'+i+'" class="tbt'+((e.type||'monthly')==='credit'?' on':'')+'" onclick="setO2T('+i+',\'credit\')"'+(isS?' disabled':'')+'>영업사원 콜 지급</button>'
      +'<button id="o2tb'+i+'" class="tbt'+((e.type||'monthly')==='monthly'?' on':'')+'" onclick="setO2T('+i+',\'monthly\')"'+(isS?' disabled':'')+'>월말 결산</button>'
      +'</div></div>'
      +'<div class="field"><label class="fl">정산 상태</label>'
      +'<button onclick="toggleOT2Settle('+i+')" style="width:100%;padding:9px;border-radius:8px;border:1.5px solid '+(isS?'#059669':'#d1d5db')+';background:'+(isS?'#ecfdf5':'var(--th-bg2)')+';color:'+(isS?'#065f46':'var(--th-muted)')+';font-size:12px;font-weight:600;cursor:pointer">'
      +(isS?'✅ 정산완료 (취소하려면 탭)':'⬜ 미정산 — 탭하면 정산완료')
      +'</button></div>'
      +'</div></div>';
  }).join('');
}
function addO2(){ol.push({site:'',mgr:'',type:'monthly',settled:false});document.getElementById('o2Con').innerHTML=mkOT2();}
function rmO2(i){ol.splice(i,1);document.getElementById('o2Con').innerHTML=mkOT2();}
function setO2T(i,t){ol[i].type=t;document.getElementById('o2ta'+i).classList.toggle('on',t==='credit');document.getElementById('o2tb'+i).classList.toggle('on',t==='monthly');}
function upO2(i){var s=document.getElementById('o2s'+i),mg=document.getElementById('o2m'+i);if(s&&mg){ol[i].site=s.value;ol[i].mgr=mg.value;}}
function toggleOT2Settle(i){ol[i].settled=!(ol[i].settled===true||ol[i].settled==='true');document.getElementById('o2Con').innerHTML=mkOT2();}

/* ── 폐수 ── */
function mkWW(){
  if(!wwList.length)return'<div style="font-size:13px;color:var(--th-muted);padding:4px 0 8px">없음</div>';
  return wwList.map(function(e,i){
    return'<div class="item-card" style="border-left:3px solid #059669">'
      +'<div class="item-hdr"><span class="item-title" style="color:#065f46">폐수 '+(i+1)+'</span><button class="item-rm" onclick="rmWW('+i+')">삭제</button></div>'
      +'<div class="item-fields"><div class="field"><label class="fl">현장명</label><input type="text" id="wws'+i+'" value="'+(e.site||'')+'" placeholder="현장명" oninput="upWW('+i+')"></div></div>'
      +'</div>';
  }).join('');
}
function addWW(){wwList.push({site:''});document.getElementById('wwCon').innerHTML=mkWW();}
function rmWW(i){wwList.splice(i,1);document.getElementById('wwCon').innerHTML=mkWW();}
function upWW(i){var el=document.getElementById('wws'+i);if(el)wwList[i].site=el.value;}

/* ── 정비 ── */
function mkRep(){
  if(!repList.length)return'<div style="font-size:13px;color:var(--th-muted);padding:4px 0 8px">없음</div>';
  return repList.map(function(e,i){
    return'<div class="item-card" style="border-left:3px solid #dc2626">'
      +'<div class="item-hdr"><span class="item-title" style="color:#991b1b">정비 '+(i+1)+'</span><button class="item-rm" onclick="rmRep('+i+')">삭제</button></div>'
      +'<div class="item-fields">'
      +'<div class="field"><label class="fl">정비 항목</label><input type="text" id="rps'+i+'" value="'+(e.item||'')+'" placeholder="예: 엔진오일 교체" oninput="upRep('+i+')"></div>'
      +'<div class="field"><label class="fl">정비소</label><input type="text" id="rpp'+i+'" value="'+(e.place||'')+'" placeholder="정비소명" oninput="upRep('+i+')"></div>'
      +'<div class="field"><label class="fl">비용 (원)</label><input type="number" id="rpc'+i+'" value="'+(e.cost||'')+'" placeholder="0" oninput="upRep('+i+')"></div>'
      +'<div class="field"><label class="fl">이동거리 (km)</label><input type="number" id="rpk'+i+'" value="'+(e.km||'')+'" placeholder="0" oninput="upRep('+i+')"></div>'
      +'</div></div>';
  }).join('');
}
function addRep(){repList.push({item:'',place:'',cost:'',km:''});document.getElementById('repCon').innerHTML=mkRep();}
function rmRep(i){repList.splice(i,1);document.getElementById('repCon').innerHTML=mkRep();}
function upRep(i){
  var s=document.getElementById('rps'+i),p=document.getElementById('rpp'+i),c=document.getElementById('rpc'+i),k=document.getElementById('rpk'+i);
  if(s)repList[i].item=s.value;if(p)repList[i].place=p.value;if(c)repList[i].cost=c.value;if(k)repList[i].km=k.value;
  uKmCard();
}

/* ── 근무상태 버튼 ── */
function setSt(s){
  cSt=s;
  ['work','vacation','repair','other'].forEach(function(k,i){
    var el=document.getElementById('stb'+i);
    if(el)el.className='btn'+(k==='vacation'?' off-btn':'')+(k==='repair'?' rep-btn':'')+(k===s?' on':'');
  });
}

/* ★ 연료 카드 업데이트 (이달만, 월별 리셋) */
function uFuelCard(){
  var el=document.getElementById('fuelCard');if(!el)return;
  var todayFuel=parseFloat(document.getElementById('fF').value)||0;
  var sk=parseInt(document.getElementById('fSk').value)||0;
  var ek=parseInt(document.getElementById('fEk').value)||0;
  var todayKm=ek>sk?ek-sk:0;
  var prev=fuelMonthExclude(sel);
  var mTotalFuel=+(prev.mf+todayFuel).toFixed(1);
  var mTotalUsed=+(prev.mu+todayKm*cfg.fuelRate).toFixed(1);
  var diff=+(mTotalUsed-mTotalFuel).toFixed(1);
  var diffLabel=diff>=0?'🟢 초과소비 +'+diff+'L — 지급 받음':'🔴 잔량 '+Math.abs(diff)+'L — 도급비 차감';
  var diffColor=diff>=0?'#34d399':'#f87171';
  el.innerHTML='<div class="fuel-card-title">이달 연료 현황</div>'
    +'<div class="fcrow"><span class="fck">당일 주유량</span><span class="fcv plus">'+(todayFuel>0?'+'+todayFuel:'0')+'L</span></div>'
    +'<div class="fcrow" style="background:rgba(29,78,216,.08)"><span class="fck" style="font-weight:600;color:var(--th-accent)">이달 총 주유량</span><span class="fcv blue">'+mTotalFuel+'L</span></div>'
    +'<div class="fcrow"><span class="fck">이달 소비량 (km×'+cfg.fuelRate+')</span><span class="fcv minus">'+mTotalUsed+'L</span></div>'
    +'<div class="fuel-balance-big"><span class="fbb-label">이달 유류 정산 방향</span>'
    +'<span style="font-size:12px;font-weight:700;color:'+diffColor+'">'+diffLabel+'</span></div>';
}

function uKmCard(){
  var el=document.getElementById('kmCard');if(!el)return;
  var sk=parseInt(document.getElementById('fSk').value)||0;
  var ek=parseInt(document.getElementById('fEk').value)||0;
  var todayKm=ek>sk?ek-sk:0;
  var repKm=repList.reduce(function(s,r){return s+(parseInt(r.km||0));},0);
  var prevKm=calcPrevKm(sel);
  var total=cfg.initKm+prevKm+todayKm+repKm;
  if(sk&&ek&&ek>sk)document.getElementById('kmH').textContent='✅ 오늘 운행거리: '+todayKm+'km';
  el.innerHTML='<div class="km-card-title">전체 누적 km</div>'
    +'<div class="fcrow"><span class="fck">기준 km</span><span class="fcv neutral">'+cfg.initKm.toLocaleString()+'km</span></div>'
    +'<div class="fcrow"><span class="fck">이전 누적</span><span class="fcv neutral">+'+prevKm.toLocaleString()+'km</span></div>'
    +'<div class="fcrow"><span class="fck">오늘 운행</span><span class="fcv plus">+'+todayKm+'km</span></div>'
    +(repKm>0?'<div class="fcrow"><span class="fck">오늘 정비 이동</span><span class="fcv plus">+'+repKm+'km</span></div>':'')
    +'<div class="km-total-bar"><span class="km-total-label">전체 누적 km</span><span class="km-total-val">'+total.toLocaleString()+'km</span></div>';
}
function uKm(){uKmCard();uFuelCard();}

function uToll(){
  var el=document.getElementById('tollCard');if(!el)return;
  var t1=parseInt(document.getElementById('fT1').value)||0;
  var t2=parseInt(document.getElementById('fT2').value)||0;
  var tot=tollTotal(t1,t2);
  el.innerHTML='<div class="toll-card-title">톨비 현황 (울산대교)</div>'
    +'<div class="toll-row"><span class="toll-key">3,600원 × '+t1+'회</span><span class="toll-val">'+(t1*cfg.toll1).toLocaleString()+'원</span></div>'
    +'<div class="toll-row"><span class="toll-key">2,400원 × '+t2+'회</span><span class="toll-val">'+(t2*cfg.toll2).toLocaleString()+'원</span></div>'
    +'<div class="toll-total-bar"><span class="toll-total-label">오늘 톨비 합계</span><span class="toll-total-val">'+tot.toLocaleString()+'원</span></div>';
}
function uOT(){var h=parseFloat(document.getElementById('fOt').value)||0;var a=h*cfg.otRate;document.getElementById('otA').textContent=a>0?'💰 오티 수당: '+a.toLocaleString()+'원':'';}
function aVol(){var c=parseInt(document.getElementById('fC').value)||0;var v=document.getElementById('fV');if(c>0&&!v.dataset.m)v.value=c*6;}

/* ── 기록 탭 ── */
function rEntry(){
  if(!sel){
    var t=new Date(),tk=dk(t.getFullYear(),t.getMonth(),t.getDate());
    document.getElementById('mc').innerHTML='<div style="padding:28px 16px;text-align:center;color:var(--th-muted)"><p style="margin-bottom:14px">달력에서 날짜를 탭하세요</p><button class="bsave" style="max-width:180px" onclick="openDay(\''+tk+'\')">오늘 기록하기</button></div>';
    return;
  }
  var log=logs[sel]||{};
  var pts=sel.split('-'),y=pts[0],m=pts[1],d=pts[2];
  var prevEkm = '';
  var prevDate = new Date(+y, +m - 1, +d - 1);
  var prevKey = dk(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate());
  if (logs[prevKey] && logs[prevKey].ekm) {
    prevEkm = logs[prevKey].ekm;
  }
  var dow=['일','월','화','수','목','금','토'][new Date(+y,+m-1,+d).getDay()];
  document.getElementById('hS').textContent=y+'.'+m+'.'+d+' ('+dow+')';
  cSt=log.st||'work';
  ol=JSON.parse(log.ot2List||'[]');
  wwList=JSON.parse(log.wwList||'[]');
  repList=JSON.parse(log.repList||'[]');
  var kmD=(log.skm&&log.ekm)?parseInt(log.ekm)-parseInt(log.skm):0;
  var prevKm=calcPrevKm(sel);
  var repKmToday=repList.reduce(function(s,r){return s+(parseInt(r.km||0));},0);
  var totalKm=cfg.initKm+prevKm+kmD+repKmToday;
  var otA=(parseFloat(log.ot)||0)*cfg.otRate;
  var t1=parseInt(log.t1||0),t2=parseInt(log.t2||0),tTot=tollTotal(t1,t2);

  /* ★ 이달 연료 (월별 리셋) */
  var prev=fuelMonthExclude(sel);
  var todayFuel=parseFloat(log.fuel||0);
  var todayKm=kmD;
  var mTotalFuel=+(prev.mf+todayFuel).toFixed(1);
  var mTotalUsed=+(prev.mu+todayKm*cfg.fuelRate).toFixed(1);
  var fuelDiff=+(mTotalUsed-mTotalFuel).toFixed(1);
  var fuelLabel=fuelDiff>=0?'🟢 초과소비 +'+fuelDiff+'L — 지급 받음':'🔴 잔량 '+Math.abs(fuelDiff)+'L — 도급비 차감';
  var fuelColor=fuelDiff>=0?'#34d399':'#f87171';

  document.getElementById('mc').innerHTML='<div class="ef">'
  +'<div class="shdr">근무 상태</div>'
  +'<div class="btns">'+['work','vacation','repair','other'].map(function(k,i){
    return'<button id="stb'+i+'" class="btn'+(k==='vacation'?' off-btn':'')+(k==='repair'?' rep-btn':'')+(cSt===k?' on':'')+'" onclick="setSt(\''+k+'\')">'+['근무','휴무','정비','기타'][i]+'</button>';
  }).join('')+'</div>'
  +'<div class="shdr">기본 운행</div>'
  +'<div class="r2"><div class="field"><label class="fl">바리수</label><input type="number" id="fC" value="'+(log.calls||'')+'" placeholder="0" min="0" max="30" oninput="aVol()"></div>'
  +'<div class="field"><label class="fl">운반량 (㎥)</label><input type="number" id="fV" value="'+(log.vol||'')+'" placeholder="자동입력" step="0.5"></div></div>'
  +'<div class="r2"><div class="field"><label class="fl">시작 km</label><input type="number" id="fSk" value="'+(log.skm||prevEkm||'')+'" placeholder="'+(prevEkm||'7924')+'" oninput="uKm()"></div>'
  +'<div class="field"><label class="fl">종료 km</label><input type="number" id="fEk" value="'+(log.ekm||'')+'" placeholder="7999" oninput="uKm()"></div></div>'
  +'<div class="kmh" id="kmH">'+(kmD>0?'✅ 오늘 운행거리: '+kmD+'km':'종료km 입력 시 자동계산')+'</div>'
  +'<div class="km-card" id="kmCard">'
  +'<div class="km-card-title">전체 누적 km</div>'
  +'<div class="fcrow"><span class="fck">기준 km</span><span class="fcv neutral">'+cfg.initKm.toLocaleString()+'km</span></div>'
  +'<div class="fcrow"><span class="fck">이전 누적</span><span class="fcv neutral">+'+prevKm.toLocaleString()+'km</span></div>'
  +'<div class="fcrow"><span class="fck">오늘 운행</span><span class="fcv plus">+'+kmD+'km</span></div>'
  +(repKmToday>0?'<div class="fcrow"><span class="fck">오늘 정비 이동</span><span class="fcv plus">+'+repKmToday+'km</span></div>':'')
  +'<div class="km-total-bar"><span class="km-total-label">전체 누적 km</span><span class="km-total-val">'+totalKm.toLocaleString()+'km</span></div>'
  +'</div>'
  +'<div class="shdr">연료 주유</div>'
  +'<div class="field"><label class="fl">당일 주유량 (L)</label><input type="number" id="fF" value="'+(log.fuel||'')+'" placeholder="0" step="10" oninput="uFuelCard()"></div>'
  +'<div class="fuel-card" id="fuelCard">'
  +'<div class="fuel-card-title">이달 연료 현황</div>'
  +'<div class="fcrow"><span class="fck">당일 주유량</span><span class="fcv plus">'+(todayFuel>0?'+'+todayFuel:'0')+'L</span></div>'
  +'<div class="fcrow" style="background:rgba(29,78,216,.08)"><span class="fck" style="font-weight:600;color:var(--th-accent)">이달 총 주유량</span><span class="fcv blue">'+mTotalFuel+'L</span></div>'
  +'<div class="fcrow"><span class="fck">이달 소비량 (km×'+cfg.fuelRate+')</span><span class="fcv minus">'+mTotalUsed+'L</span></div>'
  +'<div class="fuel-balance-big"><span class="fbb-label">이달 유류 정산 방향</span>'
  +'<span style="font-size:12px;font-weight:700;color:'+fuelColor+'">'+fuelLabel+'</span></div>'
  +'</div>'
  +'<div class="shdr">시간외수당 (오티)</div>'
  +'<div class="field"><label class="fl">오티 시간 — 4시 이후</label><input type="number" id="fOt" value="'+(log.ot||'')+'" placeholder="0" step="0.5" oninput="uOT()"></div>'
  +'<div class="chint" id="otA" style="color:#7c3aed">'+(otA>0?'💰 오티 수당: '+otA.toLocaleString()+'원':'')+'</div>'
  +'<div class="shdr">2시간초과 현장</div>'
  +'<div id="o2Con">'+mkOT2()+'</div>'
  +'<button class="add-btn" onclick="addO2()">＋ 2시간초과 현장 추가</button>'
  +'<div class="shdr">폐수처리</div>'
  +'<div id="wwCon">'+mkWW()+'</div>'
  +'<button class="add-btn" style="border-color:#6ee7b7;color:#065f46" onclick="addWW()">＋ 폐수처리 현장 추가</button>'
  +'<div class="shdr">톨비 (울산대교)</div>'
  +'<div class="r2"><div class="field"><label class="fl">3,600원 — 횟수</label><input type="number" id="fT1" value="'+(log.t1||'')+'" placeholder="0" min="0" oninput="uToll()"></div>'
  +'<div class="field"><label class="fl">2,400원 — 횟수</label><input type="number" id="fT2" value="'+(log.t2||'')+'" placeholder="0" min="0" oninput="uToll()"></div></div>'
  +'<div class="toll-card" id="tollCard">'
  +'<div class="toll-card-title">톨비 현황 (울산대교)</div>'
  +'<div class="toll-row"><span class="toll-key">3,600원 × '+t1+'회</span><span class="toll-val">'+(t1*cfg.toll1).toLocaleString()+'원</span></div>'
  +'<div class="toll-row"><span class="toll-key">2,400원 × '+t2+'회</span><span class="toll-val">'+(t2*cfg.toll2).toLocaleString()+'원</span></div>'
  +'<div class="toll-total-bar"><span class="toll-total-label">오늘 톨비 합계</span><span class="toll-total-val">'+tTot.toLocaleString()+'원</span></div>'
  +'</div>'
  +'<div class="shdr">차량 정비</div>'
  +'<div id="repCon">'+mkRep()+'</div>'
  +'<button class="add-btn" style="border-color:#fca5a5;color:#dc2626" onclick="addRep()">＋ 정비 내역 추가</button>'
  +'<div class="shdr">메모</div>'
  +'<div class="field"><textarea id="fM" placeholder="특이사항, 현장명 등...">'+(log.memo||'')+'</textarea></div>'
  +'<button class="bsave" id="btnSave" onclick="saveE()">💾 저장</button>'
  +((log.calls||log.st)?'<button class="bdel" onclick="delE()">이 날 기록 삭제</button>':'')
  +'</div>';
}


/* ★ 저장 — try-catch로 안정화 */
function showToast(msg,color){
  var t=document.createElement('div');
  t.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:'+(color||'#059669')+';color:#fff;padding:14px 24px;border-radius:12px;font-size:15px;font-weight:600;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.3);white-space:nowrap';
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(function(){if(document.body.contains(t))document.body.removeChild(t);},1400);
}

function saveE(){
  try{
    if(!sel){showToast('날짜를 먼저 선택하세요','#dc2626');return;}
    var btn=document.getElementById('btnSave');
    if(btn){btn.disabled=true;btn.textContent='저장 중...';}
    logs[sel]={
      st:cSt,
      calls:document.getElementById('fC').value,
      vol:document.getElementById('fV').value,
      skm:document.getElementById('fSk').value,
      ekm:document.getElementById('fEk').value,
      fuel:document.getElementById('fF').value,
      ot:document.getElementById('fOt').value,
      ot2List:JSON.stringify(ol),
      wwList:JSON.stringify(wwList),
      t1:document.getElementById('fT1').value,
      t2:document.getElementById('fT2').value,
      repList:JSON.stringify(repList),
      memo:document.getElementById('fM').value
    };
    sv();
    showToast('✅ 저장됐어요!');
    setTimeout(function(){go('calendar');},700);
  }catch(err){
    console.error('저장 오류:',err);
    var msg='⚠️ 저장 중 오류가 발생했어요';
    if(err&&err.name==='QuotaExceededError')msg='⚠️ 저장 공간이 부족해요';
    showToast(msg,'#dc2626');
    var btn=document.getElementById('btnSave');
    if(btn){btn.disabled=false;btn.textContent='💾 저장';}
  }
}
function delE(){
  if(!sel)return;
  if(!confirm('이 날 기록을 삭제할까요?'))return;
  delete logs[sel];sv();sel=null;
  showToast('🗑️ 삭제됐어요','#64748b');
  setTimeout(function(){go('calendar');},700);
}

/* ── 통계 ── */
function rStats(){
  document.getElementById('hS').textContent='통계 / 월말결산';
  var y=cd.getFullYear(),m=cd.getMonth();
  var mp=y+'-'+String(m+1).padStart(2,'0');
  var ml=Object.entries(logs).filter(function(e){return e[0].startsWith(mp);});
  var wd=ml.filter(function(e){return e[1].st==='work'||!e[1].st;}).length;
  var tc=ml.reduce(function(s,e){return s+(parseInt(e[1].calls)||0);},0);
  var tv=ml.reduce(function(s,e){return s+(parseFloat(e[1].vol)||0);},0);
  var tkm=ml.reduce(function(s,e){return s+(parseInt(e[1].ekm||0)-parseInt(e[1].skm||0));},0);
  var tot=ml.reduce(function(s,e){return s+(parseFloat(e[1].ot)||0);},0);
  var totA=tot*cfg.otRate;
  var tww=ml.reduce(function(s,e){return s+(JSON.parse(e[1].wwList||'[]')).length;},0);
  var tt1=ml.reduce(function(s,e){return s+(parseInt(e[1].t1||0));},0);
  var tt2=ml.reduce(function(s,e){return s+(parseInt(e[1].t2||0));},0);
  var tollMon1=tt1*cfg.toll1,tollMon2=tt2*cfg.toll2,tollMonT=tollMon1+tollMon2;
  var mRepCost=ml.reduce(function(s,e){return s+(JSON.parse(e[1].repList||'[]')).reduce(function(rs,r){return rs+(parseInt(r.cost)||0);},0);},0);
  var fu=fuelMonth(y,m);

  var tollDays = [];
  ml.forEach(function(e) {
    var log = e[1];
    var t1 = parseInt(log.t1 || 0);
    var t2 = parseInt(log.t2 || 0);
    var tot = tollTotal(t1, t2);
    if (tot > 0) {
      var pts = e[0].split('-');
      tollDays.push({
        day: parseInt(pts[2]),
        t1: t1,
        t2: t2,
        total: tot
      });
    }
  });
  tollDays.sort(function(a, b) { return a.day - b.day; });

  var tollDetailHtml = '';
  if (tollDays.length > 0) {
    tollDetailHtml = '<div class="toll-detail-list" style="margin-top:8px; border-top:1px dashed var(--th-border); padding-top:8px; font-size:12px; color:var(--th-muted);">';
    tollDays.forEach(function(td) {
      var detail = [];
      if (td.t1 > 0) detail.push('3,600원 ' + td.t1 + '회');
      if (td.t2 > 0) detail.push('2,400원 ' + td.t2 + '회');
      tollDetailHtml += '<div style="display:flex; justify-content:space-between; margin-bottom:4px;">'
        + '<span>' + td.day + '일 (' + detail.join(', ') + ')</span>'
        + '<span>' + td.total.toLocaleString() + '원</span>'
        + '</div>';
    });
    tollDetailHtml += '</div>';
  }

  /* ★ 유류: 소비>주유=받음, 소비<주유=차감 */
  var fuelDiff=+(fu.mu-fu.mf).toFixed(2);
  var fuelLabel=fuelDiff>=0?'🟢 초과소비 +'+fuelDiff.toFixed(1)+'L — 지급 받음':'🔴 잔량 '+Math.abs(fuelDiff).toFixed(1)+'L — 도급비 차감';
  var fuelColor=fuelDiff>=0?'#059669':'#dc2626';
  var allKm=Object.keys(logs).reduce(function(s,k){
    var v=logs[k];
    var repKm=JSON.parse(v.repList||'[]').reduce(function(rs,r){return rs+(parseInt(r.km||0));},0);
    return s+(parseInt(v.ekm||0)-parseInt(v.skm||0))+repKm;
  },0);
  var totalOdometer=cfg.initKm+allKm;
  var ot2I=[];ml.forEach(function(e){JSON.parse(e[1].ot2List||'[]').forEach(function(x){ot2I.push({date:e[0],site:x.site,mgr:x.mgr,type:x.type,settled:x.settled});});});
  var ot2Monthly=ot2I.filter(function(x){return x.type==='monthly'&&!(x.settled===true||x.settled==='true');});
  var wwItems=[];ml.forEach(function(e){JSON.parse(e[1].wwList||'[]').forEach(function(x){wwItems.push({date:e[0],site:x.site});});});
  var monthUnitPrice=getUnitPrice(y,m);
  var base=tc*monthUnitPrice;
  var ot2Pay2=ot2Monthly.length*cfg.ot2Pay;
  var wwPay=tww*(cfg.wwRate||0);
  var monthTotal=base+totA+ot2Pay2+tollMonT+wwPay-mRepCost;

  var h='<div class="sp">'
  +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><button class="ma" onclick="pm()">‹</button><span style="font-size:15px;font-weight:600">'+y+'년 '+(m+1)+'월</span><button class="ma" onclick="nm()">›</button></div>'
  +'<div class="sec">이달 기본 현황</div>'
  +'<div class="mgrid">'
  +'<div class="mc dk full"><div class="mk">기본급</div><div class="mv" style="font-size:'+(base>=1000000?'16px':'20px')+'">'+base.toLocaleString()+'<span class="mu" style="font-size:11px">원</span></div></div>'
  +'<div class="mc"><div class="mk">근무일</div><div class="mv">'+wd+'<span class="mu">일</span></div></div>'
  +'<div class="mc"><div class="mk">총 바리수</div><div class="mv">'+tc+'<span class="mu">바리</span></div></div>'
  +'<div class="mc"><div class="mk">운반량</div><div class="mv">'+tv.toFixed(1)+'<span class="mu">㎥</span></div></div>'
  +'<div class="mc"><div class="mk">운행거리</div><div class="mv">'+tkm+'<span class="mu">km</span></div></div>'
  +'</div>'
  +'<div class="sec">전체 누적 km</div>'
  +'<div class="fb"><div class="fr"><span class="fk">기준 km</span><span class="fv">'+cfg.initKm.toLocaleString()+'km</span></div>'
  +'<div class="fr"><span class="fk">전체 운행 누적</span><span class="fv">+'+allKm.toLocaleString()+'km</span></div>'
  +'<div class="fr"><span class="fk" style="font-weight:700">현재 총 km</span><span class="fv" style="color:var(--th-accent);font-size:15px">'+totalOdometer.toLocaleString()+'km</span></div></div>'
  +'<div class="sec">유류 현황 (이달 / 정산 별도)</div>'
  +'<div class="fb"><div class="fr"><span class="fk">이달 주유량</span><span class="fv" style="color:#059669">+'+fu.mf.toFixed(1)+'L</span></div>'
  +'<div class="fr"><span class="fk">이달 소비량</span><span class="fv" style="color:#dc2626">'+fu.mu.toFixed(1)+'L</span></div>'
  +'<div class="fr"><span class="fk" style="font-weight:700">이달 유류 정산</span><span class="fv" style="color:'+fuelColor+'">'+fuelLabel+'</span></div></div>'
  +'<div class="sec">오티 수당</div>'
  +'<div class="fb"><div class="fr"><span class="fk">이달 오티 시간</span><span class="fv">'+tot+'시간</span></div>'
  +'<div class="fr"><span class="fk">오티 수당 합계</span><span class="fv" style="color:#7c3aed">'+totA.toLocaleString()+'원</span></div></div>'
  +'<div class="sec">폐수처리 ('+tww+'건 / 합계 '+wwPay.toLocaleString()+'원)</div>'
  +(wwItems.length?wwItems.map(function(e){var p=e.date.split('-');return'<div class="wwi"><div class="ot2d">'+p[1]+'월 '+p[2]+'일</div><div class="ot2n">'+(e.site||'현장 미입력')+'</div></div>';}).join(''):'<div class="emsg">이달 폐수처리 없음</div>')
  +'<div class="sec">톨비 (울산대교)</div>'
  +'<div class="fb"><div class="fr"><span class="fk">3,600원 통행</span><span class="fv">'+tt1+'회 = '+tollMon1.toLocaleString()+'원</span></div>'
  +'<div class="fr"><span class="fk">2,400원 통행</span><span class="fv">'+tt2+'회 = '+tollMon2.toLocaleString()+'원</span></div>'
  +'<div class="fr"><span class="fk" style="font-weight:700">월 톨비 합계</span><span class="fv" style="color:var(--th-accent);font-size:15px">'+tollMonT.toLocaleString()+'원</span></div>'
  +tollDetailHtml+'</div>'
  +'<div class="sec">2시간초과 현황 ('+ot2I.length+'건)</div>'
  +(ot2I.length?ot2I.map(function(e){
    var p=e.date.split('-');
    var isS=e.settled===true||e.settled==='true';
    return'<div class="ot2i'+(e.type==='monthly'?' mo':'')+'" style="'+(isS?'opacity:.5':'')+'">'
      +'<div class="ot2d">'+p[1]+'월 '+p[2]+'일 '+(isS?'✅ 정산완료':'')+'</div>'
      +'<div class="ot2n" style="'+(isS?'text-decoration:line-through':'')+'">'+( e.site||'현장 미입력')+(e.mgr?' / '+e.mgr:'')
      +'<span class="ot2tp '+(e.type==='monthly'?'tm':'tc')+'">'+(e.type==='monthly'?'월말결산':'영업사원')+'</span></div></div>';
  }).join(''):'<div class="emsg">이달 2시간초과 없음</div>')
  +(ot2Monthly.length?'<div style="background:#fef2f2;border:0.5px solid #fca5a5;border-radius:8px;padding:9px 12px;margin-top:6px;font-size:12px;color:#991b1b">⚠️ 월말 결산 필요: '+ot2Monthly.length+'건</div>':'')
  +(mRepCost>0?'<div class="sec">차량 정비 비용</div><div class="fb"><div class="fr"><span class="fk">이달 정비 비용</span><span class="fv" style="color:#dc2626">'+mRepCost.toLocaleString()+'원</span></div></div>':'')
  +'<div class="sec" style="margin-top:24px">📋 '+(m+1)+'월 최종 결산 (유류 별도)</div>'
  +'<div class="fb"><div class="fr"><span class="fk">기본급 ('+tc+'바리 × '+monthUnitPrice.toLocaleString()+'원)</span><span class="fv">+'+base.toLocaleString()+'원</span></div>'
  +(totA>0?'<div class="fr"><span class="fk">오티 수당</span><span class="fv" style="color:#7c3aed">+'+totA.toLocaleString()+'원</span></div>':'')
  +(ot2Pay2>0?'<div class="fr"><span class="fk">2시간초과 수당</span><span class="fv" style="color:#7c3aed">+'+ot2Pay2.toLocaleString()+'원</span></div>':'')
  +(wwPay>0?'<div class="fr"><span class="fk">폐수 수당</span><span class="fv" style="color:#059669">+'+wwPay.toLocaleString()+'원</span></div>':'')
  +(tollMonT>0?'<div class="fr"><span class="fk">톨비 지급</span><span class="fv" style="color:var(--th-accent)">+'+tollMonT.toLocaleString()+'원</span></div>':'')
  +(mRepCost>0?'<div class="fr"><span class="fk">정비비 차감</span><span class="fv" style="color:#dc2626">−'+mRepCost.toLocaleString()+'원</span></div>':'')
  +'</div>'
  +'<div style="background:var(--th-bg2);border:1px solid var(--th-border);border-radius:10px;padding:16px;text-align:center;margin-bottom:16px">'
  +'<div style="font-size:12px;color:var(--th-muted);margin-bottom:6px">'+(m+1)+'월 수령 예정액 (유류 별도)</div>'
  +'<div style="font-size:'+(monthTotal>=10000000?'20px':monthTotal>=1000000?'24px':'28px')+'px;font-weight:700;color:var(--th-text)">'+monthTotal.toLocaleString()+'원</div>'
  +'</div>'
  +'</div>';
  document.getElementById('mc').innerHTML=h;
}

/* ── 연말결산 ── */
function pyear(){annualYear--;rAnnual();}
function nyear(){annualYear++;rAnnual();}
function rAnnual(){
  document.getElementById('hS').textContent=annualYear+'년 연말결산';
  var y=annualYear;
  var annWd=0,annCalls=0,annKm=0,annOT=0,annOTpay=0,annToll=0,annRep=0,annBase=0,annTotal=0;
  var rows='';
  var activeMonths=0;
  for(var mi=0;mi<12;mi++){
    var mp2=y+'-'+String(mi+1).padStart(2,'0');
    var ml2=Object.entries(logs).filter(function(e){return e[0].startsWith(mp2);});
    if(!ml2.length){
      rows+='<tr><td style="padding:8px 10px;font-size:12px;color:var(--th-muted)">'+(mi+1)+'월</td><td colspan="5" style="padding:8px 6px;font-size:11px;color:var(--th-muted);text-align:center">기록 없음</td></tr>';
      continue;
    }
    activeMonths++;
    var wd2=ml2.filter(function(e){return e[1].st==='work'||!e[1].st;}).length;
    var tc2=ml2.reduce(function(s,e){return s+(parseInt(e[1].calls)||0);},0);
    var km2=ml2.reduce(function(s,e){return s+(parseInt(e[1].ekm||0)-parseInt(e[1].skm||0));},0);
    var ot2=ml2.reduce(function(s,e){return s+(parseFloat(e[1].ot)||0);},0);
    var otP2=ot2*cfg.otRate;
    var toll2=ml2.reduce(function(s,e){return s+(parseInt(e[1].t1||0))*cfg.toll1+(parseInt(e[1].t2||0))*cfg.toll2;},0);
    var rep2=ml2.reduce(function(s,e){return s+(JSON.parse(e[1].repList||'[]')).reduce(function(rs,r){return rs+(parseInt(r.cost)||0);},0);},0);
    var base2=tc2*getUnitPrice(y,mi);
    var ot2M2=[];ml2.forEach(function(e){JSON.parse(e[1].ot2List||'[]').forEach(function(x){if(x.type==='monthly'&&!(x.settled===true||x.settled==='true'))ot2M2.push(x);});});
    var ot2P2=ot2M2.length*cfg.ot2Pay;
    var ww2=ml2.reduce(function(s,e){return s+(JSON.parse(e[1].wwList||'[]')).length;},0);
    var wwP2=ww2*(cfg.wwRate||0);
    var mTot2=base2+otP2+ot2P2+toll2+wwP2-rep2;
    annWd+=wd2;annCalls+=tc2;annKm+=km2;annOT+=ot2;annOTpay+=otP2;annToll+=toll2;annRep+=rep2;annBase+=base2;annTotal+=mTot2;
    rows+='<tr style="border-bottom:0.5px solid var(--th-border)">'
      +'<td style="padding:8px 10px;font-size:13px;font-weight:600;color:var(--th-text)">'+(mi+1)+'월</td>'
      +'<td style="padding:8px 6px;font-size:12px;color:var(--th-muted);text-align:right">'+wd2+'일</td>'
      +'<td style="padding:8px 6px;font-size:12px;color:var(--th-muted);text-align:right">'+tc2+'</td>'
      +'<td style="padding:8px 6px;font-size:11px;text-align:right">'+base2.toLocaleString()+'</td>'
      +'<td style="padding:8px 6px;font-size:11px;color:#7c3aed;text-align:right">'+(otP2>0?'+'+otP2.toLocaleString():'0')+'</td>'
      +'<td style="padding:8px 10px;font-size:12px;font-weight:700;color:'+(mTot2>=0?'var(--th-accent)':'#dc2626')+';text-align:right">'+mTot2.toLocaleString()+'</td>'
      +'</tr>';
  }
  var avgCalls=annWd>0?(annCalls/annWd).toFixed(1):'0';
  var avgMonthly=activeMonths>0?Math.round(annTotal/activeMonths):0;
  var h='<div class="sp">'
  +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px"><button class="ma" onclick="pyear()">‹</button><span style="font-size:18px;font-weight:700;color:var(--th-text)">'+y+'년 연말결산</span><button class="ma" onclick="nyear()">›</button></div>'
  +'<div class="mgrid" style="margin-bottom:12px">'
  +'<div class="mc dk full"><div class="mk">연간 총 수령액 (유류 별도)</div><div class="mv" style="font-size:'+(annTotal>=100000000?'14px':annTotal>=10000000?'16px':'18px')+'">'+annTotal.toLocaleString()+'<span class="mu" style="font-size:11px">원</span></div></div>'
  +'<div class="mc"><div class="mk">총 근무일</div><div class="mv">'+annWd+'<span class="mu">일</span></div></div>'
  +'<div class="mc"><div class="mk">총 바리수</div><div class="mv">'+annCalls+'<span class="mu">바리</span></div></div>'
  +'<div class="mc"><div class="mk">일 평균 바리</div><div class="mv">'+avgCalls+'<span class="mu">바리</span></div></div>'
  +'<div class="mc"><div class="mk">총 운행거리</div><div class="mv">'+annKm.toLocaleString()+'<span class="mu">km</span></div></div>'
  +'<div class="mc"><div class="mk">연간 오티</div><div class="mv" style="color:#7c3aed;font-size:15px">'+annOTpay.toLocaleString()+'<span class="mu">원</span></div></div>'
  +'<div class="mc"><div class="mk">연간 톨비</div><div class="mv" style="color:var(--th-accent);font-size:15px">'+annToll.toLocaleString()+'<span class="mu">원</span></div></div>'
  +'<div class="mc"><div class="mk">연간 정비비</div><div class="mv" style="color:#dc2626;font-size:15px">'+annRep.toLocaleString()+'<span class="mu">원</span></div></div>'
  +'</div>'
  +'<div style="font-size:11px;font-weight:700;color:var(--th-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">월별 상세</div>'
  +'<div style="background:var(--th-bg2);border-radius:10px;overflow:hidden;border:0.5px solid var(--th-border);margin-bottom:12px">'
  +'<table style="width:100%;border-collapse:collapse">'
  +'<thead><tr style="background:var(--th-primary-dark);border-bottom:1px solid var(--th-border)">'
  +'<th style="padding:8px 10px;font-size:11px;color:var(--th-muted);font-weight:600;text-align:left">월</th>'
  +'<th style="padding:8px 4px;font-size:10px;color:var(--th-muted);font-weight:600;text-align:right">근무</th>'
  +'<th style="padding:8px 4px;font-size:10px;color:var(--th-muted);font-weight:600;text-align:right">바리</th>'
  +'<th style="padding:8px 4px;font-size:10px;color:var(--th-muted);font-weight:600;text-align:right">기본급</th>'
  +'<th style="padding:8px 4px;font-size:10px;color:var(--th-muted);font-weight:600;text-align:right">오티</th>'
  +'<th style="padding:8px 10px;font-size:10px;color:var(--th-muted);font-weight:600;text-align:right">합계</th>'
  +'</tr></thead><tbody>'+rows+'</tbody>'
  +'<tfoot><tr style="background:var(--th-primary-dark);border-top:1px solid var(--th-border)">'
  +'<td style="padding:10px;font-size:12px;font-weight:700;color:var(--th-text)">합계</td>'
  +'<td style="padding:10px 4px;font-size:11px;color:var(--th-muted);text-align:right">'+annWd+'일</td>'
  +'<td style="padding:10px 4px;font-size:11px;color:var(--th-muted);text-align:right">'+annCalls+'</td>'
  +'<td style="padding:10px 4px;font-size:10px;color:var(--th-text);text-align:right">'+annBase.toLocaleString()+'</td>'
  +'<td style="padding:10px 4px;font-size:10px;color:#7c3aed;text-align:right">'+annOTpay.toLocaleString()+'</td>'
  +'<td style="padding:10px;font-size:12px;font-weight:700;color:var(--th-accent);text-align:right">'+annTotal.toLocaleString()+'</td>'
  +'</tr></tfoot></table></div>'
  +'<div style="background:linear-gradient(135deg,#065f46,#047857);border-radius:12px;padding:18px 16px;text-align:center;margin-bottom:16px">'
  +'<div style="font-size:12px;color:rgba(255,255,255,.7);margin-bottom:6px">'+y+'년 연간 총 수령액 (유류 별도)</div>'
  +'<div style="font-size:'+(annTotal>=100000000?'22px':'28px')+'px;font-weight:700;color:#fff">'+annTotal.toLocaleString()+'원</div>'
  +'<div style="font-size:12px;color:rgba(255,255,255,.6);margin-top:6px">월 평균 '+avgMonthly.toLocaleString()+'원 · 총 '+annWd+'일 근무</div>'
  +'</div></div>';
  document.getElementById('mc').innerHTML=h;
}

/* ── 설정 ── */
function rConfig(){
  document.getElementById('hS').textContent='설정';
  var themeHtml=THEMES.map(function(t){
    return'<div class="theme-item'+(cfg.theme===t.id?' selected':'')+'" onclick="setTheme(\''+t.id+'\')">'
      +'<div class="theme-circle" style="background:'+t.color+'"></div>'
      +'<span class="theme-name">'+t.name+'</span>'
      +'</div>';
  }).join('');
  var cy = cd.getFullYear(), cm = cd.getMonth();
  var curMonthPrice = getUnitPrice(cy, cm);
  var h='<div class="cfg-page">'
  +'<div class="cfg-sec">🎨 테마 색상</div>'
  +'<div style="background:var(--th-bg2);border-radius:10px;padding:12px 14px;margin-bottom:12px;border:0.5px solid var(--th-border)">'
  +'<p style="font-size:12px;color:var(--th-muted);margin-bottom:12px">테마를 선택하면 앱 전체 색이 바뀌어요</p>'
  +'<div class="theme-grid">'+themeHtml+'</div>'
  +'</div>'
  +'<div class="cfg-sec">급여 설정 (' + (cm + 1) + '월 기준)</div>'
  +'<div class="sblk">'
  +'<div class="srow"><div><span class="slbl">' + (cm + 1) + '월 바리당 단가</span><span class="slbl-sub">선택된 월에만 적용되는 단가</span></div><div style="display:flex;align-items:center;gap:4px"><input class="sinp" type="number" value="' + curMonthPrice + '" oninput="setMonthlyPrice(' + cy + ',' + cm + ', +this.value);sv()"><span style="font-size:11px;color:var(--th-muted)">원</span></div></div>'
  +'<div class="srow"><div><span class="slbl">기본 바리당 단가</span><span class="slbl-sub">신규 월 시작 시 기본값</span></div><div style="display:flex;align-items:center;gap:4px"><input class="sinp" type="number" value="'+cfg.unitPrice+'" oninput="cfg.unitPrice=+this.value;sv()"><span style="font-size:11px;color:var(--th-muted)">원</span></div></div>'
  +'<div class="srow"><div><span class="slbl">오티 시간당</span></div><div style="display:flex;align-items:center;gap:4px"><input class="sinp" type="number" value="'+cfg.otRate+'" oninput="cfg.otRate=+this.value;sv()"><span style="font-size:11px;color:var(--th-muted)">원</span></div></div>'
  +'<div class="srow"><div><span class="slbl">2시간초과 건당</span><span class="slbl-sub">미정산 건에만 적용</span></div><div style="display:flex;align-items:center;gap:4px"><input class="sinp" type="number" value="'+cfg.ot2Pay+'" placeholder="0" oninput="cfg.ot2Pay=+this.value;sv()"><span style="font-size:11px;color:var(--th-muted)">원</span></div></div>'
  +'<div class="srow"><div><span class="slbl">폐수 건당 단가</span></div><div style="display:flex;align-items:center;gap:4px"><input class="sinp" type="number" value="'+(cfg.wwRate||0)+'" oninput="cfg.wwRate=+this.value;sv()"><span style="font-size:11px;color:var(--th-muted)">원</span></div></div>'
  +'</div>'
  +'<div class="cfg-sec">유류 설정</div>'
  +'<div class="sblk">'
  +'<div class="srow"><div><span class="slbl">km당 유류 소모</span></div><div style="display:flex;align-items:center;gap:4px"><input class="sinp" type="number" step="0.01" value="'+cfg.fuelRate+'" oninput="cfg.fuelRate=+this.value;sv()"><span style="font-size:11px;color:var(--th-muted)">L/km</span></div></div>'
  +'<div class="srow"><div><span class="slbl">연료 정산 단가</span></div><div style="display:flex;align-items:center;gap:4px"><input class="sinp" type="number" value="'+cfg.fuelPrice+'" oninput="cfg.fuelPrice=+this.value;sv()"><span style="font-size:11px;color:var(--th-muted)">원/L</span></div></div>'
  +'</div>'
  +'<div class="cfg-sec">차량 설정</div>'
  +'<div class="sblk">'
  +'<div class="srow"><div><span class="slbl">기준 km</span><span class="slbl-sub">앱 시작 시점 차량 km</span></div><div style="display:flex;align-items:center;gap:4px"><input class="sinp" type="number" value="'+cfg.initKm+'" oninput="cfg.initKm=+this.value;sv()"><span style="font-size:11px;color:var(--th-muted)">km</span></div></div>'
  +'</div>'
  +'<div class="cfg-sec">톨비 설정</div>'
  +'<div class="sblk">'
  +'<div class="srow"><div><span class="slbl">대형 단가</span></div><div style="display:flex;align-items:center;gap:4px"><input class="sinp" type="number" value="'+cfg.toll1+'" oninput="cfg.toll1=+this.value;sv()"><span style="font-size:11px;color:var(--th-muted)">원</span></div></div>'
  +'<div class="srow"><div><span class="slbl">소형 단가</span></div><div style="display:flex;align-items:center;gap:4px"><input class="sinp" type="number" value="'+cfg.toll2+'" oninput="cfg.toll2=+this.value;sv()"><span style="font-size:11px;color:var(--th-muted)">원</span></div></div>'
  +'</div>'
  +'<div class="cfg-sec">데이터 백업 / 복원</div>'
  +'<div style="background:var(--th-bg2);border-radius:10px;padding:14px;margin-bottom:12px;border:0.5px solid var(--th-border)">'
  +'<p style="font-size:12px;color:var(--th-muted);margin-bottom:12px;line-height:1.6">백업 파일을 저장해두면 폰을 바꿔도 데이터를 복원할 수 있어요.</p>'
  +'<button class="backup-btn dl" onclick="doBackup()">⬇️ 데이터 백업 (다운로드)</button>'
  +'<button class="backup-btn ul" onclick="document.getElementById(\'restoreFile\').click()">⬆️ 데이터 복원 (파일 선택)<input type="file" id="restoreFile" accept=".json" style="display:none" onchange="doRestore(event)"></button>'
  +'</div>'
  +'<div class="cfg-sec" style="color:#dc2626">위험 구역</div>'
  +'<div style="background:#fef2f2;border-radius:10px;padding:14px;border:0.5px solid #fca5a5">'
  +'<p style="font-size:12px;color:#991b1b;margin-bottom:12px">모든 운행 데이터가 삭제돼요. 복구 불가능해요.</p>'
  +'<button class="backup-btn danger" onclick="doReset()">🗑️ 전체 데이터 초기화</button>'
  +'</div></div>';
  document.getElementById('mc').innerHTML=h;
}

/* ★ 테마 적용 및 저장 */
function setTheme(t){
  cfg.theme=t;
  sv();
  applyTheme(t);
  rConfig();
}

function doBackup(){
  var data={logs:logs,cfg:cfg,version:'rl9',date:new Date().toISOString()};
  var json=JSON.stringify(data,null,2);
  var filename='레미콘운행일지_백업_'+new Date().toISOString().slice(0,10)+'.json';
  /* iOS PWA는 a.click() 다운로드가 안 돼서 새 탭으로 열어 공유/저장 유도 */
  var blob=new Blob([json],{type:'application/json'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;a.download=filename;a.target='_blank';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(function(){URL.revokeObjectURL(url);},3000);
  showToast('💾 백업 파일을 저장해주세요!');
}
function doRestore(ev){
  var file=ev.target.files[0];if(!file)return;
  var r=new FileReader();
  r.onload=function(e){
    try{
      var data=JSON.parse(e.target.result);
      if(!data.logs||!data.cfg){showToast('올바른 백업 파일이 아니에요','#dc2626');return;}
      if(!confirm('현재 데이터가 모두 백업 데이터로 교체됩니다. 계속하시겠어요?'))return;
      logs=data.logs;cfg=data.cfg;sv();applyTheme(cfg.theme);
      showToast('✅ 복원 완료!');render();
    }catch(err){showToast('파일을 읽을 수 없어요','#dc2626');}
  };
  r.readAsText(file);ev.target.value='';
}
function doReset(){
  if(!confirm('정말로 모든 데이터를 삭제하시겠어요?'))return;
  if(!confirm('한 번 더 확인합니다. 전체 데이터를 삭제합니다.'))return;
  logs={};sv();showToast('🗑️ 초기화 완료','#64748b');render();
}

/* ── 앱 아이콘 (iOS) — 레미콘 타이포 ── */
(function(){
  try{
    var c=document.createElement('canvas');c.width=180;c.height=180;
    var ctx=c.getContext('2d');
    /* 다크 배경 */
    ctx.fillStyle='#0f172a';
    ctx.beginPath();ctx.moveTo(40,0);ctx.lineTo(140,0);ctx.quadraticCurveTo(180,0,180,40);ctx.lineTo(180,140);ctx.quadraticCurveTo(180,180,140,180);ctx.lineTo(40,180);ctx.quadraticCurveTo(0,180,0,140);ctx.lineTo(0,40);ctx.quadraticCurveTo(0,0,40,0);ctx.fill();
    /* 레미콘 글자 (하늘색) */
    ctx.fillStyle='#38bdf8';
    ctx.font='800 40px -apple-system,Arial,sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('레미콘',90,82);
    /* 밑줄 라인 */
    ctx.fillStyle='#38bdf8';
    ctx.fillRect(50,118,80,7);
    /* 아이콘 적용 */
    var old=document.querySelector('link[rel="apple-touch-icon"]');
    if(old)old.parentNode.removeChild(old);
    var link=document.createElement('link');link.rel='apple-touch-icon';link.sizes='180x180';link.href=c.toDataURL('image/png');
    document.head.insertBefore(link,document.head.firstChild);
  }catch(e){}
})();

/* ── 시작 ── */
render();

/* ── 당겨서 새로고침 (Pull to Refresh) ── */
(function() {
  var ptr = document.getElementById('ptr-indicator');
  var content = document.getElementById('mc');
  var startY = 0, startX = 0, currentY = 0, currentX = 0, isPulling = false;
  var threshold = 70; // 당겨야 하는 최소 거리 (px)

  if (!ptr || !content) return;

  document.addEventListener('touchstart', function(e) {
    if (tab === 'calendar' && content.scrollTop <= 0) {
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      currentY = startY;
      currentX = startX;
      isPulling = true;
      ptr.style.transition = 'none';
    }
  }, { passive: true });

  document.addEventListener('touchmove', function(e) {
    if (tab !== 'calendar' || !isPulling) return;
    currentY = e.touches[0].clientY;
    currentX = e.touches[0].clientX;
    
    var dy = currentY - startY;
    var dx = currentX - startX;

    if (dy > 0 && Math.abs(dy) > Math.abs(dx)) {
      var dragDistance = Math.min(dy * 0.4, threshold + 20);
      ptr.style.transform = 'translateY(' + dragDistance + 'px)';
      ptr.style.opacity = Math.min(dragDistance / threshold, 1);

      if (dragDistance >= threshold) {
        ptr.classList.add('active');
        ptr.querySelector('.ptr-text').textContent = '놓아서 새로고침';
      } else {
        ptr.classList.remove('active');
        ptr.querySelector('.ptr-text').textContent = '당겨서 새로고침';
      }
    } else if (dy < 0) {
      isPulling = false;
      ptr.style.transform = 'translateY(0)';
      ptr.style.opacity = '0';
    }
  }, { passive: true });

  document.addEventListener('touchend', function(e) {
    if (tab !== 'calendar' || !isPulling) return;
    isPulling = false;
    ptr.style.transition = 'transform 0.2s ease, opacity 0.2s ease';

    var dy = currentY - startY;
    var dragDistance = Math.min(dy * 0.4, threshold + 20);

    if (dragDistance >= threshold) {
      ptr.style.transform = 'translateY(' + threshold + 'px)';
      ptr.classList.add('loading');
      ptr.querySelector('.ptr-text').textContent = '업데이트 중...';
      setTimeout(function() {
        window.location.reload();
      }, 600);
    } else {
      ptr.style.transform = 'translateY(0)';
      ptr.style.opacity = '0';
    }
    startY = 0;
    startX = 0;
    currentY = 0;
    currentX = 0;
  });
})();

/* ── 두 손가락 확대(Pinch-to-Zoom) 및 제스처 확대 방지 ── */
document.addEventListener('touchstart', function(e) {
  if (e.touches.length > 1) {
    e.preventDefault();
  }
}, { passive: false });

document.addEventListener('gesturestart', function(e) {
  e.preventDefault();
});
