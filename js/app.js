/* ── 전역 상태 ── */
var tab='calendar', cd=new Date(), sel=null;
var cSt='work', ol=[], wwList=[], repList=[], cashList=[];
var annualYear=new Date().getFullYear();
var swipeStartX=0, swipeStartY=0, swipeLock=false, swipeH=false;
var navLock=false;

/* ── 데이터 로드 ── */
var logs = JSON.parse(localStorage.getItem('rl9_logs')||localStorage.getItem('rl8_logs')||'{}');
var cfg  = JSON.parse(localStorage.getItem('rl9_cfg') ||localStorage.getItem('rl8_cfg') ||
  '{"unitPrice":74300,"fuelRate":0.55,"otRate":18000,"fuelPrice":1500,"toll1":3600,"toll2":2400,"initKm":125000,"ot2Pay":0,"theme":"default"}');
if(!cfg.ot2Pay)  cfg.ot2Pay=0;
if(!cfg.theme||['dark','red','green','orange','purple','kakao','linear'].indexOf(cfg.theme)>=0) cfg.theme='default';
cfg.monthlyUnitPrices = cfg.monthlyUnitPrices || {};
if(cfg.wwRate===undefined) cfg.wwRate=0;
/* 달력 표시 (음력·공휴일·절기) */
if(cfg.showLunar===undefined)   cfg.showLunar=true;
if(cfg.showHoliday===undefined) cfg.showHoliday=true;
if(cfg.showTerm===undefined)    cfg.showTerm=false;   /* 절기는 칸이 좁아 기본 꺼둠 */
cfg.lunarEvents = cfg.lunarEvents || [];              /* [{name,lm,ld,leap,solar}] */

/* ── 업데이트 내역 ──
   새 항목은 맨 위에 추가한다. APP_VERSION 은 여기서 따라오므로 따로 손댈 필요 없다.
   문구는 운전기사가 읽을 말로 쓴다 (기술 용어 금지).
   ★ 배포할 때 sw.js 의 CACHE 와 index.html 의 ?v= 도 같이 올릴 것 — CLAUDE.md 참고 */
var CHANGELOG=[
  {v:'1.3.0', d:'2026-08-17', t:'운행일지 사진 첨부, 쉬는 날 메모 표시', items:[
    '기록 화면 맨 아래에서 종이 운행일지를 찍어 붙여둘 수 있어요',
    '사진을 고르면 저장 버튼을 안 눌러도 바로 저장돼요',
    '사진을 누르면 크게 볼 수 있어요 — 손가락으로 쓸어서 구석구석 읽으세요',
    '사진이 있는 날은 달력에 📷 표시가 떠요',
    '휴무·정비·기타로 표시한 날은 메모에 적은 말이 달력에 그대로 보여요 (예: 비대기)',
    '※ 사진은 용량이 커서 백업 파일에 담기지 않아요. 폰을 바꾸면 사진은 안 옮겨져요'
  ]},
  {v:'1.2.2', d:'2026-08-03', t:'통계 탭이 월말결산으로 바뀌었어요', items:[
    '아래 탭 이름이 통계에서 월말결산으로 바뀌었어요',
    '월말결산에는 이번 달 운행 km만 보여요 (일지 운행 + 정비·현금운행 이동)',
    '전체 누적 km 표시는 없앴어요 — 1년 운행거리는 연말결산에서 보세요'
  ]},
  {v:'1.2.1', d:'2026-08-02', t:'운행거리·유류량이 마이너스로 나오던 문제 수정', items:[
    '종료 km를 아직 안 넣은 날은 그날 운행거리를 0으로 봐요',
    '전에는 시작 km만 넣으면 그 숫자만큼 마이너스로 잡혀서 운행거리가 −2,446km처럼 나왔어요',
    '운행거리가 틀리면 유류 소비량도 같이 틀어져서, 이제 유류 정산도 제대로 나와요',
    '종료 km가 시작 km보다 작게 들어간 날도 0으로 처리해요'
  ]},
  {v:'1.2.0', d:'2026-08-01', t:'업데이트 알림 추가, 달력 스와이프 문제 수정', items:[
    '앱이 새로 바뀌면 이렇게 팝업으로 알려드려요',
    '지난 업데이트 내역은 설정 맨 아래에서 언제든 다시 볼 수 있어요',
    '달력을 옆으로 쓸면 앱이 꺼지고 오류 화면이 뜨던 문제를 고쳤어요',
    '백업을 누르면 공유창이 떠서 파일에 저장하거나 카톡으로 보낼 수 있어요'
  ]},
  {v:'1.1.0', d:'2026-08-01', t:'달력에 공휴일과 음력 표시', items:[
    '공휴일은 날짜가 빨갛게 되고 이름이 같이 나와요 (대체공휴일도요)',
    '음력 초하루와 보름을 날짜 옆에 작게 표시해요',
    '설정에서 생신·기일을 음력으로 등록하면 해마다 알아서 표시돼요',
    '날짜를 누르면 그날 음력과 무슨 날인지 위에 나와요'
  ]}
];
var APP_VERSION=CHANGELOG[0].v;

/* ── 사진 저장소 (IndexedDB) — logs와 완전 분리, 키는 날짜 문자열 ── */
var phDB=null, phKeys=[], phUrl='';
function phTx(mode,fn){
  if(phDB)return fn(phDB.transaction('p',mode).objectStore('p'));
  var q=indexedDB.open('rl_photo',1);
  q.onupgradeneeded=function(){q.result.createObjectStore('p');};
  q.onsuccess=function(){phDB=q.result;fn(phDB.transaction('p',mode).objectStore('p'));};
  q.onerror=function(){console.error('사진 DB 열기 실패',q.error);};
}
function phSet(k,b,cb){phTx('readwrite',function(s){var r=s.put(b,k);
  r.onsuccess=function(){if(phKeys.indexOf(k)<0)phKeys.push(k);cb&&cb();};
  r.onerror=function(){cb&&cb(r.error);};});}
function phGet(k,cb){phTx('readonly',function(s){var r=s.get(k);
  r.onsuccess=function(){cb(r.result);};r.onerror=function(){cb(null);};});}
function phDel(k,cb){phTx('readwrite',function(s){var r=s['delete'](k);
  r.onsuccess=function(){var i=phKeys.indexOf(k);if(i>=0)phKeys.splice(i,1);cb&&cb();};});}
/* 달력 뱃지용 키 목록 (비동기라 첫 페인트 뒤 도착 → 달력이면 다시 그린다) */
phTx('readonly',function(s){var r=s.getAllKeys();
  r.onsuccess=function(){phKeys=r.result;if(tab==='calendar'&&document.getElementById('mc').innerHTML)rCal();};});

/* 2026-06 사진 기능 시절 logs에 남은 base64 잔재 → IndexedDB로 옮기고 제거 (1회성, 멱등) */
Object.keys(logs).forEach(function(k){
  var p=logs[k].photo; if(!p) return;
  fetch(p).then(function(r){return r.blob();}).then(function(b){
    phSet(k,b,function(err){ if(!err){delete logs[k].photo; sv();} });
  })['catch'](function(){ delete logs[k].photo; sv(); });
});

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
/* HTML 문자열을 + 로 이어붙이므로, 사용자가 입력한 이름은 반드시 이스케이프한다 */
function esc(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function cc(n){
  /* 히트맵: 1~2 파랑, 3~4 초록, 5~6 노랑/주황, 7~8 주황/빨강, 9+ 진빨강 */
  var C=[null,{b:'#E3EEFC',t:'#1B5FC2'},{b:'#CFE3FA',t:'#14509F'},{b:'#DDF4E7',t:'#0E7A4A'},
         {b:'#C4EBD5',t:'#0A6340'},{b:'#FBEFCE',t:'#8A5A00'},{b:'#F9DFAE',t:'#7A4A00'},
         {b:'#FBDCC8',t:'#A03616'},{b:'#F6BCA9',t:'#8C2015'}];
  n=parseInt(n)||0; if(!n)return null;
  return n<C.length?C[n]:{b:'#E24B4A',t:'#fff'};
}
function tollTotal(t1,t2){return(parseInt(t1)||0)*cfg.toll1+(parseInt(t2)||0)*cfg.toll2;}

/* ★ 하루 운행거리: 시작/종료 km이 둘 다 있고 종료>시작일 때만 계산.
   종료 km 미입력 시 0으로 처리해야 시작 km이 통째로 마이너스로 잡히지 않는다. */
function dayKm(v){
  if(!v||!v.skm||!v.ekm)return 0;
  var sk=parseInt(v.skm)||0,ek=parseInt(v.ekm)||0;
  return ek>sk?ek-sk:0;
}

/* ── 연료: 이달 데이터만 (월별 리셋) ── */
function fuelMonth(y,m){
  var mp=y+'-'+String(m+1).padStart(2,'0');
  var mf=0,mu=0;
  Object.keys(logs).filter(function(k){return k.startsWith(mp);}).forEach(function(k){
    var v=logs[k],km=dayKm(v);
    mf+=parseFloat(v.fuel||0); mu+=km*cfg.fuelRate;
  });
  return{mf:+mf.toFixed(2),mu:+mu.toFixed(2)};
}
/* 기록 탭용: 해당 날짜 제외한 이달 나머지 합계 */
function fuelMonthExclude(targetDate){
  var mp=targetDate.substring(0,7);
  var mf=0,mu=0;
  Object.keys(logs).filter(function(k){return k.startsWith(mp)&&k!==targetDate;}).forEach(function(k){
    var v=logs[k],km=dayKm(v);
    mf+=parseFloat(v.fuel||0); mu+=km*cfg.fuelRate;
  });
  return{mf:+mf.toFixed(2),mu:+mu.toFixed(2)};
}

function calcPrevKm(targetDate){
  var keys=Object.keys(logs).filter(function(k){return k<targetDate;}).sort();
  var t=0;
  keys.forEach(function(k){
    var v=logs[k];
    t+=dayKm(v);
    JSON.parse(v.repList||'[]').forEach(function(r){t+=parseInt(r.km||0);});
    JSON.parse(v.cashList||'[]').forEach(function(r){t+=parseInt(r.km||0);});
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
  if(phUrl){URL.revokeObjectURL(phUrl);phUrl='';}
  var mc=document.getElementById('mc');
  mc.classList.toggle('cal-mode',tab==='calendar');
  if(tab==='calendar') rCal();
  else if(tab==='entry') rEntry();
  else if(tab==='stats') rStats();
  else if(tab==='annual') rAnnual();
  else rConfig();
  fit1();
}

/* ── 한 줄 맞춤 ──
   글자를 키우면서 금액·수치가 두 줄로 넘어갈 수 있어,
   넘치는 값만 한 줄에 들어갈 때까지 폰트를 0.5px씩 줄인다.
   원래 크기는 data-fit-base에 보관해 다시 커질 수 있게 한다. */
var FIT_SEL='.hdr-t,.mv,.sv,.fv,.fcv,.toll-val,.fbb-val,.km-total-val,.toll-total-val,.ot2n';
function fit1(){
  var els=document.querySelectorAll(FIT_SEL);
  for(var i=0;i<els.length;i++){
    var el=els[i];
    var base=el.getAttribute('data-fit-base');
    if(base===null){
      base=window.getComputedStyle(el).fontSize;
      el.setAttribute('data-fit-base',base);
    }
    el.style.fontSize=base;
    var size=parseFloat(base);
    if(!size) continue;
    var min=Math.max(10,size*0.6), guard=0;
    while(el.scrollWidth>el.clientWidth+1 && size>min && guard<40){
      size-=0.5; guard++;
      el.style.fontSize=size+'px';
    }
  }
}
window.addEventListener('resize',fit1);

/* ── 달력 ── */
function rCal(){
  var y=cd.getFullYear(),m=cd.getMonth();
  document.getElementById('hS').textContent='';
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
    if(phKeys.indexOf(key)>=0) mn+='<div class="mbadge photo">📷</div>';
    var mn2=(parseFloat(log.fuel)>0?'<div class="mbadge fuel">주유</div>':'')
      +(parseFloat(log.ot)>0?'<div class="mbadge ot">OT</div>':'')
      +(tollTotal(log.t1,log.t2)>0?'<div class="mbadge toll">톨비</div>':'');
    /* 공휴일 / 음력 / 절기·기념일 */
    /* rCal 의 m 은 0-based, kcLunarMark 는 1-based 월을 받는다.
       칸에는 초하루·보름만 찍는다 (전체 음력은 날짜를 눌러 상세에서) */
    var mk=kcMark(key), lu=cfg.showLunar!==false?kcLunarMark(y,m+1,d):'';
    var red=cfg.showHoliday!==false&&kcIsHoliday(key);
    /* 칸 높이가 정해져 있어 넘치는 내용은 잘린다. 기록 줄이 이미 두 줄 이상이면
       이름 줄은 생략하고 날짜 색으로만 알린다 (이름은 날짜를 눌러 상세에서 확인) */
    var rows=(badge?1:0)+(mn?1:0)+(mn2?1:0);
    /* 메모는 쉬는 날(휴무·정비·기타)에만 칸에 찍는다 — 왜 쉬었는지가 달력에서 바로 보이게.
       근무일은 바리수·주유·오티 뱃지가 칸을 이미 채워서 넣을 자리가 없다 (넣으면 뱃지가 잘린다).
       내가 직접 쓴 말이라 공휴일 이름보다 앞선다 (공휴일은 날짜가 빨간 것으로도 안다).
       긴 메모는 CSS 로 잘리므로 '비대기' 처럼 짧게 쓰면 그대로 보인다 */
    var off=(log.st==='vacation'||log.st==='repair'||log.st==='other');
    var memo1=off?(log.memo||'').replace(/\s+/g,' ').trim():'';
    var sub=memo1?'<div class="dsub memo">'+esc(memo1)+'</div>'
      :(mk&&rows<2)?'<div class="dsub '+mk.kind+'">'+esc(mk.name.split('·')[0])+'</div>':'';
    h+='<div class="cc'+(isT?' today':'')+'" onclick="openDay(\''+key+'\')">'
      +'<div class="dtop"><span class="dn'+(red?' holi':'')+'">'+d+'</span>'
      +(lu?'<span class="lun">'+lu+'</span>':'')+'</div>'
      +sub+badge
      +(mn?'<div class="mini-row">'+mn+'</div>':'')
      +(mn2?'<div class="mini-row" style="margin-top:1px">'+mn2+'</div>':'')
      +'</div>';
  }
  h+='</div>';
  /* 하단 요약 바 */
  h+='<div class="sbar">'
    +'<div class="si"><div class="sl">이달 바리수</div><div class="sv">'+tc+'<span class="su">바리</span></div></div>'
    +'<div class="si"><div class="sl">근무일</div><div class="sv">'+wd+'<span class="su">일</span></div></div>'
    +'<div class="si"><div class="sl">예상급여</div><div class="sv" style="font-size:'+(ep>=1000000?'14px':'18px')+'">'+epStr+'</div></div>'
    +'</div>';
  h+='</div>';
  document.getElementById('mc').innerHTML=h;
}

function openDay(k){sel=k;go('entry');}

/* 스와이프 (한 번만 등록) */
document.getElementById('mc').parentNode.addEventListener('touchstart',function(e){
  if(tab!=='calendar')return;
  swipeStartX=e.touches[0].clientX; swipeStartY=e.touches[0].clientY; swipeH=false;
},{passive:true});
/* 가로 스와이프로 확정되면 기본 동작을 막는다 — standalone PWA에서 가장자리 가로
   스와이프는 iOS의 뒤로/앞으로 가기라, 안 막으면 달력을 넘기다 앱 밖으로 나간다.
   달력 탭은 세로 스크롤이 없고(.cgrid{overflow:hidden}) 가로로 12px 넘게 움직인
   뒤에만 막으므로, 날짜 탭과 '당겨서 새로고침'(세로)은 그대로 동작한다. */
document.getElementById('mc').parentNode.addEventListener('touchmove',function(e){
  if(tab!=='calendar'||e.touches.length>1)return;
  var dx=e.touches[0].clientX-swipeStartX, dy=e.touches[0].clientY-swipeStartY;
  if(!swipeH&&Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)) swipeH=true;
  if(swipeH) e.preventDefault();
},{passive:false});
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
  if(!ol.length)return'<div style="font-size:16px;color:var(--th-muted);padding:4px 0 8px">없음</div>';
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
      +'<button onclick="toggleOT2Settle('+i+')" style="width:100%;padding:9px;border-radius:8px;border:1.5px solid '+(isS?'#059669':'#d1d5db')+';background:'+(isS?'#ecfdf5':'var(--th-bg2)')+';color:'+(isS?'#065f46':'var(--th-muted)')+';font-size:15px;font-weight:600;cursor:pointer">'
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
/* 통계 탭에서 바로 정산완료 토글 — 해당 날짜 로그를 직접 수정 후 저장 */
function stToggleOT2(date,i){
  var v=logs[date]; if(!v)return;
  var list=JSON.parse(v.ot2List||'[]'); if(!list[i])return;
  list[i].settled=!(list[i].settled===true||list[i].settled==='true');
  v.ot2List=JSON.stringify(list); sv();
  showToast(list[i].settled?'✅ 정산완료 처리됐어요':'미정산으로 되돌렸어요');
  rStats();
}

/* ── 폐수 ── */
function mkWW(){
  if(!wwList.length)return'<div style="font-size:16px;color:var(--th-muted);padding:4px 0 8px">없음</div>';
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
  if(!repList.length)return'<div style="font-size:16px;color:var(--th-muted);padding:4px 0 8px">없음</div>';
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

/* ── 일반현장 현금거래 (잔량 판매) ── */
function mkCash(){
  if(!cashList.length)return'<div style="font-size:16px;color:var(--th-muted);padding:4px 0 8px">없음</div>';
  return cashList.map(function(e,i){
    return'<div class="item-card" style="border-left:3px solid #0891b2">'
      +'<div class="item-hdr"><span class="item-title" style="color:#0891b2">거래 '+(i+1)+'</span><button class="item-rm" onclick="rmCash('+i+')">삭제</button></div>'
      +'<div class="item-fields">'
      +'<div class="field"><label class="fl">현장 위치</label><input type="text" id="cas'+i+'" value="'+(e.site||'')+'" placeholder="예: 무거동 주택현장" oninput="upCash('+i+')"></div>'
      +'<div class="field"><label class="fl">담당자</label><input type="text" id="cam'+i+'" value="'+(e.mgr||'')+'" placeholder="이름/연락처" oninput="upCash('+i+')"></div>'
      +'<div class="field"><label class="fl">금액 (원)</label><input type="number" id="cac'+i+'" value="'+(e.amt||'')+'" placeholder="0" oninput="upCash('+i+')"></div>'
      +'<div class="field"><label class="fl">이동거리 (km) — 전체 누적 km에 반영</label><input type="number" id="cak'+i+'" value="'+(e.km||'')+'" placeholder="0" oninput="upCash('+i+')"></div>'
      +'</div></div>';
  }).join('');
}
function addCash(){cashList.push({site:'',mgr:'',amt:'',km:''});document.getElementById('cashCon').innerHTML=mkCash();}
function rmCash(i){cashList.splice(i,1);document.getElementById('cashCon').innerHTML=mkCash();uKmCard();}
function upCash(i){
  var s=document.getElementById('cas'+i),mg=document.getElementById('cam'+i),c=document.getElementById('cac'+i),k=document.getElementById('cak'+i);
  if(s)cashList[i].site=s.value;if(mg)cashList[i].mgr=mg.value;if(c)cashList[i].amt=c.value;if(k)cashList[i].km=k.value;
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
    +'<span style="font-size:15px;font-weight:700;color:'+diffColor+'">'+diffLabel+'</span></div>';
}

function uKmCard(){
  var el=document.getElementById('kmCard');if(!el)return;
  var sk=parseInt(document.getElementById('fSk').value)||0;
  var ek=parseInt(document.getElementById('fEk').value)||0;
  var todayKm=ek>sk?ek-sk:0;
  var repKm=repList.reduce(function(s,r){return s+(parseInt(r.km||0));},0);
  var cashKm=cashList.reduce(function(s,r){return s+(parseInt(r.km||0));},0);
  var prevKm=calcPrevKm(sel);
  var total=cfg.initKm+prevKm+todayKm+repKm+cashKm;
  if(sk&&ek&&ek>sk)document.getElementById('kmH').textContent='✅ 오늘 운행거리: '+todayKm+'km';
  el.innerHTML='<div class="km-card-title">전체 누적 km</div>'
    +'<div class="fcrow"><span class="fck">기준 km</span><span class="fcv neutral">'+cfg.initKm.toLocaleString()+'km</span></div>'
    +'<div class="fcrow"><span class="fck">이전 누적</span><span class="fcv neutral">+'+prevKm.toLocaleString()+'km</span></div>'
    +'<div class="fcrow"><span class="fck">오늘 운행</span><span class="fcv plus">+'+todayKm+'km</span></div>'
    +(repKm>0?'<div class="fcrow"><span class="fck">오늘 정비 이동</span><span class="fcv plus">+'+repKm+'km</span></div>':'')
    +(cashKm>0?'<div class="fcrow"><span class="fck">오늘 현금거래 이동</span><span class="fcv plus">+'+cashKm+'km</span></div>':'')
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
  /* 주말이나 연휴 등으로 기록 작성을 며칠 건너뛴 경우에도 이전의 마지막 운행 기록 종료 km를 
     자동으로 시작 km에 채워주기 위해, 현재 날짜 이전 중 가장 최근에 작성된 로그의 종료 km를 조회합니다. */
  var pastKeys = Object.keys(logs).filter(function(k) { return k < sel; }).sort();
  /* 휴무/정비 등 종료 km가 없는 날은 건너뛰고, 종료 km가 있는 가장 최근 기록을 찾는다 */
  for (var pi = pastKeys.length - 1; pi >= 0; pi--) {
    var pv = logs[pastKeys[pi]];
    if (pv && pv.ekm) { prevEkm = pv.ekm; break; }
  }
  var dow=['일','월','화','수','목','금','토'][new Date(+y,+m-1,+d).getDay()];
  /* 달력 칸에서 생략됐더라도 상세에서는 음력·공휴일 이름을 항상 보여준다 */
  var luS=kcLunarStr(+y,+m,+d);
  var mkS=kcMarkAll(sel).map(function(x){return x.name;}).join(' · ');
  document.getElementById('hS').textContent=y+'.'+m+'.'+d+' ('+dow+')'
    +(luS?' · 음 '+luS:'')+(mkS?' · '+mkS:'');
  cSt=log.st||'work';
  ol=JSON.parse(log.ot2List||'[]');
  wwList=JSON.parse(log.wwList||'[]');
  repList=JSON.parse(log.repList||'[]');
  cashList=JSON.parse(log.cashList||'[]');
  var kmD=dayKm(log);
  var prevKm=calcPrevKm(sel);
  var repKmToday=repList.reduce(function(s,r){return s+(parseInt(r.km||0));},0);
  var cashKmToday=cashList.reduce(function(s,r){return s+(parseInt(r.km||0));},0);
  var totalKm=cfg.initKm+prevKm+kmD+repKmToday+cashKmToday;
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
  +(cashKmToday>0?'<div class="fcrow"><span class="fck">오늘 현금거래 이동</span><span class="fcv plus">+'+cashKmToday+'km</span></div>':'')
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
  +'<span style="font-size:15px;font-weight:700;color:'+fuelColor+'">'+fuelLabel+'</span></div>'
  +'</div>'
  +'<div class="shdr">시간외수당 (오티)</div>'
  +'<div class="field"><label class="fl">오티 시간 — 4시 이후</label><input type="number" id="fOt" value="'+(log.ot||'')+'" placeholder="0" step="0.5" oninput="uOT()"></div>'
  +'<div class="chint" id="otA" style="color:#7c3aed">'+(otA>0?'💰 오티 수당: '+otA.toLocaleString()+'원':'')+'</div>'
  +'<div class="shdr">2시간초과 현장</div>'
  +'<div id="o2Con">'+mkOT2()+'</div>'
  +'<button class="add-btn" onclick="addO2()">＋ 2시간초과 현장 추가</button>'
  +'<div class="shdr">폐수처리</div>'
  +'<div id="wwCon">'+mkWW()+'</div>'
  +'<button class="add-btn" onclick="addWW()">＋ 폐수처리 현장 추가</button>'
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
  +'<button class="add-btn" onclick="addRep()">＋ 정비 내역 추가</button>'
  +'<div class="shdr">일반현장 현금거래</div>'
  +'<div style="font-size:14px;color:var(--th-muted);margin-bottom:6px">잔량 판매 기록 (참고용 · 이동거리만 전체 km에 반영)</div>'
  +'<div id="cashCon">'+mkCash()+'</div>'
  +'<button class="add-btn" onclick="addCash()">＋ 현금거래 추가</button>'
  +'<div class="shdr">메모</div>'
  +'<div class="field"><textarea id="fM" placeholder="특이사항, 현장명 등...">'+(log.memo||'')+'</textarea></div>'
  +'<div class="shdr">운행일지 사진</div>'
  +'<div id="phBox"></div>'
  +'<button class="bsave" id="btnSave" onclick="saveE()">저장</button>'
  +((log.calls||log.st)?'<button class="bdel" onclick="delE()">이 날 기록 삭제</button>':'')
  +'</div>';
  phLoad();
}

/* ── 사진 UI ── */
function phLoad(){
  var k=sel;
  phGet(k,function(b){
    if(k!==sel)return;                         /* 콜백 도착 전 날짜가 바뀐 경우 무시 */
    var box=document.getElementById('phBox'); if(!box)return;
    if(phUrl){URL.revokeObjectURL(phUrl);phUrl='';}
    if(b){
      phUrl=URL.createObjectURL(b);
      box.innerHTML='<div style="position:relative">'
        +'<img src="'+phUrl+'" style="width:100%;border-radius:8px;display:block" onclick="phZoom()">'
        +'<button class="pdel" onclick="phDelUI()">✕</button></div>'
        +'<div style="font-size:14px;color:var(--th-muted);margin-top:6px">사진을 탭하면 크게 볼 수 있어요 (쓸어서 이동)</div>';
    }else{
      box.innerHTML='<div class="photo-btns">'
        +'<div class="photo-btn">📷 촬영<input type="file" accept="image/*" capture="environment" onchange="hPh(event)"></div>'
        +'<div class="photo-btn">🖼️ 갤러리<input type="file" accept="image/*" onchange="hPh(event)"></div></div>';
    }
  });
}
function hPh(ev){
  var f=ev.target.files[0]; if(!f||!sel)return;
  phSet(sel,f,function(err){
    if(err){showToast('⚠️ 사진 저장 실패','#dc2626');return;}
    showToast('📷 사진 저장됐어요'); phLoad();
  });
}
/* 확대 — 원본 크기로 오버레이에 얹고 쓸어서 본다.
   ★ blob URL 로 화면을 이동시키면 안 된다 (window.open / target='_blank').
   iOS standalone 에서 히스토리에 남고, revokeObjectURL 후 죽은 항목이 되어
   달력을 쓸다 되돌아가면 WebKitBlobResource 오류 1 화면이 뜬다. 2026-08-01 참조.
   뷰포트가 user-scalable=no 라 앱 안에서 핀치 확대는 어차피 안 되므로,
   원본 크기 이미지를 스크롤해서 읽는 방식으로 대신한다. */
function phZoom(){
  if(!phUrl)return;
  var bg=document.createElement('div');
  bg.className='wn-bg ph-bg';
  bg.innerHTML='<img src="'+phUrl+'" alt="운행일지 사진">';
  bg.onclick=function(){if(bg.parentNode)bg.parentNode.removeChild(bg);};
  document.body.appendChild(bg);
}
function phDelUI(){
  if(!confirm('사진을 삭제할까요?'))return;
  phDel(sel,function(){showToast('🗑️ 사진 삭제됐어요','#64748b');phLoad();});
}


/* ★ 저장 — try-catch로 안정화 */
function showToast(msg,color){
  var t=document.createElement('div');
  t.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:'+(color||'#059669')+';color:#fff;padding:14px 24px;border-radius:12px;font-size:18px;font-weight:600;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.3);white-space:nowrap';
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
      cashList:JSON.stringify(cashList),
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
    if(btn){btn.disabled=false;btn.textContent='저장';}
  }
}
function delE(){
  if(!sel)return;
  if(!confirm('이 날 기록을 삭제할까요?'))return;
  delete logs[sel];phDel(sel);sv();sel=null;
  showToast('🗑️ 삭제됐어요','#64748b');
  setTimeout(function(){go('calendar');},700);
}

/* ── 통계 ── */
function rStats(){
  document.getElementById('hS').textContent='월말결산';
  var y=cd.getFullYear(),m=cd.getMonth();
  var mp=y+'-'+String(m+1).padStart(2,'0');
  var ml=Object.entries(logs).filter(function(e){return e[0].startsWith(mp);});
  var wd=ml.filter(function(e){return e[1].st==='work'||!e[1].st;}).length;
  var tc=ml.reduce(function(s,e){return s+(parseInt(e[1].calls)||0);},0);
  var tv=ml.reduce(function(s,e){return s+(parseFloat(e[1].vol)||0);},0);
  var tkm=ml.reduce(function(s,e){return s+dayKm(e[1]);},0);
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
    tollDetailHtml = '<div class="toll-detail-list" style="margin-top:8px; border-top:1px dashed var(--th-border); padding-top:8px; font-size:15px; color:var(--th-muted);">';
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

  /* 각 날짜별 오티 수당 상세 내역(몇일 몇시간 얼마)을 조회하여 정렬하고,
     통계 탭의 오티 수당 섹션 하단에 리스트로 표기하기 위해 마크업을 동적으로 생성합니다. */
  var otDays = [];
  ml.forEach(function(e) {
    var log = e[1];
    var ot = parseFloat(log.ot || 0);
    if (ot > 0) {
      var pts = e[0].split('-');
      otDays.push({
        day: parseInt(pts[2]),
        ot: ot,
        amount: ot * cfg.otRate
      });
    }
  });
  otDays.sort(function(a, b) { return a.day - b.day; });

  var otDetailHtml = '';
  if (otDays.length > 0) {
    otDetailHtml = '<div class="ot-detail-list" style="margin-top:8px; border-top:1px dashed var(--th-border); padding-top:8px; font-size:15px; color:var(--th-muted);">';
    otDays.forEach(function(od) {
      otDetailHtml += '<div style="display:flex; justify-content:space-between; margin-bottom:4px;">'
        + '<span>' + od.day + '일 (' + od.ot + '시간)</span>'
        + '<span>' + od.amount.toLocaleString() + '원</span>'
        + '</div>';
    });
    otDetailHtml += '</div>';
  }

  /* ★ 유류: 소비>주유=받음, 소비<주유=차감 */
  var fuelDiff=+(fu.mu-fu.mf).toFixed(2);
  var fuelLabel=fuelDiff>=0?'🟢 초과소비 +'+fuelDiff.toFixed(1)+'L — 지급 받음':'🔴 잔량 '+Math.abs(fuelDiff).toFixed(1)+'L — 도급비 차감';
  var fuelColor=fuelDiff>=0?'#059669':'#dc2626';
  /* 이달 정비·현금운행 이동거리 — 일지 운행(tkm)과 합쳐 이달 누적을 만든다 */
  var mMoveKm=ml.reduce(function(s,e){
    var v=e[1];
    var repKm=JSON.parse(v.repList||'[]').reduce(function(rs,r){return rs+(parseInt(r.km||0));},0);
    var cashKm=JSON.parse(v.cashList||'[]').reduce(function(rs,r){return rs+(parseInt(r.km||0));},0);
    return s+repKm+cashKm;
  },0);
  var monthKmTotal=tkm+mMoveKm;
  var ot2I=[];ml.forEach(function(e){JSON.parse(e[1].ot2List||'[]').forEach(function(x,xi){ot2I.push({date:e[0],idx:xi,site:x.site,mgr:x.mgr,type:x.type,settled:x.settled});});});
  var cashI=[];ml.forEach(function(e){JSON.parse(e[1].cashList||'[]').forEach(function(x){cashI.push({date:e[0],site:x.site,mgr:x.mgr,amt:x.amt,km:x.km});});});
  var cashSum=cashI.reduce(function(s,x){return s+(parseInt(x.amt||0));},0);
  var ot2Monthly=ot2I.filter(function(x){return x.type==='monthly'&&!(x.settled===true||x.settled==='true');});
  var wwItems=[];ml.forEach(function(e){JSON.parse(e[1].wwList||'[]').forEach(function(x){wwItems.push({date:e[0],site:x.site});});});
  var monthUnitPrice=getUnitPrice(y,m);
  var base=tc*monthUnitPrice;
  var ot2Pay2=ot2Monthly.length*cfg.ot2Pay;
  var wwPay=tww*(cfg.wwRate||0);
  var monthTotal=base+totA+ot2Pay2+tollMonT+wwPay-mRepCost;

  var h='<div class="sp">'
  +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><button class="ma" onclick="pm()">‹</button><span style="font-size:19px;font-weight:600">'+y+'년 '+(m+1)+'월</span><button class="ma" onclick="nm()">›</button></div>'
  +'<div class="sec">이달 기본 현황</div>'
  +'<div class="mgrid">'
  +'<div class="mc dk full"><div class="mk">기본급</div><div class="mv" style="font-size:'+(base>=1000000?'20px':'25px')+'">'+base.toLocaleString()+'<span class="mu" style="font-size:14px">원</span></div></div>'
  +'<div class="mc"><div class="mk">근무일</div><div class="mv">'+wd+'<span class="mu">일</span></div></div>'
  +'<div class="mc"><div class="mk">총 바리수</div><div class="mv">'+tc+'<span class="mu">바리</span></div></div>'
  +'<div class="mc"><div class="mk">운반량</div><div class="mv">'+tv.toFixed(1)+'<span class="mu">㎥</span></div></div>'
  +'<div class="mc"><div class="mk">운행거리</div><div class="mv">'+tkm.toLocaleString()+'<span class="mu">km</span></div></div>'
  +'</div>'
  +'<div class="sec">이달 운행 누적 km</div>'
  +'<div class="fb"><div class="fr"><span class="fk">일지 운행</span><span class="fv">'+tkm.toLocaleString()+'km</span></div>'
  +'<div class="fr"><span class="fk">정비·현금운행 이동</span><span class="fv">+'+mMoveKm.toLocaleString()+'km</span></div>'
  +'<div class="fr"><span class="fk" style="font-weight:700">이달 누적 합계</span><span class="fv" style="color:var(--th-accent);font-size:19px">'+monthKmTotal.toLocaleString()+'km</span></div></div>'
  +'<div class="sec">유류 현황 (이달 / 정산 별도)</div>'
  +'<div class="fb"><div class="fr"><span class="fk">이달 주유량</span><span class="fv" style="color:#059669">+'+fu.mf.toFixed(1)+'L</span></div>'
  +'<div class="fr"><span class="fk">이달 소비량</span><span class="fv" style="color:#dc2626">'+fu.mu.toFixed(1)+'L</span></div>'
  +'<div class="fr"><span class="fk" style="font-weight:700">이달 유류 정산</span><span class="fv" style="color:'+fuelColor+'">'+fuelLabel+'</span></div></div>'
  +'<div class="sec">오티 수당</div>'
  +'<div class="fb"><div class="fr"><span class="fk">이달 오티 시간</span><span class="fv">'+tot+'시간</span></div>'
  +'<div class="fr"><span class="fk">오티 수당 합계</span><span class="fv" style="color:#7c3aed">'+totA.toLocaleString()+'원</span></div>'
  +otDetailHtml+'</div>'
  +'<div class="sec">폐수처리 ('+tww+'건 / 합계 '+wwPay.toLocaleString()+'원)</div>'
  +(wwItems.length?wwItems.map(function(e){var p=e.date.split('-');return'<div class="wwi"><div class="ot2d">'+p[1]+'월 '+p[2]+'일</div><div class="ot2n">'+(e.site||'현장 미입력')+'</div></div>';}).join(''):'<div class="emsg">이달 폐수처리 없음</div>')
  +'<div class="sec">톨비 (울산대교)</div>'
  +'<div class="fb"><div class="fr"><span class="fk">3,600원 통행</span><span class="fv">'+tt1+'회 = '+tollMon1.toLocaleString()+'원</span></div>'
  +'<div class="fr"><span class="fk">2,400원 통행</span><span class="fv">'+tt2+'회 = '+tollMon2.toLocaleString()+'원</span></div>'
  +'<div class="fr"><span class="fk" style="font-weight:700">월 톨비 합계</span><span class="fv" style="color:var(--th-accent);font-size:19px">'+tollMonT.toLocaleString()+'원</span></div>'
  +tollDetailHtml+'</div>'
  +'<div class="sec">2시간초과 현황 ('+ot2I.length+'건)</div>'
  +(ot2I.length?'<div style="font-size:14px;color:var(--th-muted);margin-bottom:6px">항목을 탭하면 정산완료/취소로 바뀝니다</div>'+ot2I.map(function(e){
    var p=e.date.split('-');
    var isS=e.settled===true||e.settled==='true';
    return'<div class="ot2i'+(e.type==='monthly'?' mo':'')+'" style="cursor:pointer;'+(isS?'opacity:.5':'')+'" onclick="stToggleOT2(\''+e.date+'\','+e.idx+')">'
      +'<div class="ot2d">'+p[1]+'월 '+p[2]+'일 '+(isS?'✅ 정산완료 (탭하면 취소)':'')+'</div>'
      +'<div class="ot2n" style="'+(isS?'text-decoration:line-through':'')+'">'+( e.site||'현장 미입력')+(e.mgr?' / '+e.mgr:'')
      +'<span class="ot2tp '+(e.type==='monthly'?'tm':'tc')+'">'+(e.type==='monthly'?'월말결산':'영업사원')+'</span></div></div>';
  }).join(''):'<div class="emsg">이달 2시간초과 없음</div>')
  +(ot2Monthly.length?'<div style="background:#fef2f2;border:0.5px solid #fca5a5;border-radius:8px;padding:9px 12px;margin-top:6px;font-size:15px;color:#991b1b">⚠️ 월말 결산 필요: '+ot2Monthly.length+'건</div>':'')
  +(mRepCost>0?'<div class="sec">차량 정비 비용</div><div class="fb"><div class="fr"><span class="fk">이달 정비 비용</span><span class="fv" style="color:#dc2626">'+mRepCost.toLocaleString()+'원</span></div></div>':'')
  +(cashI.length?'<div class="sec">일반현장 현금거래 ('+cashI.length+'건 / 합계 '+cashSum.toLocaleString()+'원 — 참고용)</div>'
    +cashI.map(function(e){
      var p=e.date.split('-');
      return'<div class="ot2i" style="border-left-color:#0891b2">'
        +'<div class="ot2d">'+p[1]+'월 '+p[2]+'일'+(e.km?' · 이동 '+e.km+'km':'')+'</div>'
        +'<div class="ot2n">'+(e.site||'위치 미입력')+(e.mgr?' / '+e.mgr:'')
        +'<span style="margin-left:auto;font-weight:700;color:#0891b2">'+(parseInt(e.amt||0)).toLocaleString()+'원</span></div></div>';
    }).join(''):'')
  +'<div class="sec" style="margin-top:24px">📋 '+(m+1)+'월 최종 결산 (유류 별도)</div>'
  +'<div class="fb"><div class="fr"><span class="fk">기본급 ('+tc+'바리 × '+monthUnitPrice.toLocaleString()+'원)</span><span class="fv">+'+base.toLocaleString()+'원</span></div>'
  +(totA>0?'<div class="fr"><span class="fk">오티 수당</span><span class="fv" style="color:#7c3aed">+'+totA.toLocaleString()+'원</span></div>':'')
  +(ot2Pay2>0?'<div class="fr"><span class="fk">2시간초과 수당</span><span class="fv" style="color:#7c3aed">+'+ot2Pay2.toLocaleString()+'원</span></div>':'')
  +(wwPay>0?'<div class="fr"><span class="fk">폐수 수당</span><span class="fv" style="color:#059669">+'+wwPay.toLocaleString()+'원</span></div>':'')
  +(tollMonT>0?'<div class="fr"><span class="fk">톨비 지급</span><span class="fv" style="color:var(--th-accent)">+'+tollMonT.toLocaleString()+'원</span></div>':'')
  +(mRepCost>0?'<div class="fr"><span class="fk">정비비 차감</span><span class="fv" style="color:#dc2626">−'+mRepCost.toLocaleString()+'원</span></div>':'')
  +'</div>'
  +'<div style="background:var(--th-bg2);border:1px solid var(--th-border);border-radius:10px;padding:16px;text-align:center;margin-bottom:16px">'
  +'<div style="font-size:15px;color:var(--th-muted);margin-bottom:6px">'+(m+1)+'월 수령 예정액 (유류 별도)</div>'
  +'<div style="font-size:'+(monthTotal>=10000000?'24px':monthTotal>=1000000?'28px':'32px')+';font-weight:700;color:var(--th-text)">'+monthTotal.toLocaleString()+'원</div>'
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
      rows+='<tr><td style="padding:8px 10px;font-size:14px;color:var(--th-muted)">'+(mi+1)+'월</td><td colspan="5" style="padding:8px 6px;font-size:13px;color:var(--th-muted);text-align:center">기록 없음</td></tr>';
      continue;
    }
    activeMonths++;
    var wd2=ml2.filter(function(e){return e[1].st==='work'||!e[1].st;}).length;
    var tc2=ml2.reduce(function(s,e){return s+(parseInt(e[1].calls)||0);},0);
    var km2=ml2.reduce(function(s,e){return s+dayKm(e[1]);},0);
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
      +'<td style="padding:8px 10px;font-size:15px;font-weight:600;color:var(--th-text)">'+(mi+1)+'월</td>'
      +'<td style="padding:8px 6px;font-size:14px;color:var(--th-muted);text-align:right">'+wd2+'일</td>'
      +'<td style="padding:8px 6px;font-size:14px;color:var(--th-muted);text-align:right">'+tc2+'</td>'
      +'<td style="padding:8px 6px;font-size:13px;text-align:right">'+base2.toLocaleString()+'</td>'
      +'<td style="padding:8px 6px;font-size:13px;color:#7c3aed;text-align:right">'+(otP2>0?'+'+otP2.toLocaleString():'0')+'</td>'
      +'<td style="padding:8px 10px;font-size:14px;font-weight:700;color:'+(mTot2>=0?'var(--th-accent)':'#dc2626')+';text-align:right">'+mTot2.toLocaleString()+'</td>'
      +'</tr>';
  }
  var avgCalls=annWd>0?(annCalls/annWd).toFixed(1):'0';
  var avgMonthly=activeMonths>0?Math.round(annTotal/activeMonths):0;
  var h='<div class="sp">'
  +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px"><button class="ma" onclick="pyear()">‹</button><span style="font-size:22px;font-weight:700;color:var(--th-text)">'+y+'년 연말결산</span><button class="ma" onclick="nyear()">›</button></div>'
  +'<div class="mgrid" style="margin-bottom:12px">'
  +'<div class="mc dk full"><div class="mk">연간 총 수령액 (유류 별도)</div><div class="mv" style="font-size:'+(annTotal>=100000000?'17px':annTotal>=10000000?'20px':'22px')+'">'+annTotal.toLocaleString()+'<span class="mu" style="font-size:14px">원</span></div></div>'
  +'<div class="mc"><div class="mk">총 근무일</div><div class="mv">'+annWd+'<span class="mu">일</span></div></div>'
  +'<div class="mc"><div class="mk">총 바리수</div><div class="mv">'+annCalls+'<span class="mu">바리</span></div></div>'
  +'<div class="mc"><div class="mk">일 평균 바리</div><div class="mv">'+avgCalls+'<span class="mu">바리</span></div></div>'
  +'<div class="mc"><div class="mk">총 운행거리</div><div class="mv">'+annKm.toLocaleString()+'<span class="mu">km</span></div></div>'
  +'<div class="mc"><div class="mk">연간 오티</div><div class="mv" style="color:#7c3aed;font-size:19px">'+annOTpay.toLocaleString()+'<span class="mu">원</span></div></div>'
  +'<div class="mc"><div class="mk">연간 톨비</div><div class="mv" style="color:var(--th-accent);font-size:19px">'+annToll.toLocaleString()+'<span class="mu">원</span></div></div>'
  +'<div class="mc"><div class="mk">연간 정비비</div><div class="mv" style="color:#dc2626;font-size:19px">'+annRep.toLocaleString()+'<span class="mu">원</span></div></div>'
  +'</div>'
  +'<div style="font-size:14px;font-weight:700;color:var(--th-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">월별 상세</div>'
  +'<div style="background:var(--th-bg2);border-radius:10px;overflow-x:auto;border:0.5px solid var(--th-border);margin-bottom:12px">'
  +'<table style="width:100%;border-collapse:collapse;white-space:nowrap">'
  +'<thead><tr style="background:var(--th-primary-dark);border-bottom:1px solid var(--th-border)">'
  +'<th style="padding:8px 10px;font-size:13px;color:var(--th-muted);font-weight:600;text-align:left">월</th>'
  +'<th style="padding:8px 4px;font-size:12px;color:var(--th-muted);font-weight:600;text-align:right">근무</th>'
  +'<th style="padding:8px 4px;font-size:12px;color:var(--th-muted);font-weight:600;text-align:right">바리</th>'
  +'<th style="padding:8px 4px;font-size:12px;color:var(--th-muted);font-weight:600;text-align:right">기본급</th>'
  +'<th style="padding:8px 4px;font-size:12px;color:var(--th-muted);font-weight:600;text-align:right">오티</th>'
  +'<th style="padding:8px 10px;font-size:12px;color:var(--th-muted);font-weight:600;text-align:right">합계</th>'
  +'</tr></thead><tbody>'+rows+'</tbody>'
  +'<tfoot><tr style="background:var(--th-primary-dark);border-top:1px solid var(--th-border)">'
  +'<td style="padding:10px;font-size:14px;font-weight:700;color:var(--th-text)">합계</td>'
  +'<td style="padding:10px 4px;font-size:13px;color:var(--th-muted);text-align:right">'+annWd+'일</td>'
  +'<td style="padding:10px 4px;font-size:13px;color:var(--th-muted);text-align:right">'+annCalls+'</td>'
  +'<td style="padding:10px 4px;font-size:12px;color:var(--th-text);text-align:right">'+annBase.toLocaleString()+'</td>'
  +'<td style="padding:10px 4px;font-size:12px;color:#7c3aed;text-align:right">'+annOTpay.toLocaleString()+'</td>'
  +'<td style="padding:10px;font-size:14px;font-weight:700;color:var(--th-accent);text-align:right">'+annTotal.toLocaleString()+'</td>'
  +'</tr></tfoot></table></div>'
  +'<div style="background:linear-gradient(135deg,#065f46,#047857);border-radius:12px;padding:18px 16px;text-align:center;margin-bottom:16px">'
  +'<div style="font-size:15px;color:rgba(255,255,255,.7);margin-bottom:6px">'+y+'년 연간 총 수령액 (유류 별도)</div>'
  +'<div style="font-size:'+(annTotal>=100000000?'26px':'32px')+';font-weight:700;color:#fff">'+annTotal.toLocaleString()+'원</div>'
  +'<div style="font-size:15px;color:rgba(255,255,255,.6);margin-top:6px">월 평균 '+avgMonthly.toLocaleString()+'원 · 총 '+annWd+'일 근무</div>'
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
  +'<div class="cfg-sec">테마 색상</div>'
  +'<div style="background:var(--th-bg2);border-radius:10px;padding:12px 14px;margin-bottom:12px;border:0.5px solid var(--th-border)">'
  +'<p style="font-size:15px;color:var(--th-muted);margin-bottom:12px">테마를 선택하면 앱 전체 색이 바뀌어요</p>'
  +'<div class="theme-grid">'+themeHtml+'</div>'
  +'</div>'
  +'<div class="cfg-sec">달력 표시</div>'
  +'<div class="sblk">'
  +cfgToggle('음력 날짜','초하루·보름에만 표시. 그 외 날짜는 눌러서 확인','showLunar')
  +cfgToggle('공휴일','빨간날과 공휴일 이름을 표시','showHoliday')
  +cfgToggle('절기·기념일','입춘·복날·어버이날 등. 칸이 좁아 기본 꺼둠','showTerm')
  +'</div>'
  +'<div class="cfg-sec">음력 기념일</div>'
  +'<div class="sblk" style="padding:12px 14px">'
  +'<p style="font-size:14px;color:var(--th-muted);margin-bottom:10px;line-height:1.6">'
  +'생일·기일을 음력으로 등록해두면 해마다 바뀌는 양력 날짜에 자동으로 표시돼요.<br>'
  +'달력 데이터는 '+KL_MIN+'~'+KL_MAX+'년까지 들어있어요.</p>'
  +'<div id="leCon">'+mkLE()+'</div>'
  +'<button class="add-btn" onclick="addLE()">+ 기념일 추가</button>'
  +'</div>'
  +'<div class="cfg-sec">급여 설정 (' + (cm + 1) + '월 기준)</div>'
  +'<div class="sblk">'
  +'<div class="srow"><div><span class="slbl">' + (cm + 1) + '월 바리당 단가</span><span class="slbl-sub">선택된 월에만 적용되는 단가</span></div><div style="display:flex;align-items:center;gap:4px"><input class="sinp" type="number" value="' + curMonthPrice + '" oninput="setMonthlyPrice(' + cy + ',' + cm + ', +this.value);sv()"><span style="font-size:14px;color:var(--th-muted)">원</span></div></div>'
  +'<div class="srow"><div><span class="slbl">기본 바리당 단가</span><span class="slbl-sub">신규 월 시작 시 기본값</span></div><div style="display:flex;align-items:center;gap:4px"><input class="sinp" type="number" value="'+cfg.unitPrice+'" oninput="cfg.unitPrice=+this.value;sv()"><span style="font-size:14px;color:var(--th-muted)">원</span></div></div>'
  +'<div class="srow"><div><span class="slbl">오티 시간당</span></div><div style="display:flex;align-items:center;gap:4px"><input class="sinp" type="number" value="'+cfg.otRate+'" oninput="cfg.otRate=+this.value;sv()"><span style="font-size:14px;color:var(--th-muted)">원</span></div></div>'
  +'<div class="srow"><div><span class="slbl">2시간초과 건당</span><span class="slbl-sub">미정산 건에만 적용</span></div><div style="display:flex;align-items:center;gap:4px"><input class="sinp" type="number" value="'+cfg.ot2Pay+'" placeholder="0" oninput="cfg.ot2Pay=+this.value;sv()"><span style="font-size:14px;color:var(--th-muted)">원</span></div></div>'
  +'<div class="srow"><div><span class="slbl">폐수 건당 단가</span></div><div style="display:flex;align-items:center;gap:4px"><input class="sinp" type="number" value="'+(cfg.wwRate||0)+'" oninput="cfg.wwRate=+this.value;sv()"><span style="font-size:14px;color:var(--th-muted)">원</span></div></div>'
  +'</div>'
  +'<div class="cfg-sec">유류 설정</div>'
  +'<div class="sblk">'
  +'<div class="srow"><div><span class="slbl">km당 유류 소모</span></div><div style="display:flex;align-items:center;gap:4px"><input class="sinp" type="number" step="0.01" value="'+cfg.fuelRate+'" oninput="cfg.fuelRate=+this.value;sv()"><span style="font-size:14px;color:var(--th-muted)">L/km</span></div></div>'
  +'<div class="srow"><div><span class="slbl">연료 정산 단가</span></div><div style="display:flex;align-items:center;gap:4px"><input class="sinp" type="number" value="'+cfg.fuelPrice+'" oninput="cfg.fuelPrice=+this.value;sv()"><span style="font-size:14px;color:var(--th-muted)">원/L</span></div></div>'
  +'</div>'
  +'<div class="cfg-sec">차량 설정</div>'
  +'<div class="sblk">'
  +'<div class="srow"><div><span class="slbl">기준 km</span><span class="slbl-sub">앱 시작 시점 차량 km</span></div><div style="display:flex;align-items:center;gap:4px"><input class="sinp" type="number" value="'+cfg.initKm+'" oninput="cfg.initKm=+this.value;sv()"><span style="font-size:14px;color:var(--th-muted)">km</span></div></div>'
  +'</div>'
  +'<div class="cfg-sec">톨비 설정</div>'
  +'<div class="sblk">'
  +'<div class="srow"><div><span class="slbl">대형 단가</span></div><div style="display:flex;align-items:center;gap:4px"><input class="sinp" type="number" value="'+cfg.toll1+'" oninput="cfg.toll1=+this.value;sv()"><span style="font-size:14px;color:var(--th-muted)">원</span></div></div>'
  +'<div class="srow"><div><span class="slbl">소형 단가</span></div><div style="display:flex;align-items:center;gap:4px"><input class="sinp" type="number" value="'+cfg.toll2+'" oninput="cfg.toll2=+this.value;sv()"><span style="font-size:14px;color:var(--th-muted)">원</span></div></div>'
  +'</div>'
  +'<div class="cfg-sec">업데이트 내역</div>'
  +'<div class="sblk" style="padding:4px 14px 12px">'
  +'<p style="font-size:14px;color:var(--th-muted);margin:10px 0 4px">현재 버전 v'+esc(APP_VERSION)+'</p>'
  +CHANGELOG.map(function(e){
    return'<div class="cl-item">'
      +'<div class="wn-ver">'+wnDate(e)+'</div>'
      +'<div class="cl-t">'+esc(e.t)+'</div>'
      +'<ul class="wn-list">'+wnItems(e)+'</ul>'
      +'</div>';
  }).join('')
  +'</div>'
  +'<div class="cfg-sec">데이터 백업 / 복원</div>'
  +'<div style="background:var(--th-bg2);border-radius:10px;padding:14px;margin-bottom:12px;border:0.5px solid var(--th-border)">'
  +'<p style="font-size:15px;color:var(--th-muted);margin-bottom:12px;line-height:1.6">백업 파일을 저장해두면 폰을 바꿔도 데이터를 복원할 수 있어요.<br><span style="color:#fbbf24">※ 운행일지 사진은 용량이 커서 백업에 포함되지 않아요. 폰을 바꾸면 사진은 옮겨지지 않습니다.</span></p>'
  +'<button class="backup-btn dl" onclick="doBackup()">⬇️ 데이터 백업 (다운로드)</button>'
  +'<button class="backup-btn ul" onclick="document.getElementById(\'restoreFile\').click()">⬆️ 데이터 복원 (파일 선택)<input type="file" id="restoreFile" accept=".json" style="display:none" onchange="doRestore(event)"></button>'
  +'</div>'
  +'<div class="cfg-sec" style="color:#dc2626">위험 구역</div>'
  +'<div style="background:#fef2f2;border-radius:10px;padding:14px;border:0.5px solid #fca5a5">'
  +'<p style="font-size:15px;color:#991b1b;margin-bottom:12px">모든 운행 데이터가 삭제돼요. 복구 불가능해요.</p>'
  +'<button class="backup-btn danger" onclick="doReset()">전체 데이터 초기화</button>'
  +'</div></div>';
  document.getElementById('mc').innerHTML=h;
}

/* ── 달력 표시 토글 ── */
function cfgToggle(label,sub,key){
  var on=cfg[key]===true;   /* 로드 시 세 플래그 모두 boolean 으로 정규화된다 */
  return'<div class="srow"><div><span class="slbl">'+label+'</span><span class="slbl-sub">'+sub+'</span></div>'
    +'<div class="btns tgl">'
    +'<button class="btn'+(on?' on':'')+'" onclick="setCfgFlag(\''+key+'\',true)">켜기</button>'
    +'<button class="btn'+(on?'':' on')+'" onclick="setCfgFlag(\''+key+'\',false)">끄기</button>'
    +'</div></div>';
}
function setCfgFlag(k,v){cfg[k]=v;sv();rConfig();}

/* ── 음력 기념일 (생일·기일) ── */
function mkLE(){
  var L=cfg.lunarEvents;
  if(!L.length)return'<div style="font-size:16px;color:var(--th-muted);padding:4px 0 10px">등록된 기념일이 없어요</div>';
  var ty=new Date().getFullYear();
  return L.map(function(e,i){
    var s=e.solar?null:kcSolar(ty,e.lm,e.ld,e.leap);
    var when=e.solar?('양력 '+e.lm+'월 '+e.ld+'일')
      :(s?('올해 '+(+s.slice(5,7))+'월 '+(+s.slice(8,10))+'일'):'올해 날짜 없음');
    var mo=[];
    for(var k=1;k<=12;k++) mo.push('<option value="'+k+'"'+(e.lm===k?' selected':'')+'>'+k+'월</option>');
    /* 음력은 한 달이 최대 30일, 양력은 31일 */
    var dy=[], maxD=e.solar?31:30;
    for(k=1;k<=maxD;k++) dy.push('<option value="'+k+'"'+(e.ld===k?' selected':'')+'>'+k+'일</option>');
    return'<div class="item-card" style="border-left:3px solid var(--th-event)">'
      +'<div class="item-hdr"><span class="item-title" style="color:var(--th-event)">'+when+'</span>'
      +'<button class="item-rm" onclick="rmLE('+i+')">삭제</button></div>'
      +'<div class="item-fields">'
      +'<div class="field"><label class="fl">이름</label>'
      +'<input type="text" id="len'+i+'" value="'+esc(e.name)+'" placeholder="예: 아버지 생신" oninput="upLEName('+i+')"></div>'
      +'<div class="field"><label class="fl">날짜</label><div style="display:flex;gap:5px">'
      +'<select id="leb'+i+'" onchange="upLEDate('+i+')" style="flex:1">'
      +'<option value="0"'+(e.solar?'':' selected')+'>음력</option>'
      +'<option value="1"'+(e.solar?' selected':'')+'>양력</option></select>'
      +'<select id="lem'+i+'" onchange="upLEDate('+i+')" style="flex:1">'+mo.join('')+'</select>'
      +'<select id="led'+i+'" onchange="upLEDate('+i+')" style="flex:1">'+dy.join('')+'</select>'
      +'</div></div>'
      +'<div class="field"><label class="fl">윤달</label>'
      +'<select id="lel'+i+'" onchange="upLEDate('+i+')"'+(e.solar?' disabled':'')+'>'
      +'<option value="0"'+(e.leap?'':' selected')+'>평달</option>'
      +'<option value="1"'+(e.leap?' selected':'')+'>윤달</option></select></div>'
      +'</div></div>';
  }).join('');
}
function addLE(){
  cfg.lunarEvents.push({name:'',lm:1,ld:1,leap:false,solar:false});
  sv();rConfig();
}
function rmLE(i){cfg.lunarEvents.splice(i,1);sv();rConfig();}
/* 이름 입력 — 입력 중 포커스가 날아가면 안 되므로 다시 그리지 않는다 */
function upLEName(i){
  var n=document.getElementById('len'+i);
  if(n){cfg.lunarEvents[i].name=n.value;sv();}
}
/* 날짜·윤달 변경 — 카드 제목의 '올해 양력' 이 바뀌므로 목록을 다시 그린다 */
function upLEDate(i){
  var e=cfg.lunarEvents[i];
  var b=document.getElementById('leb'+i), m=document.getElementById('lem'+i),
      d=document.getElementById('led'+i), l=document.getElementById('lel'+i);
  if(b) e.solar=b.value==='1';
  if(m) e.lm=+m.value;
  if(d) e.ld=+d.value;
  e.leap=!e.solar&&!!l&&l.value==='1';
  sv();
  document.getElementById('leCon').innerHTML=mkLE();
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

  /* ★ iOS PWA에서 blob URL로 화면을 이동시키면 안 된다.
     예전엔 a.target='_blank' 로 새 탭을 열었는데, 그러면 그 주소가 히스토리에 남고
     3초 뒤 revokeObjectURL() 로 blob이 해제되면서 죽은 항목이 된다. standalone PWA는
     가장자리 가로 스와이프가 뒤로/앞으로 가기라, 달력을 넘기다 그 죽은 주소로 돌아가
     'WebKitBlobResource 오류 1' 화면이 떴다. (2026-08-01)
     공유 시트는 화면 이동이 없어서 이 문제가 생기지 않는다. */
  var file=null;
  try{ file=new File([json],filename,{type:'application/json'}); }catch(e){}

  if(file&&navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
    navigator.share({files:[file],title:filename})
      .then(function(){showToast('💾 백업 파일을 저장했어요!');})
      .catch(function(err){
        if(err&&err.name==='AbortError')return;   /* 사용자가 공유창을 닫음 — 조용히 */
        dlBackup(json,filename);
      });
    return;
  }
  dlBackup(json,filename);
}
/* 공유 시트를 못 쓰는 브라우저(PC 등)용 다운로드.
   ★ target 을 주지 말 것 — 위 주석의 iOS 히스토리 문제가 그대로 재발한다 */
function dlBackup(json,filename){
  var url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
  var a=document.createElement('a');
  a.href=url;a.download=filename;
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
      logs=data.logs;cfg=data.cfg;
      phKeys.slice().forEach(function(k){if(!logs[k])phDel(k);});
      sv();applyTheme(cfg.theme);
      showToast('✅ 복원 완료!');render();
    }catch(err){showToast('파일을 읽을 수 없어요','#dc2626');}
  };
  r.readAsText(file);ev.target.value='';
}
function doReset(){
  if(!confirm('정말로 모든 데이터를 삭제하시겠어요?'))return;
  if(!confirm('한 번 더 확인합니다. 전체 데이터를 삭제합니다.'))return;
  logs={};phTx('readwrite',function(s){s.clear();});phKeys=[];sv();showToast('🗑️ 초기화 완료','#64748b');render();
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

/* ── 업데이트 알림 ── */

/* 변경 내역 항목 하나를 목록 HTML 로.
   문구는 CHANGELOG 에서 오지만 HTML을 + 로 이어붙이므로 esc() 를 태운다 */
function wnItems(e){
  return e.items.map(function(s){return'<li>'+esc(s)+'</li>';}).join('');
}
function wnDate(e){
  var p=e.d.split('-');
  return 'v'+esc(e.v)+' · '+(+p[1])+'월 '+(+p[2])+'일';
}

function showWhatsNew(e){
  var bg=document.createElement('div');
  bg.className='wn-bg'; bg.id='wnBg';
  bg.innerHTML='<div class="wn" onclick="event.stopPropagation()">'
    +'<div class="wn-ver">'+wnDate(e)+'</div>'
    +'<div class="wn-t">🎉 '+esc(e.t)+'</div>'
    +'<ul class="wn-list">'+wnItems(e)+'</ul>'
    +'<button class="backup-btn dl wn-btn" onclick="closeWhatsNew()">확인</button>'
    +'</div>';
  bg.onclick=closeWhatsNew;          /* 배경을 눌러도 닫힌다 */
  document.body.appendChild(bg);
}
function closeWhatsNew(){
  cfg.seenVersion=APP_VERSION; sv();
  var bg=document.getElementById('wnBg');
  if(bg&&bg.parentNode) bg.parentNode.removeChild(bg);
}
/* 앱을 열 때 한 번 — 버전이 달라졌으면 최신 항목 하나만 띄운다 */
function checkWhatsNew(){
  if(cfg.seenVersion===APP_VERSION) return;
  /* 갓 설치한 사람에게는 안 띄운다 (기록이 하나도 없으면 신규로 본다) */
  if(cfg.seenVersion===undefined&&!Object.keys(logs).length){
    cfg.seenVersion=APP_VERSION; sv(); return;
  }
  showWhatsNew(CHANGELOG[0]);
}

/* 서비스워커가 새 버전을 받아두면 index.html 이 이걸 부른다.
   자동 새로고침은 하지 않는다 — 기록을 쓰던 중이면 입력이 날아간다 */
function showUpdateBar(){
  if(document.getElementById('upBar')) return;
  var d=document.createElement('div');
  d.className='upbar'; d.id='upBar';
  d.innerHTML='<span>새 버전이 준비됐어요</span>'
    +'<button onclick="location.reload()">새로고침</button>';
  document.body.appendChild(d);
}

/* ── 시작 ── */
render();
checkWhatsNew();

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
