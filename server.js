const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, app: 'WordRush Live' }));

const rooms = new Map();
const WORDS = new Set(`
apple angle angry apart arena arise arrow audio avoid awake badge baker basic beach begin below bench birth black blame blank blast blend blind block blood board brain brave bread break brick bride brief bring broad brown brush build burst cable calm camera camp candy carry catch cause chain chair charm chart chase cheap check chess chest chief child chill choice choose chord claim class clean clear clerk click clock close cloud coach coast color comic coral could count court cover craft crash cream crime crisp cross crowd crown curve cycle dance dated dealt death debut delay depth devil diary dirty doubt dozen draft drama dream dress drink drive earth eight elite empty enemy enjoy enter entry equal error event every exact exist extra faith false fancy fault favor feast fence fetch fever fiber field fifth fifty fight final first flame flash fleet flesh float floor flour focus force frame frank fresh front fruit funny ghost giant given glass globe glory glove going grace grade grain grand grant grass great green group guard guess guest guide habit happy heart heavy hello hence hobby honey honor horse hotel house human humor ideal image imply index inner input issue ivory jelly joint judge juice knife knock known label labor laser later laugh layer learn least leave legal level light limit linen liver local logic loose lucky lunch magic major maker march match maybe medal media mercy merge merit metal might minor model money month moral motor mount mouse mouth movie music naive never night noble noise north novel nurse ocean occur offer often order other outer owner paint panel panic paper party peace phase phone photo piano piece pilot pitch place plain plane plant plate point power press price pride prime print prior prize proof proud queen quick quiet quite quote radio raise range rapid ratio reach react ready realm rebel refer relax reply right rival river robot rough round route royal ruler rural scale scare scene scope score sense serve seven shade shake shall shape share sharp sheep sheet shelf shell shift shine shirt shock shoot short shown sight since skill sleep slice slide slight smart smell smile smoke solid solve sorry sound south space speak speed spend spice spine split sport spray squad staff stage stake stand start state steam steel stick still stock stone store storm story strip stuck study stuff style sugar suite super sweet table taken taste teach team tell tense thank theme there these thick thing think third those three throw tight timer title today token topic total touch tough tower track trade train treat trend trial tribe trick trust truth twice union unity until upper upset urban usage usual valid value video visit vital voice waste watch water wheel where which while white whole woman women world worry worth write wrong yield young youth zebra zero zone`.split(/\s+/));

function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from({length: 5}, () => alphabet[crypto.randomInt(alphabet.length)]).join(''); }
  while (rooms.has(code));
  return code;
}
function pickLetters() {
  const vowels = 'AEIOU';
  const consonants = 'BCDFGHJKLMNPRSTVW';
  return [
    ...Array.from({length: 3}, () => vowels[crypto.randomInt(vowels.length)]),
    ...Array.from({length: 4}, () => consonants[crypto.randomInt(consonants.length)])
  ].sort(() => Math.random() - 0.5);
}
function publicState(room) {
  return {
    code: room.code, hostId: room.hostId, status: room.status,
    players: [...room.players.values()].map(p => ({id:p.id, name:p.name, score:p.score, connected:p.connected})),
    round: room.round, maxRounds: room.maxRounds, secondsLeft: room.secondsLeft,
    letters: room.letters, usedWords: room.usedWords, lastEvent: room.lastEvent, winner: room.winner
  };
}
function emitRoom(room) { io.to(room.code).emit('state', publicState(room)); }
function validWord(word, letters) {
  if (!/^[a-z]{3,7}$/.test(word) || !WORDS.has(word)) return false;
  const available = {};
  for (const letter of letters.join('').toLowerCase()) available[letter] = (available[letter] || 0) + 1;
  for (const letter of word) {
    if (!available[letter]) return false;
    available[letter]--;
  }
  return true;
}
function startTimer(room) {
  if (room.timer) clearInterval(room.timer);
  room.timer = setInterval(() => {
    if (!rooms.has(room.code) || room.status !== 'playing') { clearInterval(room.timer); return; }
    room.secondsLeft -= 1;
    if (room.secondsLeft <= 0) finishRound(room);
    else emitRoom(room);
  }, 1000);
}
function finishRound(room) {
  if (room.timer) clearInterval(room.timer);
  room.status = 'roundover'; room.secondsLeft = 0;
  room.lastEvent = `Round ${room.round} complete!`; emitRoom(room);
  setTimeout(() => {
    if (!rooms.has(room.code) || room.status !== 'roundover') return;
    if (room.round >= room.maxRounds) {
      room.status = 'finished';
      const sorted = [...room.players.values()].sort((a,b) => b.score-a.score);
      room.winner = sorted.length ? sorted[0].name : 'Nobody';
      room.lastEvent = `${room.winner} wins WordRush!`; emitRoom(room); return;
    }
    room.round++; room.letters = pickLetters(); room.usedWords = [];
    room.secondsLeft = 45; room.status = 'playing'; room.lastEvent = `Round ${room.round} — find words!`;
    startTimer(room); emitRoom(room);
  }, 3500);
}

io.on('connection', socket => {
  socket.on('createRoom', ({name} = {}, cb = () => {}) => {
    name = String(name || '').trim().slice(0,18);
    if (!name) return cb({error:'Enter a player name first.'});
    const code = randomCode();
    const room = {code, hostId:socket.id, players:new Map([[socket.id,{id:socket.id,name,score:0,connected:true}]]),
      status:'lobby', round:0, maxRounds:5, secondsLeft:45, letters:[], usedWords:[], lastEvent:'Waiting for players to join…', timer:null, winner:null};
    rooms.set(code,room); socket.join(code); cb({code}); emitRoom(room);
  });
  socket.on('joinRoom', ({code,name} = {}, cb = () => {}) => {
    code = String(code || '').trim().toUpperCase(); name = String(name || '').trim().slice(0,18);
    const room = rooms.get(code);
    if (!name) return cb({error:'Enter a player name first.'});
    if (!room) return cb({error:'Room not found. Check the code.'});
    if (room.status !== 'lobby') return cb({error:'This game has already started.'});
    if (room.players.size >= 8) return cb({error:'This room is full (8 players max).'});
    if ([...room.players.values()].some(p => p.name.toLowerCase() === name.toLowerCase())) return cb({error:'That name is already taken in this room.'});
    room.players.set(socket.id,{id:socket.id,name,score:0,connected:true}); socket.join(code); cb({code});
    room.lastEvent = `${name} joined the room.`; emitRoom(room);
  });
  socket.on('startGame', ({code} = {}, cb = () => {}) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room) return cb({error:'Room not found.'});
    if (socket.id !== room.hostId) return cb({error:'Only the host can start the game.'});
    if (room.players.size < 2) return cb({error:'You need at least 2 players to start.'});
    if (room.status !== 'lobby') return cb({error:'Game has already started.'});
    room.status='playing'; room.round=1; room.letters=pickLetters(); room.usedWords=[]; room.secondsLeft=45;
    room.lastEvent='Round 1 — find words!'; startTimer(room); emitRoom(room); cb({ok:true});
  });
  socket.on('submitWord', ({code,word} = {}, cb = () => {}) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.status !== 'playing') return cb({error:'This round is not accepting words.'});
    const player = room.players.get(socket.id);
    if (!player) return cb({error:'You are not in this room.'});
    word = String(word || '').trim().toLowerCase();
    if (!validWord(word,room.letters)) return cb({error:'Not a valid dictionary word for these letters. Try another word.'});
    if (room.usedWords.some(w => w.word === word)) return cb({error:'That word has already been played.'});
    const points = word.length;
    room.usedWords.push({word,playerId:socket.id,playerName:player.name,points}); player.score += points;
    room.lastEvent = `${player.name} scored ${points} points!`; emitRoom(room); cb({ok:true,points});
  });
  socket.on('playAgain', ({code} = {}) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.status !== 'finished' || socket.id !== room.hostId) return;
    room.players.forEach(p => p.score=0); room.round=0; room.status='lobby'; room.winner=null; room.usedWords=[]; room.letters=[];
    room.lastEvent='New game ready. Invite everyone back!'; emitRoom(room);
  });
  socket.on('disconnect', () => {
    for (const room of rooms.values()) {
      const player = room.players.get(socket.id); if (!player) continue;
      player.connected=false; room.lastEvent=`${player.name} disconnected.`;
      if (room.hostId === socket.id) { const next=[...room.players.values()].find(p=>p.connected); if(next) room.hostId=next.id; }
      emitRoom(room);
      setTimeout(() => {
        if (!rooms.has(room.code)) return;
        const still=room.players.get(socket.id);
        if (still && !still.connected) {
          room.players.delete(socket.id);
          if (!room.players.size) { if(room.timer) clearInterval(room.timer); rooms.delete(room.code); }
          else emitRoom(room);
        }
      },30000);
    }
  });
});
server.listen(PORT, () => console.log(`WordRush Live running on port ${PORT}`));
