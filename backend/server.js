require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: "https://coder-newbie404.github.io"
}));
app.use(express.json());

const rooms = {};

function generateRoomId() {
  return Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();
}

/*
Mock AI answer
Random Yes / No
*/
async function askAI(secret, question) {
  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "GuessWho Game"
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b:free", // or any free model
          messages: [
            {
              role: "system",
              content: `
You are a strict yes/no judge for a Guess Who game.

Rules:
- Only answer: YES or NO or UNKNOWN
- Do NOT explain
- Do NOT add extra words
- Be consistent with the secret identity
              `,
            },
            {
              role: "user",
              content: `
Secret: ${secret}
Question: ${question}
              `,
            },
          ],
        }),
      }
    );

    const data = await response.json();

    let text =
      data.choices?.[0]?.message?.content?.trim() || "UNKNOWN";

    text = text.toUpperCase();

    if (text.includes("YES")) return "Yes";
    if (text.includes("NO")) return "No";

    return "Unknown";
  } catch (err) {
    console.error("AI error:", err);
    return "Unknown";
  }
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
/*
AI answer
*/
app.post("/ask", async (req, res) => {
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

  const normalizedQuestion = question.trim().toLowerCase();

  /*
  WIN CONDITION
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
  AI ANSWER
  */
  const answer = await askAI(
    opponent.secret,
    question
  );

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