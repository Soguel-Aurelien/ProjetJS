const socket = io();

let gameCode = null;
let playerId = null;

const nameInput = document.getElementById("name");
const codeInput = document.getElementById("code");
const createBtn = document.getElementById("create");
const joinBtn = document.getElementById("join");
const playersDiv = document.getElementById("players");
const startBtn = document.getElementById("start");

const lobbyDiv = document.getElementById("lobby");
const writingDiv = document.getElementById("writing");
const guessingDiv = document.getElementById("guessing");

const assignmentH2 = document.getElementById("assignment");
const wordInput = document.getElementById("word");
const sendWordBtn = document.getElementById("sendWord");
const wordsList = document.getElementById("wordsList");

function showPhase(phase) {
  lobbyDiv.style.display = phase === "lobby" ? "block" : "none";
  writingDiv.style.display = phase === "writing" ? "block" : "none";
  guessingDiv.style.display = phase === "guessing" ? "block" : "none";
}

createBtn.onclick = () => {
  const name = nameInput.value.trim();
  const code = codeInput.value.trim();
  if (!name || !code) return;

  socket.emit("createGame", { name, gameCode: code }, (res) => {
    if (res.error) return alert(res.error);
    gameCode = code;
    playerId = res.playerId;
    startBtn.style.display = "block";
  });
};

joinBtn.onclick = () => {
  const name = nameInput.value.trim();
  const code = codeInput.value.trim();
  if (!name || !code) return;

  socket.emit("joinGame", { name, gameCode: code }, (res) => {
    if (res.error) return alert(res.error);
    gameCode = code;
    playerId = res.playerId;
  });
};

startBtn.onclick = () => {
  socket.emit("startGame", { gameCode });
};

socket.on("playersUpdate", (players) => {
  playersDiv.innerHTML = "<h3>Joueurs :</h3>" +
    players.map(p => `<div>${p.name}</div>`).join("");
});

socket.on("phaseChange", (phase) => {
  showPhase(phase);
});

socket.on("assignment", ({ targetName, theme }) => {
  assignmentH2.textContent = `Décris ${targetName} en un mot (thème : ${theme})`;
});

sendWordBtn.onclick = () => {
  const word = wordInput.value.trim();
  if (!word) return;
  socket.emit("submitWord", { gameCode, word }, (res) => {
    if (res?.ok) {
      wordInput.value = "";
      sendWordBtn.disabled = true;
    }
  });
};

socket.on("allWords", (words) => {
  wordsList.innerHTML = "";
  words.forEach((w) => {
    const li = document.createElement("li");
    li.textContent = w.word;
    wordsList.appendChild(li);
  });
});

let currentWordIndex = 0;
let wordsToGuess = [];
let playersList = [];

socket.on("playersUpdate", (players) => {
  playersList = players;
  playersDiv.innerHTML = "<h3>Joueurs :</h3>" +
    players.map(p => `<div>${p.name}</div>`).join("");
});

socket.on("allWords", (words) => {
  wordsToGuess = words;
  currentWordIndex = 0;
  showPhase("guessing");
  showWordToGuess();
});

function showWordToGuess() {
  const wordObj = wordsToGuess[currentWordIndex];
  wordsList.innerHTML = `<li style="font-size:1.3rem; text-align:center;">${wordObj.word}</li>`;
  renderPlayerButtons(wordObj);
}

function renderPlayerButtons(wordObj) {
  const guessArea = document.getElementById("guessArea");
  guessArea.innerHTML = "";

  playersList.forEach(player => {
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

    btn.onclick = () => checkGuess(player, wordObj);

    guessArea.appendChild(btn);
  });
}

function checkGuess(player, wordObj) {
  const feedback = document.getElementById("feedback");

  if (player.id === wordObj.authorId) {
    feedback.innerHTML = "🎉 Bonne réponse !";
    feedback.style.color = "#4ef0ff";

    // Animation de victoire
    feedback.animate([
      { transform: "scale(1)" },
      { transform: "scale(1.3)" },
      { transform: "scale(1)" }
    ], { duration: 500 });

    setTimeout(() => {
      feedback.innerHTML = "";
      currentWordIndex++;

      if (currentWordIndex < wordsToGuess.length) {
        showWordToGuess();
      } else {
        feedback.innerHTML = "🎊 Tous les mots ont été devinés !";
      }
    }, 800);

  } else {
    feedback.innerHTML = "❌ Mauvais joueur, réessaie !";
    feedback.style.color = "#ff6b6b";

    // Animation d’erreur
    feedback.animate([
      { transform: "translateX(0)" },
      { transform: "translateX(-10px)" },
      { transform: "translateX(10px)" },
      { transform: "translateX(0)" }
    ], { duration: 300 });
  }
}
