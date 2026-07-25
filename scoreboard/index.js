const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    const url = new URL(request.url);

    if (url.pathname === "/api/score" && request.method === "POST") {
      const body = await request.json();
      await env.SCORES.put("game", JSON.stringify({ ...body, ts: Date.now() }), { expirationTtl: 86400 });
      return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/score" && request.method === "GET") {
      const data = await env.SCORES.get("game");
      return new Response(data || '{"players":[]}', { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    return new Response(SCOREBOARD_HTML, { headers: { "Content-Type": "text/html;charset=utf-8" } });
  }
};

const SCOREBOARD_HTML = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Dartbord Scorebord</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0c1a;color:#e8eaf6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:24px 16px;}
h1{font-size:clamp(1.6rem,4vw,2.4rem);margin-bottom:8px;text-align:center}
.sub{color:#7b83b0;font-size:0.85rem;margin-bottom:24px}
.match-info{background:#181c30;border-radius:12px;padding:10px 20px;margin-bottom:20px;font-size:0.95rem;color:#a0a8d0;text-align:center}
.board{display:flex;flex-direction:column;gap:12px;width:100%;max-width:700px}
.player{background:linear-gradient(135deg,#181c30,#1e2340);border-radius:16px;padding:20px 24px;
  transition:all .4s;border:2px solid transparent}
.player.active{border-color:#4fd1c5;box-shadow:0 0 20px rgba(79,209,197,.15)}
.player.winner{border-color:#ffd700;box-shadow:0 0 25px rgba(255,215,0,.2);background:linear-gradient(135deg,#1c2010,#2a2e10)}
.ptop{display:flex;align-items:center;gap:16px}
.rank{font-size:1.8rem;width:44px;text-align:center;flex-shrink:0}
.info{flex:1;min-width:0}
.name{font-size:clamp(1.1rem,3vw,1.4rem);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.meta{color:#7b83b0;font-size:0.82rem;margin-top:2px}
.score{font-size:clamp(2rem,6vw,3.2rem);font-weight:800;font-variant-numeric:tabular-nums;
  background:linear-gradient(180deg,#fff,#a0a8d0);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.player.winner .score{background:linear-gradient(180deg,#ffd700,#ffaa00);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.legs-sets{display:flex;gap:8px;margin-top:6px}
.chip{background:#262a44;border-radius:6px;padding:2px 8px;font-size:0.75rem;color:#a0a8d0}
.dot{width:8px;height:8px;border-radius:50%;background:#4fd1c5;display:inline-block;margin-right:6px;animation:pulse 1.5s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.pstats{display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:6px;margin-top:10px;
  padding-top:10px;border-top:1px solid #262a44}
.ps{text-align:center}
.ps .v{font-size:1rem;font-weight:700;color:#e8eaf6}
.ps .k{font-size:0.65rem;color:#7b83b0;margin-top:1px}
.waiting{text-align:center;color:#7b83b0;margin-top:80px;font-size:1.1rem}
.waiting .icon{font-size:3rem;margin-bottom:12px}
.last-update{color:#555;font-size:0.75rem;margin-top:16px;text-align:center}
.thrown{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}
.dart{background:#262a44;border-radius:6px;padding:2px 8px;font-size:0.8rem;color:#e8eaf6;font-weight:600}
.dart.bust{opacity:.4;text-decoration:line-through}
</style>
</head>
<body>
<h1>Live Scorebord</h1>
<p class="sub">Automatisch bijgewerkt</p>
<div id="matchInfo" class="match-info" style="display:none"></div>
<div id="board" class="board"></div>
<div id="waiting" class="waiting"><div class="icon">🎯</div>Wachten op een spel...<br><small>Start een potje in de Dartbord Teller app</small></div>
<div id="lastUpdate" class="last-update"></div>
<script>
let prev='';
async function poll(){
  try{
    const r=await fetch('/api/score');
    const d=await r.json();
    const j=JSON.stringify(d);
    if(j===prev) return;
    prev=j;
    render(d);
  }catch(e){}
}
function render(d){
  const board=document.getElementById('board');
  const wait=document.getElementById('waiting');
  const mi=document.getElementById('matchInfo');
  if(!d.players||!d.players.length){wait.style.display='';board.innerHTML='';mi.style.display='none';return;}
  wait.style.display='none';
  if(d.matchFormat&&d.matchFormat!=='single'){
    const fmt={bo3:'Best of 3 legs',bo5:'Best of 5 legs',bo7:'Best of 7 legs',sets:'Sets'}[d.matchFormat]||d.matchFormat;
    mi.textContent=fmt+(d.legNo?' \\u2014 Leg '+d.legNo:'');
    mi.style.display='';
  } else mi.style.display='none';
  board.innerHTML=d.players.map((p,i)=>{
    const active=i===d.current&&!d.over;
    const winner=d.over&&i===d.winnerIdx;
    let cls='player';
    if(active) cls+=' active';
    if(winner) cls+=' winner';
    const avg=p.darts>=3?((d.start-p.score)/p.darts*3).toFixed(1):'\\u2013';
    let chips='';
    if(d.matchFormat&&d.matchFormat!=='single'){
      chips='<div class="legs-sets">';
      chips+='<span class="chip">Legs: '+p.legs+'</span>';
      if(d.matchFormat==='sets') chips+='<span class="chip">Sets: '+p.sets+'</span>';
      chips+='</div>';
    }
    let thrown='';
    if(active&&d.thrown&&d.thrown.length){
      thrown='<div class="thrown">'+d.thrown.map(t=>'<span class="dart'+(t.bust?' bust':'')+'">'+t.label+'</span>').join('')+'</div>';
    }
    let statsHtml='';
    const st=d.stats&&d.stats[i];
    if(st){
      statsHtml='<div class="pstats">'+
        '<div class="ps"><div class="v">'+st.avg+'</div><div class="k">gem/3</div></div>'+
        '<div class="ps"><div class="v">'+st.best+'</div><div class="k">beste</div></div>'+
        '<div class="ps"><div class="v">'+st.t180+'x</div><div class="k">180\\'s</div></div>'+
        '<div class="ps"><div class="v">'+st.t100+'x</div><div class="k">100+</div></div>'+
        '<div class="ps"><div class="v">'+st.dblH+'x/'+st.triH+'x</div><div class="k">dbl/tri</div></div>'+
        '<div class="ps"><div class="v">'+(st.coPct!=null?st.coPct+'%':'\\u2013')+'</div><div class="k">checkout</div></div>'+
        '<div class="ps"><div class="v">'+st.raak+'%</div><div class="k">raak</div></div>'+
        '<div class="ps"><div class="v">'+st.games+'</div><div class="k">potjes</div></div>'+
      '</div>';
    }
    return '<div class="'+cls+'"><div class="ptop">'+
      '<div class="rank">'+(winner?'\\ud83c\\udfc6':(active?'<span class="dot"></span>':''))+'</div>'+
      '<div class="info"><div class="name">'+esc(p.name)+'</div>'+
        '<div class="meta">'+p.darts+' darts \\u00b7 gem. '+avg+'</div>'+chips+thrown+'</div>'+
      '<div class="score">'+(winner?'\\ud83c\\udf89':p.score)+'</div></div>'+statsHtml+'</div>';
  }).join('');
  if(d.ts){
    const s=Math.round((Date.now()-d.ts)/1000);
    document.getElementById('lastUpdate').textContent=s<5?'zojuist bijgewerkt':s+'s geleden bijgewerkt';
  }
}
function esc(s){return (''+s).replace(/</g,'&lt;');}
setInterval(poll,2000);
poll();
</script>
</body>
</html>`;
