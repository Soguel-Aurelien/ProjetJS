import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const games = new Map(); // gameCode -> { players, words, state, assignments }

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

function createGame(code) {
  games.set(code, {
    players: [], 
    words: [],   
    state: "lobby",
    assignments: {},
    totalRounds: 1,
    currentRound:1
  });
}

function startRound(gameCode) {
  const game = games.get(gameCode);
  if (!game) return;

  const themes = [
    "Un Animal", "Un Objet", "Une Qualité", "Son Super-pouvoir",
    "Couleur préférée", "Boisson", "Une personne qu'il aime dans cette pièce",
    "Si tu étais son père tu ferais...", "Une marque de voiture",
    "Un événement historique", "Un pays", "Une série",
    "On dit que c'est un/une...", "Tu préfères manger ... que de lui parler",
    "Un défaut", "Si tu étais lui tu ferais...", "Sa personnalité préférée",
    "Une personnalité vivante qui le représente", "Une marque",
    "La chose qu'il/elle a mangé ce matin", "La personne qu'il/elle aimerait le plus tej",
    "Son cul/10", "Son futur métier", "Quand tu le vois tu es/as ...",
    "Un sport", "Comment il suce/10", "Son parti politique préféré",
    "Combien tu l'aimes/10", "Ce qu'il/elle dirait en entrant dans un bar",
    "Sa position préférée", "Soumis ou dominant", "Combien de verres avant le coma",
    "Son alcool préféré", "Millionnaire ou clodo", "Il/elle est ...",
    "Un plat", "La plus belle partie de son corps", "Pleure-t-il devant la Reine des Neiges ?",
    "Ce qui ne manque jamais dans son frigo", "Strip-tease : tu fais quoi ?",
    "Parle-t-il en dormant ?", "Son style vestimentaire est...",
    "Oublie-t-il ton anniversaire ?", "Il a le rire d'un/une ...",
    "Peux-tu compter sur lui à 3h du matin ?", "Tu lui prêterais ton/ta ...",
    "S'il devient une star du X tu ...", "Chance de finir riche ?",
    "Une chose que toi seul connais sur lui/elle", "À combien de grammes est-il ce soir ?",
    "Ce qu'il/elle aime le plus", "Son ex le/la plus frais/fraîche",
    "Sa musique préférée", "Qui tu enlèves pour le garder ?",
    "Son enfant sera ...", "Il passe plus de temps à ...",
    "S'il monte l'Everest, il meurt après combien de mètres ?"
  ];

  const players = game.players;
  const shuffled = [...players].sort(() => Math.random() - 0.5);

  game.state = "writing";
  game.words = [];
  game.assignments = {};

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

  // CREER
  socket.on("createGame", ({ name, gameCode }, cb) => {
    if (games.has(gameCode)) return cb({ error: "Code déjà utilisé" });

    createGame(gameCode);
    const game = games.get(gameCode);

    game.players.push({ id: socket.id, name, score: 0 });
    socket.join(gameCode);

    cb({ ok: true, game, playerId: socket.id });
    io.to(gameCode).emit("playersUpdate", game.players);
  });

  // JOIN
  socket.on("joinGame", ({ name, gameCode }, cb) => {
    const game = games.get(gameCode);
    if (!game) return cb({ error: "Partie introuvable" });

    game.players.push({ id: socket.id, name, score: 0 });
    socket.join(gameCode);

    cb({ ok: true, game, playerId: socket.id });
    io.to(gameCode).emit("playersUpdate", game.players);
  });

  // COMMENCE ET MOTS
socket.on("startGame", ({ gameCode, rounds }) => {
  const game = games.get(gameCode);
  if (!game) return;

  game.totalRounds = rounds;
  game.currentRound = 1;

  startRound(gameCode);
});


  // DONNER LE MOT
  socket.on("submitWord", ({ gameCode, word }, cb) => {
    const game = games.get(gameCode);
    if (!game) return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;

    game.words.push({
      word,
      authorId: socket.id,
      authorName: player.name,
      assignment: game.assignments[socket.id]
    });

    if (game.words.length === game.players.length) {
      game.state = "guessing";
      const shuffledWords = [...game.words].sort(() => Math.random() - 0.5);

      io.to(gameCode).emit("allWords", {
        words: shuffledWords, 
        round: game.currentRound,
        totalRounds: game.totalRounds
      });
      io.to(gameCode).emit("phaseChange", "guessing");
    }

    cb && cb({ ok: true });
  });

  // MET UN POINT
  socket.on("addPoint", ({ gameCode, playerId }) => {
    const game = games.get(gameCode);
    if (!game) return;

    const player = game.players.find(p => p.id === playerId);
    if (player) player.score++;

    io.to(gameCode).emit("playersUpdate", game.players);
  });

  // PROCHAIN ROUND
  socket.on("nextRound", ({gameCode}) => {
    const game = games.get(gameCode);
    if(!game) return;

    if(game.currentRound < game.totalRounds) {
      game.currentRound++;
      startRound(gameCode);
    } else {
      io.to(gameCode).emit("phaseChange", "end");
      io.to(gameCode).emit("gameOver", game.players);
    }
  });

  socket.on("disconnect", () => {});
});
