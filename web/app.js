import {
  PREPARATION_SECONDS,
  SESSION_SECONDS,
  breathingSnapshot,
  formatTime,
} from "./timeline.mjs";

const $ = (selector) => document.querySelector(selector);
const screens = ["#home-screen", "#prepare-screen", "#session-screen", "#complete-screen"];

const state = {
  status: "idle",
  preparationStartedAt: 0,
  sessionStartedAt: 0,
  pausedElapsed: 0,
  lastPhaseIndex: -1,
  frame: 0,
  wakeLock: null,
};

const preferences = {
  haptics: localStorage.getItem("breath.haptics") !== "false",
  sound: localStorage.getItem("breath.sound") !== "false",
};

const hapticsToggle = $("#haptics-toggle");
const soundToggle = $("#sound-toggle");
hapticsToggle.checked = preferences.haptics;
soundToggle.checked = preferences.sound;

let audioContext;

function showScreen(selector) {
  screens.forEach((screen) => $(screen).classList.toggle("hidden", screen !== selector));
}

function eased(value) {
  const clamped = Math.min(Math.max(value, 0), 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function playTone(kind) {
  if (!preferences.sound) return;
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") audioContext.resume();

  const now = audioContext.currentTime;
  const duration = kind === "exhale" ? 0.42 : kind === "completed" ? 0.65 : 0.34;
  const frequencies = kind === "completed" ? [523.25, 659.25] : [kind === "inhale" ? 523.25 : 392];

  frequencies.forEach((frequency) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(kind === "completed" ? 0.045 : 0.075, now + duration * 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  });
}

function vibrate(kind) {
  if (!preferences.haptics || !("vibrate" in navigator)) return;
  navigator.vibrate(kind === "completed" ? [40, 80, 80] : kind === "inhale" ? 30 : 55);
}

function feedback(kind) {
  playTone(kind);
  vibrate(kind);
}

async function acquireWakeLock() {
  if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
  try {
    state.wakeLock = await navigator.wakeLock.request("screen");
  } catch (_) {
    state.wakeLock = null;
  }
}

async function releaseWakeLock() {
  if (state.wakeLock) await state.wakeLock.release().catch(() => {});
  state.wakeLock = null;
}

function startPreparation() {
  if (preferences.sound) {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
  }
  state.status = "preparing";
  state.preparationStartedAt = performance.now();
  $("#prepare-count").textContent = PREPARATION_SECONDS;
  showScreen("#prepare-screen");
  acquireWakeLock();
  runFrame();
}

function startSession() {
  state.status = "running";
  state.sessionStartedAt = performance.now();
  state.pausedElapsed = 0;
  state.lastPhaseIndex = -1;
  showScreen("#session-screen");
  renderSession(0);
  acquireWakeLock();
  runFrame();
}

function runFrame() {
  cancelAnimationFrame(state.frame);
  state.frame = requestAnimationFrame(tick);
}

function tick(now) {
  if (state.status === "preparing") {
    const elapsed = (now - state.preparationStartedAt) / 1000;
    const remaining = Math.max(0, Math.ceil(PREPARATION_SECONDS - elapsed));
    $("#prepare-count").textContent = remaining || 1;
    if (elapsed >= PREPARATION_SECONDS) {
      startSession();
      return;
    }
  } else if (state.status === "running") {
    const elapsed = (now - state.sessionStartedAt) / 1000;
    renderSession(elapsed);
    if (elapsed >= SESSION_SECONDS) {
      completeSession();
      return;
    }
  } else {
    return;
  }

  state.frame = requestAnimationFrame(tick);
}

function renderSession(elapsed) {
  const snapshot = breathingSnapshot(elapsed);
  const phaseChanged = snapshot.phaseIndex !== state.lastPhaseIndex;

  $("#total-time").textContent = formatTime(snapshot.totalRemainingSeconds);
  $("#phase-title").textContent = snapshot.phase === "inhale" ? "吸气" : "呼气";
  $("#phase-time").textContent = snapshot.phaseRemainingSeconds;

  const expansion = snapshot.phase === "inhale" ? eased(snapshot.phaseProgress) : 1 - eased(snapshot.phaseProgress);
  const orb = $("#session-orb");
  orb.style.setProperty("--orb-scale", String(0.55 + 0.45 * expansion));
  orb.style.setProperty("--orb-glow", String(0.65 + 0.35 * expansion));
  orb.style.setProperty("--phase-progress", String(snapshot.phaseProgress));

  if (phaseChanged) {
    state.lastPhaseIndex = snapshot.phaseIndex;
    feedback(snapshot.phase);
  }
}

function pauseSession() {
  if (state.status !== "running") return;
  state.pausedElapsed = (performance.now() - state.sessionStartedAt) / 1000;
  state.status = "paused";
  cancelAnimationFrame(state.frame);
  $("#phase-title").textContent = "已暂停";
  $("#phase-time").classList.add("hidden");
  $("#paused-hint").classList.remove("hidden");
  $("#pause-button").textContent = "▶  继续练习";
  releaseWakeLock();
}

function resumeSession() {
  if (state.status !== "paused") return;
  state.sessionStartedAt = performance.now() - state.pausedElapsed * 1000;
  state.status = "running";
  $("#phase-time").classList.remove("hidden");
  $("#paused-hint").classList.add("hidden");
  $("#pause-button").innerHTML = "Ⅱ&nbsp;&nbsp;暂停";
  renderSession(state.pausedElapsed);
  acquireWakeLock();
  runFrame();
}

function resetSession() {
  cancelAnimationFrame(state.frame);
  state.status = "idle";
  state.lastPhaseIndex = -1;
  releaseWakeLock();
  showScreen("#home-screen");
}

function completeSession() {
  cancelAnimationFrame(state.frame);
  state.status = "completed";
  feedback("completed");
  releaseWakeLock();
  showScreen("#complete-screen");
}

$("#start-button").addEventListener("click", startPreparation);
$("#cancel-prepare-button").addEventListener("click", resetSession);
$("#done-button").addEventListener("click", resetSession);

$("#pause-button").addEventListener("click", () => {
  state.status === "paused" ? resumeSession() : pauseSession();
});

$("#exit-button").addEventListener("click", () => {
  if (state.status === "running") pauseSession();
  $("#exit-dialog").showModal();
});

$("#exit-dialog").addEventListener("close", (event) => {
  if (event.target.returnValue === "exit") {
    resetSession();
  } else if (event.target.returnValue === "continue" && state.status === "paused") {
    resumeSession();
  }
});

hapticsToggle.addEventListener("change", () => {
  preferences.haptics = hapticsToggle.checked;
  localStorage.setItem("breath.haptics", String(preferences.haptics));
  if (preferences.haptics) vibrate("inhale");
});

soundToggle.addEventListener("change", () => {
  preferences.sound = soundToggle.checked;
  localStorage.setItem("breath.sound", String(preferences.sound));
  if (preferences.sound) playTone("inhale");
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && (state.status === "running" || state.status === "preparing")) {
    if (state.status === "preparing") resetSession();
    else pauseSession();
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js"));
}
