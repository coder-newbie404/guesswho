const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

/*
Simple in-memory rooms
PoC only
*/
const rooms = {};

/*
Generate Room ID
Example: A1B2C3
*/
function generateRoomId() {
  return Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();
}

/*
CREATE ROOM
POST /create-room
*/
app.post("/create-room", (req, res) => {
  let roomId = generateRoomId();

  while (rooms[roomId]) {
    roomId = generateRoomId();
  }

  rooms[roomId] = {
    roomId,
    started: false,
    winner: null,
    turn: 1,
    currentPlayer: null,
    players: [],
    history: [],
  };

  return res.json({
    roomId,
    message: "Room created",
  });
});

/*
JOIN ROOM
POST /join-room
body:
{
  "roomId": "ABC123"
}
*/
app.post("/join-room", (req, res) => {
  const { roomId } = req.body;

  if (!roomId) {
    return res.status(400).json({
      error: "roomId is required",
    });
  }

  const room = rooms[roomId];

  if (!room) {
    return res.status(404).json({
      error: "Room not found",
    });
  }

  if (room.players.length >= 2) {
    return res.status(400).json({
      error: "Room is full",
    });
  }

  return res.json({
    message: "Room joined",
    roomId,
  });
});

/*
REGISTER PLAYER
POST /register-player
body:
{
  "roomId": "ABC123",
  "playerName": "Alice",
  "secret": "Einstein"
}
*/
app.post("/register-player", (req, res) => {
  const { roomId, playerName, secret } = req.body;

  if (!roomId || !playerName || !secret) {
    return res.status(400).json({
      error: "roomId, playerName and secret are required",
    });
  }

  const room = rooms[roomId];

  if (!room) {
    return res.status(404).json({
      error: "Room not found",
    });
  }

  if (room.players.length >= 2) {
    return res.status(400).json({
      error: "Room is full",
    });
  }

  const exists = room.players.find(
    (p) =>
      p.name.toLowerCase() === playerName.toLowerCase()
  );

  if (exists) {
    return res.status(400).json({
      error: "Player already exists",
    });
  }

  room.players.push({
    name: playerName,
    secret: secret.toLowerCase(),
    ready: false,
  });

  return res.json({
    message: "Player registered",
    room,
  });
});

/*
READY / START
POST /ready
body:
{
  "roomId": "ABC123",
  "playerName": "Alice"
}
*/
app.post("/ready", (req, res) => {
  const { roomId, playerName } = req.body;

  if (!roomId || !playerName) {
    return res.status(400).json({
      error: "roomId and playerName are required",
    });
  }

  const room = rooms[roomId];

  if (!room) {
    return res.status(404).json({
      error: "Room not found",
    });
  }

  const player = room.players.find(
    (p) => p.name === playerName
  );

  if (!player) {
    return res.status(404).json({
      error: "Player not found",
    });
  }

  player.ready = true;

  const allReady =
    room.players.length === 2 &&
    room.players.every((p) => p.ready);

  if (allReady) {
    room.started = true;
    room.currentPlayer = room.players[0].name;
  }

  return res.json({
    message: "Ready updated",
    started: room.started,
    room,
  });
});

/*
ASK QUESTION
POST /ask
body:
{
  "roomId": "ABC123",
  "playerName": "Alice",
  "question": "Is your person alive?"
}
*/
app.post("/ask", (req, res) => {
  const { roomId, playerName, question } = req.body;

  if (!roomId || !playerName || !question) {
    return res.status(400).json({
      error: "roomId, playerName and question are required",
    });
  }

  const room = rooms[roomId];

  if (!room) {
    return res.status(404).json({
      error: "Room not found",
    });
  }

  if (!room.started) {
    return res.status(400).json({
      error: "Game has not started yet",
    });
  }

  if (room.winner) {
    return res.json({
      message: "Game already finished",
      winner: room.winner,
      room,
    });
  }

  if (room.currentPlayer !== playerName) {
    return res.status(400).json({
      error: "Not your turn",
    });
  }

  const opponent = room.players.find(
    (p) => p.name !== playerName
  );

  if (!opponent) {
    return res.status(400).json({
      error: "Opponent not found",
    });
  }

  const normalizedQuestion = question
    .trim()
    .toLowerCase();

  /*
  Win condition:
  exact guess of opponent secret
  */
  if (normalizedQuestion === opponent.secret) {
    room.winner = playerName;

    room.history.push({
      player: playerName,
      question,
      answer: "Correct! You win!",
      turn: room.turn,
    });

    return res.json({
      answer: "Correct! You win!",
      winner: playerName,
      room,
    });
  }

  /*
  Mock AI answer
  Random Yes / No
  */
  const answer =
    Math.random() > 0.5 ? "Yes" : "No";

  room.history.push({
    player: playerName,
    question,
    answer,
    turn: room.turn,
  });

  room.turn += 1;
  room.currentPlayer = opponent.name;

  return res.json({
    answer,
    winner: null,
    nextTurn: room.currentPlayer,
    room,
  });
});

/*
GET ROOM STATE
Optional helper endpoint
GET /room/:roomId
*/
app.get("/room/:roomId", (req, res) => {
  const { roomId } = req.params;

  const room = rooms[roomId];

  if (!room) {
    return res.status(404).json({
      error: "Room not found",
    });
  }

  return res.json(room);
});

/*
HEALTH CHECK
*/
app.get("/", (req, res) => {
  res.send("GuessWho backend running");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});