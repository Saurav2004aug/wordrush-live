# WordRush Live

A real-time multiplayer word battle for 2–8 players. Players create a room, share the five-character room code, and submit valid words from the seven displayed letters. Each unique valid word scores one point per letter. The match runs for five 45-second rounds.

## Run locally

Requires Node.js 18 or newer.

```bash
npm install
npm start
```

Open http://localhost:3000. To test multiplayer on one computer, open two separate browser windows. To test from separate devices on the same Wi-Fi, use your computer's LAN IP address and allow incoming connections to port 3000.

## Deploy publicly

Deploy this as a **Node.js web service** on a host that supports long-lived WebSocket connections (for example, Render or Railway). Upload the project folder or connect its Git repository, set the build command to `npm install`, and the start command to `npm start`. No environment variables are required; the host provides `PORT`.

After deployment, open the public HTTPS URL in two separate devices/browsers. Create a room on one, join using the room code on the other, start the game, and confirm that round state, words, and scores update on both screens.

## Important implementation note

The game state and scoring are handled on the server using Socket.IO, so connected clients receive the same room state. The included word list is intentionally compact for this starter project; expand it with a vetted dictionary before a larger public release. Rooms are in-memory, so a server restart clears active rooms.
