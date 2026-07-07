import {
  PHASE_SECONDS,
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
const supportsHaptics = "vibrate" in navigator;
hapticsToggle.checked = preferences.haptics && supportsHaptics;
hapticsToggle.disabled = !supportsHaptics;
$("#haptics-support").classList.toggle("hidden", supportsHaptics);
soundToggle.checked = preferences.sound;

let audioContext;
let audioMaster;
let noiseBuffer;
let activeBreathSound;

function showScreen(selector) {
  screens.forEach((screen) => $(screen).classList.toggle("hidden", screen !== selector));
}

function eased(value) {
  const clamped = Math.min(Math.max(value, 0), 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function ensureAudio() {
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();

  if (!audioMaster) {
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.006;
    compressor.release.value = 0.22;

    audioMaster = audioContext.createGain();
    audioMaster.gain.value = 1.15;
    audioMaster.connect(compressor).connect(audioContext.destination);
  }

  if (!noiseBuffer) {
    noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 2, audioContext.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < channel.length; index += 1) {
      const white = Math.random() * 2 - 1;
      previous = previous * 0.94 + white * 0.06;
      channel[index] = previous * 3.2;
    }
  }

  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function stopBreathSound(fadeSeconds = 0.08) {
  if (!activeBreathSound || !audioContext) return;
  const now = audioContext.currentTime;
  const { gain, nodes } = activeBreathSound;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setTargetAtTime(0.0001, now, Math.max(fadeSeconds / 3, 0.01));
  nodes.forEach((node) => {
    try { node.stop(now + fadeSeconds); } catch (_) { /* already stopped */ }
  });
  activeBreathSound = null;
}

function playBreathSound(kind, duration = PHASE_SECONDS) {
  if (!preferences.sound || (kind !== "inhale" && kind !== "exhale")) return;
  const context = ensureAudio();
  stopBreathSound();

  const now = context.currentTime;
  const length = Math.max(duration, 0.18);
  const noise = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const tone = context.createOscillator();
  const toneGain = context.createGain();
  const gain = context.createGain();

  noise.buffer = noiseBuffer;
  noise.loop = true;
  filter.type = "bandpass";
  filter.Q.value = kind === "inhale" ? 0.48 : 0.42;
  filter.frequency.setValueAtTime(kind === "inhale" ? 850 : 2200, now);
  filter.frequency.exponentialRampToValueAtTime(kind === "inhale" ? 2400 : 600, now + length);

  // 中频三角波在手机小扬声器上比低频正弦波更清晰，同时仍保持柔和。
  tone.type = "triangle";
  tone.frequency.setValueAtTime(kind === "inhale" ? 360 : 680, now);
  tone.frequency.exponentialRampToValueAtTime(kind === "inhale" ? 720 : 340, now + length);
  toneGain.gain.value = kind === "inhale" ? 0.55 : 0.5;

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(kind === "inhale" ? 0.34 : 0.38, now + Math.min(0.55, length * 0.28));
  gain.gain.setValueAtTime(kind === "inhale" ? 0.34 : 0.38, now + Math.max(length - 0.7, 0.12));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + length);

  noise.connect(filter).connect(gain);
  tone.connect(toneGain).connect(gain);
  gain.connect(audioMaster);
  noise.start(now);
  tone.start(now);
  noise.stop(now + length + 0.05);
  tone.stop(now + length + 0.05);
  activeBreathSound = { gain, nodes: [noise, tone] };
}

function playTone(kind) {
  if (!preferences.sound) return;
  const context = ensureAudio();
  const now = context.currentTime;
  const duration = kind === "exhale" ? 0.5 : kind === "completed" ? 0.75 : 0.44;
  const frequencies = kind === "completed" ? [523.25, 659.25] : [kind === "inhale" ? 523.25 : 392];

  frequencies.forEach((frequency) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(kind === "completed" ? 0.11 : 0.16, now + duration * 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(audioMaster);
    oscillator.start(now);
    oscillator.stop(now + duration);
  });
}

function vibrate(kind) {
  if (!preferences.haptics || !supportsHaptics) return;
  navigator.vibrate(kind === "completed" ? [70, 70, 110] : kind === "inhale" ? [35, 35, 35] : [70, 35, 70]);
}

function feedback(kind) {
  playTone(kind);
  playBreathSound(kind);
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
    ensureAudio();
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
  stopBreathSound();
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
  const snapshot = breathingSnapshot(state.pausedElapsed);
  playBreathSound(snapshot.phase, PHASE_SECONDS * (1 - snapshot.phaseProgress));
  acquireWakeLock();
  runFrame();
}

function resetSession() {
  cancelAnimationFrame(state.frame);
  stopBreathSound();
  state.status = "idle";
  state.lastPhaseIndex = -1;
  releaseWakeLock();
  showScreen("#home-screen");
}

function completeSession() {
  cancelAnimationFrame(state.frame);
  stopBreathSound();
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
  if (!preferences.sound) {
    stopBreathSound();
  } else if (state.status === "running") {
    const elapsed = (performance.now() - state.sessionStartedAt) / 1000;
    const snapshot = breathingSnapshot(elapsed);
    playTone(snapshot.phase);
    playBreathSound(snapshot.phase, PHASE_SECONDS * (1 - snapshot.phaseProgress));
  } else {
    playTone("inhale");
  }
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
