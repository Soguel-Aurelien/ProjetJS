// Assure-toi d'avoir <script src="/socket.io/socket.io.js"></script> dans ton HTML
const socket = io();

let gameCode = null;
let playerId = null;
let playersList = [];
let wordsToGuess = [];
let currentWordIndex = 0;

// ELEMENTS
const nameInput = document.getElementById("name");
const codeInput = document.getElementById("code");
const createBtn = document.getElementById("create");
const joinBtn = document.getElementById("join");
const playersDiv = document.getElementById("players");
const startBtn = document.getElementById("start");

const lobbyDiv = document.getElementById("lobby");
const writingDiv = document.getElementById("writing");
const guessingDiv = document.getElementById("guessing");
const endDiv = document.getElementById("end");

const assignmentH2 = document.getElementById("assignment");
const wordInput = document.getElementById("word");
const sendWordBtn = document.getElementById("sendWord");
const wordsList = document.getElementById("wordsList");

const guessArea = document.getElementById("guessArea");
const feedback = document.getElementById("feedback");
const nextRoundBtn = document.getElementById("nextRound");
const roundsInput = document.getElementById("rounds");
const finalScoresDiv = document.getElementById("finalScores");

function showPhase(phase) {
  lobbyDiv.style.display = phase === "lobby" ? "block" : "none";
  writingDiv.style.display = phase === "writing" ? "block" : "none";
  guessingDiv.style.display = phase === "guessing" ? "block" : "none";
  endDiv.style.display = phase === "end" ? "block" : "none";
}

// CREER
createBtn.onclick = () => {
  const name = nameInput.value.trim();
  const code = codeInput.value.trim();
  if (!name || !code) {
    alert("Entre un nom et un code de partie.");
    return;
  }

  socket.emit("createGame", { name, gameCode: code }, (res) => {
    if (!res) return alert("Erreur inconnue.");
    if (res.error) return alert(res.error);

    gameCode = code;
    playerId = res.playerId;
    startBtn.style.display = "block";
    showPhase("lobby");
  });
};

// REJOINDRE
joinBtn.onclick = () => {
  const name = nameInput.value.trim();
  const code = codeInput.value.trim();
  if (!name || !code) {
    alert("Entre un nom et un code de partie.");
    return;
  }

  socket.emit("joinGame", { name, gameCode: code }, (res) => {
    if (!res) return alert("Erreur inconnue.");
    if (res.error) return alert(res.error);

    gameCode = code;
    playerId = res.playerId;
    startBtn.style.display = "none";
    showPhase("lobby");
  });
};

// COMMENCER
startBtn.onclick = () => {
  const rounds = parseInt(roundsInput.value, 10) || 1;
  socket.emit("startGame", { gameCode, rounds });
};

// MISE A JOUR JOUEURS
socket.on("playersUpdate", (players) => {
  playersList = players;
  playersDiv.innerHTML =
    "<h3>Joueurs :</h3>" +
    players
      .map((p) => `<div>${p.name} — ${p.score ?? 0} pts</div>`)
      .join("");
});

// CHANGEMENT DE PHASE
socket.on("phaseChange", (phase) => {
  showPhase(phase);
  if (phase === "writing") {
    wordInput.value = "";
    sendWordBtn.disabled = false;
    feedback.innerHTML = "";
    wordsList.innerHTML = "";
    guessArea.innerHTML = "";
    nextRoundBtn.style.display = "none";
  }
  if (phase === "guessing") {
    feedback.innerHTML = "";
  }
});

// ASSIGNMENT
socket.on("assignment", ({ targetName, theme, round, totalRounds }) => {
  assignmentH2.textContent = `Round ${round}/${totalRounds} — Décris ${targetName} en un mot (thème : ${theme})`;
});

// ENVOI DU MOT
sendWordBtn.onclick = () => {
  const word = wordInput.value.trim();
  if (!word) return;

  socket.emit("submitWord", { gameCode, word }, (res) => {
    if (!res?.ok) {
      if (res?.error) alert(res.error);
      return;
    }
    wordInput.value = "";
    sendWordBtn.disabled = true;
  });
};

// RECEPTION DES MOTS POUR DEVINER
socket.on("allWords", ({ words, round, totalRounds }) => {
  wordsToGuess = words;
  currentWordIndex = 0;
  showPhase("guessing");
  showWordToGuess(round, totalRounds);
});

function showWordToGuess(round, totalRounds) {
  const wordObj = wordsToGuess[currentWordIndex];
  if (!wordObj) return;

  wordsList.innerHTML = `<li style="font-size:1.3rem; text-align:center;">${wordObj.word}</li>`;
  assignmentH2.textContent = `Round ${round}/${totalRounds} — Devine qui a écrit ce mot`;
  renderPlayerButtons(wordObj);
  feedback.innerHTML = "";
  nextRoundBtn.style.display =
    currentWordIndex === wordsToGuess.length - 1 ? "block" : "none";
}

function renderPlayerButtons(wordObj) {
  guessArea.innerHTML = "";

  playersList.forEach((player) => {
    const btn = document.createElement("button");
    btn.textContent = player.name;
    btn.style.margin = "6px 0";
    btn.style.width = "100%";
    btn.style.padding = "12px";
    btn.style.borderRadius = "12px";
    btn.style.background = "rgba(255,255,255,0.1)";
    btn.style.color = "white";
    btn.style.border = "1px solid rgba(255,255,255,0.2)";
    btn.style.fontSize = "1rem";
    btn.style.cursor = "pointer";
    btn.style.transition = "0.2s";

    btn.onmouseenter = () => {
      btn.style.background = "rgba(255,255,255,0.2)";
    };
    btn.onmouseleave = () => {
      btn.style.background = "rgba(255,255,255,0.1)";
    };

    btn.onclick = () => checkGuess(player, wordObj);

    guessArea.appendChild(btn);
  });
}

function checkGuess(player, wordObj) {
  if (player.id === wordObj.authorId) {
    feedback.innerHTML = "🎉 Bonne réponse !";
    feedback.style.color = "#4ef0ff";

    socket.emit("addPoint", { gameCode, playerId: player.id });

    feedback.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.3)" },
        { transform: "scale(1)" },
      ],
      { duration: 500 }
    );

    setTimeout(() => {
      feedback.innerHTML = "";
      currentWordIndex++;

      if (currentWordIndex < wordsToGuess.length) {
        showWordToGuess(
          // on garde les infos de round/totalRounds du dernier paquet
          0,
          0
        );
      } else {
        feedback.innerHTML = "🎊 Tous les mots ont été devinés !";
        nextRoundBtn.style.display = "block";
      }
    }, 800);
  } else {
    feedback.innerHTML = "❌ Mauvais joueur, réessaie !";
    feedback.style.color = "#ff6b6b";

    feedback.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-10px)" },
        { transform: "translateX(10px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 300 }
    );
  }
}

// PROCHAIN ROUND
nextRoundBtn.onclick = () => {
  nextRoundBtn.style.display = "none";
  feedback.innerHTML = "";
  socket.emit("nextRound", { gameCode });
};

// FIN DE PARTIE
socket.on("gameOver", (players) => {
  showPhase("end");
  finalScoresDiv.innerHTML =
    "<h3>Scores finaux :</h3>" +
    players
      .sort((a, b) => b.score - a.score)
      .map((p) => `<div>${p.name} — ${p.score} pts</div>`)
      .join("");
});

// ERREURS SERVEUR
socket.on("errorMessage", (msg) => {
  alert(msg);
});
