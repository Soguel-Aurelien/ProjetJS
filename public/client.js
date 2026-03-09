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
