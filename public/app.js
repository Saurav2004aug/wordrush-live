const socket = io();
const $ = id => document.getElementById(id);
let currentCode = null, currentState = null, myId = null;
socket.on("connect", () => { myId = socket.id; });
const show = id => $(id).classList.remove("hidden");
const hide = id => $(id).classList.add("hidden");
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2300);}
function nameValue(){return $("playerName").value.trim();}
function setError(msg){$("homeError").textContent=msg||"";}
$("createBtn").onclick = () => {
  setError("");
  socket.emit("createRoom",{name:nameValue()},res=>{
    if(res?.error){setError(res.error);return;}
    currentCode=res.code; enterGame();
  });
};
$("joinBtn").onclick = () => {
  setError("");
  socket.emit("joinRoom",{name:nameValue(),code:$("roomCodeInput").value},res=>{
    if(res?.error){setError(res.error);return;}
    currentCode=res.code; enterGame();
  });
};
function enterGame(){hide("home");show("game");$("roomCode").textContent=currentCode||"-----";$("wordInput").focus();}
$("copyBtn").onclick = async () => {
  try{await navigator.clipboard.writeText(currentCode);toast("Room code copied!");}
  catch{toast("Share this room code: "+currentCode);}
};
$("wordForm").onsubmit = e => {
  e.preventDefault();const word=$("wordInput").value.trim();if(!word)return;
  socket.emit("submitWord",{code:currentCode,word},res=>{
    $("wordFeedback").textContent=res?.error||`Nice! +${res.points} points`;
    $("wordFeedback").classList.toggle("bad",!!res?.error);
    if(!res?.error)$("wordInput").value="";
    if(res?.error)$("wordInput").select();
  });
};
$("startBtn").onclick=()=>socket.emit("startGame",{code:currentCode},res=>{if(res?.error)toast(res.error);});
$("againBtn").onclick=()=>socket.emit("playAgain",{code:currentCode});
$("leaveBtn").onclick=()=>{location.reload();};
socket.on("state",state=>{
  if(currentCode && state.code!==currentCode)return;
  if(!currentCode){currentCode=state.code;enterGame();}
  currentState=state;render(state);
});
function render(s){
  $("roomCode").textContent=s.code;
  $("statusPill").textContent=s.status==="lobby"?"WAITING":s.status==="playing"?"LIVE MATCH":s.status==="roundover"?"ROUND BREAK":"GAME OVER";
  $("roundLabel").textContent=`ROUND ${Math.max(1,s.round)} / ${s.maxRounds}`;
  $("timerLabel").textContent=s.status==="playing"?`${s.secondsLeft}s LEFT`:s.status==="roundover"?"ROUND COMPLETE":s.status==="finished"?"FINAL SCORES":"45s PER ROUND";
  $("timerBar").style.width=`${Math.max(0,s.secondsLeft/45*100)}%`;
  $("letters").innerHTML=(s.letters.length?s.letters:["?","?","?","?","?","?","?"]).map(l=>`<span>${escapeHtml(l)}</span>`).join("");
  $("roundMessage").textContent=s.status==="lobby"?"Waiting for the host to start the game…":s.status==="playing"?"Find as many valid words as you can!":s.status==="roundover"?"Round finished. Get ready for the next one…":s.status==="finished"?`${s.winner} wins WordRush!`:"";
  const active=s.status==="playing";
  $("wordInput").disabled=!active;$("submitBtn").disabled=!active;
  if(!active){$("wordFeedback").textContent="";$("wordFeedback").classList.remove("bad");}
  $("wordCount").textContent=s.usedWords.length;
  const words=[...s.usedWords].reverse();
  $("playedWords").innerHTML=words.length?words.map(w=>`<div class="played-word"><strong>${escapeHtml(w.word.toUpperCase())}</strong><span>${escapeHtml(w.playerName)}</span><em>+${w.points}</em></div>`).join(""):'<div class="empty-state">Words will appear here as players score.</div>';
  const sorted=[...s.players].sort((a,b)=>b.score-a.score);
  $("playersList").innerHTML=sorted.map((p,i)=>`<div class="player-row"><div class="avatar">${escapeHtml(p.name.slice(0,1).toUpperCase())}</div><div class="player-info"><div class="player-name">${escapeHtml(p.name)}${p.id===s.hostId?'<span class="host-crown"> ★ HOST</span>':''}</div><div class="player-sub">${p.connected?"● CONNECTED":"○ RECONNECTING"}${i===0&&p.score>0?" · LEADING":""}</div></div><div class="player-score">${p.score}</div></div>`).join("");
  const amHost=socket.id===s.hostId;
  if(s.status==="lobby"&&amHost&&s.players.length>=2)show("startBtn");else hide("startBtn");
  if(s.status==="finished"&&amHost)show("againBtn");else hide("againBtn");
  if(s.status==="playing"||s.status==="roundover")hide("againBtn");
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
