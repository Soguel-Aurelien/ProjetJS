import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const games = new Map(); // gameCode -> { players, words, state }

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});


function createGame(code) {
  games.set(code, {
    players: [], // {id, name}
    words: [],   // {word, authorId}
    state: "lobby"
  });
}

io.on("connection", (socket) => {
  socket.on("createGame", ({ name, gameCode }, cb) => {
    if (games.has(gameCode)) return cb({ error: "Code déjà utilisé" });
    createGame(gameCode);
    const game = games.get(gameCode);
    game.players.push({ id: socket.id, name });
    socket.join(gameCode);
    cb({ ok: true, game, playerId: socket.id });
    io.to(gameCode).emit("playersUpdate", game.players);
  });

  socket.on("joinGame", ({ name, gameCode }, cb) => {
    const game = games.get(gameCode);
    if (!game) return cb({ error: "Partie introuvable" });
    game.players.push({ id: socket.id, name });
    socket.join(gameCode);
    cb({ ok: true, game, playerId: socket.id });
    io.to(gameCode).emit("playersUpdate", game.players);
  });

  socket.on("startGame", ({ gameCode }) => {
    const game = games.get(gameCode);
    if (!game) return;
    const themes = ["Un Animal", " Un Objet", "Une Qualité", "Son Super-pouvoir", "Couleur préféré", "Boisson",
        "Une personne qu'il aime dans cette piece","Si tu étais son père tu ferais...","Une marque de voiture",
        "Un evenement historique","Un pays","Une série","On dit que c'est un/une...","Tu prefères manger ... que de lui parlé",
        "Un défaut","Si tu étais lui tu ferais...","Sa personalité préférée","Une personalité vivante qui le représente","Une marque",
        "La chose qu'il/elle a mangé ce matin","La personne qu'il/elle aimerait le plus tej de la piece","Son cul/10","Son futur métier",
        "Quand tu le vois tu es/as ...","Un sport","Comment il suce/10","Son partie politique préféré","Combien tu l'aimes/10",
        "Qu'est ce qu'il/elle dirait en premier quand il/elle entre dans un bar","Sa postion préférée","Soumis ou Soumet",
        "Combien de verres avant le comas","Son alcool préféré","Deviendra Millionaire ou Clodo","Il/Elle est ...","Un plat",
        "La plus belle partie de son corp","Pleure il/elle devant la reine des neiges","Qu'est ce qui ne manquera jamais dans son frigo",
        "Si il/elle est en train de faire un strip-tease dans un bar que fais-tu?","Est ce qu'il/elle parle pendant qu'il/elle dort",
        "Son style vestimentaire est...","Est ce qu'il/elle oublie ton anniversaire","Il a le rire d'un/une ...","Pourrais tu compter sur lui à 3h du matin",
        "Tu lui preterais ton/ta ...","Si il/elle devient une star du x tu ...","Y a t'il une chance qu'il/elle finisse riche",
        "Une chose que tu es le seul à connaitre sur lui/elle","A combien de gramme est il/elle ce soir","Ce qu'il/elle aime le plus",
        "Son ex le/la plus frais/fraiche","Sa musique préférée","Qui est ce que tu enleves pour le/la garder","Son enfant sera ...",
        "Il/elle passe plus de temps à ... qu'un paresseux passe de temps à dormir","Si il/elle monte l'everest, après combien de mètre il/elle meurt",
        ""];
    const players = game.players;
    const shuffled = [...players].sort(() => Math.random() - 0.5);

    game.state = "writing";
    game.words = [];

    players.forEach((p, i) => {
      const target = shuffled[(i + 1) % players.length];
      const theme = themes[Math.floor(Math.random() * themes.length)];
      io.to(p.id).emit("assignment", {
        targetName: target.name,
        theme
      });
    });

    io.to(gameCode).emit("phaseChange", "writing");
  });

  socket.on("submitWord", ({ gameCode, word }, cb) => {
    const game = games.get(gameCode);
    if (!game) return;
    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;

    game.words.push({
      word,
      authorId: socket.id,
      authorName: player.name
    });

    if (game.words.length === game.players.length) {
      game.state = "guessing";
      const shuffledWords = [...game.words].sort(() => Math.random() - 0.5);
      io.to(gameCode).emit("allWords", shuffledWords);
      io.to(gameCode).emit("phaseChange", "guessing");
    }

    cb && cb({ ok: true });
  });

  socket.on("disconnect", () => {
    // v1 : on ignore pour l’instant
  });
});


