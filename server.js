import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const games = new Map(); // gameCode -> { players, words, assignments, state, totalRounds, currentRound }

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port " + PORT));

function createGame(code) {
  games.set(code, {
    players: [],
    words: [],
    assignments: {},
    state: "lobby",
    totalRounds: 1,
    currentRound: 1
  });
}

function startRound(gameCode) {
  const game = games.get(gameCode);
  if (!game) return;

  const themes = [
    "Un Animal", "Un Objet", "Une Qualité", "Son Super-pouvoir",
    "Couleur préférée", "Boisson", "Une personne qu'il aime dans cette pièce",
    "Un défaut", "Une marque", "Un pays", "Une série", "Un plat",
    "Son futur métier", "Un sport", "Sa musique préférée"
  ];

  const players = game.players;
  if (players.length < 2) {
    io.to(gameCode).emit("errorMessage", "Il faut au moins 2 joueurs pour commencer.");
    io.to(gameCode).emit("phaseChange", "lobby");
    return;
  }

  const shuffled = [...players].sort(() => Math.random() - 0.5);

  game.words = [];
  game.assignments = {};
  game.state = "writing";

  players.forEach((p, i) => {
    const target = shuffled[(i + 1) % players.length];
    const theme = themes[Math.floor(Math.random() * themes.length)];

    game.assignments[p.id] = { targetName: target.name, theme };

    io.to(p.id).emit("assignment", {
      targetName: target.name,
      theme,
      round: game.currentRound,
      totalRounds: game.totalRounds
    });
  });

  io.to(gameCode).emit("phaseChange", "writing");
}

io.on("connection", (socket) => {

  socket.on("createGame", ({ name, gameCode }, cb) => {
    if (!name || !gameCode) return cb?.({ error: "Nom et code requis" });

    if (games.has(gameCode)) return cb?.({ error: "Code déjà utilisé" });

    createGame(gameCode);
    const game = games.get(gameCode);

    game.players.push({ id: socket.id, name, score: 0 });
    socket.join(gameCode);

    cb?.({ ok: true, playerId: socket.id });
    io.to(gameCode).emit("playersUpdate", game.players);
  });

  socket.on("joinGame", ({ name, gameCode }, cb) => {
    if (!name || !gameCode) return cb?.({ error: "Nom et code requis" });

    const game = games.get(gameCode);
    if (!game) return cb?.({ error: "Partie introuvable" });

    game.players.push({ id: socket.id, name, score: 0 });
    socket.join(gameCode);

    cb?.({ ok: true, playerId: socket.id });
    io.to(gameCode).emit("playersUpdate", game.players);
  });

  socket.on("startGame", ({ gameCode, rounds }) => {
    const game = games.get(gameCode);
    if (!game) return;

    const parsedRounds = parseInt(rounds, 10);
    game.totalRounds = Number.isNaN(parsedRounds) ? 1 : Math.max(1, parsedRounds);
    game.currentRound = 1;

    startRound(gameCode);
  });

  socket.on("submitWord", ({ gameCode, word }, cb) => {
    const game = games.get(gameCode);
    if (!game) return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;

    const cleanWord = (word || "").trim();
    if (!cleanWord) return cb?.({ ok: false, error: "Mot vide" });

    game.words.push({
      word: cleanWord,
      authorId: socket.id,
      assignment: game.assignments[socket.id]
    });

    if (game.words.length === game.players.length) {
      const shuffledWords = [...game.words].sort(() => Math.random() - 0.5);

      io.to(gameCode).emit("allWords", {
        words: shuffledWords,
        round: game.currentRound,
        totalRounds: game.totalRounds
      });

      io.to(gameCode).emit("phaseChange", "guessing");
    }

    cb?.({ ok: true });
  });

  socket.on("addPoint", ({ gameCode, playerId }) => {
    const game = games.get(gameCode);
    if (!game) return;

    const player = game.players.find(p => p.id === playerId);
    if (player) player.score++;

    io.to(gameCode).emit("playersUpdate", game.players);
  });

  socket.on("nextRound", ({ gameCode }) => {
    const game = games.get(gameCode);
    if (!game) return;

    if (game.currentRound < game.totalRounds) {
      game.currentRound++;
      startRound(gameCode);
    } else {
      game.state = "end";
      io.to(gameCode).emit("phaseChange", "end");
      io.to(gameCode).emit("gameOver", game.players);
    }
  });

  socket.on("disconnect", () => {
    for (const [code, game] of games.entries()) {
      const before = game.players.length;
      game.players = game.players.filter(p => p.id !== socket.id);

      if (game.players.length === 0) {
        games.delete(code);
      } else if (before !== game.players.length) {
        io.to(code).emit("playersUpdate", game.players);
      }
    }
  });
});
