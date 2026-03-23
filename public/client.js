const socket = io();

let gameCode = null;
let playerId = null;
let playersList = [];
let wordsToGuess = [];
let currentWordIndex = 0;
let currentRound = 1;
let currentTotalRounds = 1;

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
  if (lobbyDiv) lobbyDiv.style.display = phase === "lobby" ? "block" : "none";
  if (writingDiv) writingDiv.style.display = phase === "writing" ? "block" : "none";
  if (guessingDiv) guessingDiv.style.display = phase === "guessing" ? "block" : "none";
  if (endDiv) endDiv.style.display = phase === "end" ? "block" : "none";
}

// CREER
createBtn.onclick = () => {
  const name = nameInput.value.trim();
  const code = codeInput.value.trim();
  if (!name || !code) return alert("Nom + code requis");

  socket.emit("createGame", { name, gameCode: code }, (res) => {
    if (!res) return alert("Erreur inconnue");
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
  if (!name || !code) return alert("Nom + code requis");

  socket.emit("joinGame", { name, gameCode: code }, (res) => {
    if (!res) return alert("Erreur inconnue");
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
    players.map(p => `<div>${p.name} — ${p.score ?? 0} pts</div>`).join("");
});

// CHANGEMENT DE PHASE
socket.on("phaseChange", (phase) => {
  showPhase(phase);
  if (phase === "writing") {
    wordInput.value = "";
    sendWordBtn.disabled = false;
    feedback.textContent = "";
    wordsList.innerHTML = "";
    guessArea.innerHTML = "";
    nextRoundBtn.style.display = "none";
  }
});

// ASSIGNMENT
socket.on("assignment", ({ targetName, theme, round, totalRounds }) => {
  currentRound = round;
  currentTotalRounds = totalRounds;
  assignmentH2.textContent =
    `Round ${round}/${totalRounds} — Décris ${targetName} (thème : ${theme})`;
});

// ENVOI DU MOT
sendWordBtn.onclick = () => {
  const word = wordInput.value.trim();
  if (!word) return;

  socket.emit("submitWord", { gameCode, word }, (res) => {
    if (!res) return;
    if (!res.ok && res.error) return alert(res.error);

    wordInput.value = "";
    sendWordBtn.disabled = true;
  });
};

// RECEPTION DES MOTS
socket.on("allWords", ({ words, round, totalRounds }) => {
  wordsToGuess = words || [];
  currentWordIndex = 0;
  currentRound = round;
  currentTotalRounds = totalRounds;

  if (!wordsToGuess.length) return;

  showPhase("guessing");
  showWordToGuess();
});

function showWordToGuess() {
  const wordObj = wordsToGuess[currentWordIndex];
  if (!wordObj) return;

  wordsList.innerHTML = `
    <li style="font-size:1.3rem; text-align:center;">
      ${wordObj.word}
    </li>
  `;

  assignmentH2.textContent =
    `Round ${currentRound}/${currentTotalRounds} — Ce mot décrit ${wordObj.assignment.targetName} (thème : ${wordObj.assignment.theme})`;

  renderPlayerButtons(wordObj);

  nextRoundBtn.style.display =
    currentWordIndex === wordsToGuess.length - 1 ? "block" : "none";
}

function renderPlayerButtons(wordObj) {
  guessArea.innerHTML = "";

  playersList.forEach(player => {
    const btn = document.createElement("button");
    btn.textContent = player.name;
    btn.className = "guess-btn";
    btn.style.margin = "6px 0";
    btn.style.width = "100%";

    btn.onclick = () => checkGuess(player, wordObj);

    guessArea.appendChild(btn);
  });
}

function checkGuess(player, wordObj) {
  if (player.id === wordObj.authorId) {
    feedback.textContent = "🎉 Bonne réponse !";
    feedback.style.color = "#4ef0ff";

    socket.emit("addPoint", { gameCode, playerId: player.id });

    setTimeout(() => {
      feedback.textContent = "";
      currentWordIndex++;

      if (currentWordIndex < wordsToGuess.length) {
        showWordToGuess();
      } else {
        feedback.textContent = "🎊 Tous les mots ont été devinés !";
        nextRoundBtn.style.display = "block";
      }
    }, 800);

  } else {
    feedback.textContent = "❌ Mauvais joueur !";
    feedback.style.color = "#ff6b6b";
  }
}

nextRoundBtn.onclick = () => {
  feedback.textContent = "";
  nextRoundBtn.style.display = "none";
  socket.emit("nextRound", { gameCode });
};

// FIN
socket.on("gameOver", (players) => {
  showPhase("end");
  finalScoresDiv.innerHTML =
    "<h3>Scores finaux :</h3>" +
    players
      .sort((a, b) => b.score - a.score)
      .map(p => `<div>${p.name} — ${p.score} pts</div>`)
      .join("");
});

socket.on("errorMessage", (msg) => {
  alert(msg);
});
