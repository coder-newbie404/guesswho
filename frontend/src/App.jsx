import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "https://guesswho-0vam.onrender.com";

function App() {
  const [screen, setScreen] = useState("home");

  const [roomId, setRoomId] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");

  const [playerName, setPlayerName] = useState("");
  const [secret, setSecret] = useState("");

  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);

  const [error, setError] = useState("");

  /*
  CREATE ROOM
  */
  const handleCreateRoom = async () => {
    setError("");

    try {
      const res = await fetch(`${API_URL}/create-room`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create room");
        return;
      }

      setRoomId(data.roomId);
      setScreen("player-setup");
    } catch (err) {
      console.error(err);
      setError("Backend connection failed");
    }
  };

  /*
  JOIN ROOM
  */
  const handleJoinRoom = async () => {
    if (!joinRoomId.trim()) {
      setError("Please enter Room ID");
      return;
    }

    setError("");

    try {
      const res = await fetch(`${API_URL}/join-room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId: joinRoomId.toUpperCase(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to join room");
        return;
      }

      setRoomId(joinRoomId.toUpperCase());
      setScreen("player-setup");
    } catch (err) {
      console.error(err);
      setError("Backend connection failed");
    }
  };

  /*
  REGISTER PLAYER
  */
  const handleRegisterPlayer = async () => {
    if (!playerName.trim() || !secret.trim()) {
      setError("Please fill all fields");
      return;
    }

    setError("");

    try {
      const res = await fetch(`${API_URL}/register-player`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId,
          playerName,
          secret,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to register player");
        return;
      }

      setScreen("waiting-room");
    } catch (err) {
      console.error(err);
      setError("Backend connection failed");
    }
  };

  /*
  READY / START
  */
  const handleReady = async () => {
    setError("");

    try {
      const res = await fetch(`${API_URL}/ready`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId,
          playerName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to ready");
        return;
      }

      /*
      IMPORTANT:
      Only move if backend says started = true
      */
      if (data.started === true) {
        setScreen("chat-room");
      } else {
        setError("Waiting for other player...");
      }
    } catch (err) {
      console.error(err);
      setError("Backend connection failed");
    }
  };

  /*
  SEND QUESTION
  */
  const handleSendQuestion = async () => {
    if (!question.trim()) return;

    setError("");

    try {
      const res = await fetch(`${API_URL}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId,
          playerName,
          question,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send question");
        return;
      }

      const updatedMessages = [
        ...messages,
        {
          sender: playerName,
          text: question,
        },
        {
          sender: "Judge",
          text: data.answer || "No response",
        },
      ];

      setMessages(updatedMessages);
      setQuestion("");

      if (data.winner) {
        alert(`Winner: ${data.winner}`);
      }
    } catch (err) {
      console.error(err);
      setError("Backend connection failed");
    }
  };

  useEffect(() => {
    if (
      screen !== "waiting-room" &&
      screen !== "chat-room"
    ) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `${API_URL}/room/${roomId}`
        );

        const data = await res.json();

        if (!res.ok) return;

        /*
        If both players ready → move to chat
        */
        if (data.started && screen === "waiting-room") {
          setScreen("chat-room");
        }

        /*
        Save synced shared messages
        */
        setMessages(data.history || []);
      } catch (err) {
        console.error(err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [screen, roomId]);

  /*
  CHAT ROOM
  */
  if (screen === "chat-room") {
    return (
      <div className="container">
        <h1>GuessWho Chat</h1>
        <h2>Room ID: {roomId}</h2>

        <div className="card">
          {messages.length === 0 ? (
            <p>No questions yet</p>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className="message">
                <strong>{msg.player}</strong>: {msg.question}
                <br />
                <strong>Judge:</strong> {msg.answer}
              </div>
            ))
          )}
        </div>

        <div className="card">
          <input
            placeholder="Ask yes/no or guess exact name"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />

          <button onClick={handleSendQuestion}>
            Send Question
          </button>
        </div>

        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  /*
  WAITING ROOM
  */
  if (screen === "waiting-room") {
    return (
      <div className="container">
        <h1>Waiting Room</h1>

        <div className="card" style={{ textAlign: "center" }}>
          <p><strong>Room ID</strong></p>
          <h1 style={{ letterSpacing: "3px" }}>{roomId}</h1>
          <p>Share this code with your friend</p>
        </div>

        <div className="card">
          <p>Player: {playerName}</p>

          <button onClick={handleReady}>
            Ready / Start
          </button>

          <p style={{ marginTop: "10px", color: "#666" }}>
            Game will start when both players are ready
          </p>
        </div>

        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  /*
  PLAYER SETUP
  */
  if (screen === "player-setup") {
    return (
      <div className="container">
        <h1>Player Setup</h1>
        <h2>Room ID: {roomId}</h2>

        <div className="card">
          <input
            placeholder="Your Name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />

          <input
            placeholder="Your Secret Character"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />

          <button onClick={handleRegisterPlayer}>
            Join Game
          </button>
        </div>

        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  /*
  HOME
  */
  return (
    <div className="container">
      <h1>GuessWho Game</h1>

      <div className="card">
        <h2>Create Room</h2>

        <button onClick={handleCreateRoom}>
          Create New Room
        </button>
      </div>

      <div className="card">
        <h2>Join Room</h2>

        <input
          placeholder="Enter Room ID"
          value={joinRoomId}
          onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
        />

        <button onClick={handleJoinRoom}>
          Join Existing Room
        </button>
      </div>

      {error && (
        <p className="error">
          {error}
        </p>
      )}
    </div>
  )
};

export default App;