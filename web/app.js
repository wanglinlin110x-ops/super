import {
  PREPARATION_SECONDS,
  SESSION_SECONDS,
  breathingSnapshot,
  formatTime,
} from "./timeline.mjs";

const $ = (selector) => document.querySelector(selector);
const screens = ["#home-screen", "#prepare-screen", "#session-screen", "#complete-screen"];
const sessionAudio = $("#session-audio");

const state = {
  status: "idle",
  preparationStartedAt: 0,
  sessionStartedAt: 0,
  pausedElapsed: 0,
  lastPhaseIndex: -1,
  frame: 0,
  usingAudioClock: false,
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
if (!preferences.sound) $("#lock-note").textContent = "开启海浪与提示音后可息屏练习";

function showScreen(selector) {
  screens.forEach((screen) => $(screen).classList.toggle("hidden", screen !== selector));
}

function eased(value) {
  const clamped = Math.min(Math.max(value, 0), 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function vibrate(kind) {
  if (!preferences.haptics || !supportsHaptics) return;
  navigator.vibrate(kind === "completed" ? [70, 70, 110] : kind === "inhale" ? [35, 35, 35] : [70, 35, 70]);
}

function configureMediaSession() {
  if (!("mediaSession" in navigator) || !("MediaMetadata" in window)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: "10 分钟呼吸练习",
    artist: "呼吸计时器",
    album: "吸气 5 秒 · 呼气 5 秒",
  });

  const handlers = {
    play: () => state.status === "paused" && resumeSession(),
    pause: () => state.status === "running" && pauseSession(),
    stop: resetSession,
  };

  Object.entries(handlers).forEach(([action, handler]) => {
    try { navigator.mediaSession.setActionHandler(action, handler); } catch (_) { /* unsupported action */ }
  });
}

function setMediaPlaybackState(value) {
  if ("mediaSession" in navigator) navigator.mediaSession.playbackState = value;
}

function trackTime() {
  if (state.usingAudioClock && Number.isFinite(sessionAudio.currentTime)) return sessionAudio.currentTime;
  return Math.max(0, (performance.now() - state.preparationStartedAt) / 1000);
}

function sessionElapsed() {
  if (state.usingAudioClock && Number.isFinite(sessionAudio.currentTime)) {
    return Math.min(Math.max(sessionAudio.currentTime - PREPARATION_SECONDS, 0), SESSION_SECONDS);
  }
  return Math.min(Math.max((performance.now() - state.sessionStartedAt) / 1000, 0), SESSION_SECONDS);
}

function beginBackgroundTrack() {
  sessionAudio.pause();
  sessionAudio.currentTime = 0;
  sessionAudio.volume = preferences.sound ? 1 : 0;
  sessionAudio.muted = !preferences.sound;
  state.usingAudioClock = false;

  const playback = sessionAudio.play();
  if (playback) {
    playback.then(() => {
      state.usingAudioClock = true;
      setMediaPlaybackState("playing");
    }).catch((error) => {
      state.usingAudioClock = false;
      setMediaPlaybackState("none");
      $("#lock-note").textContent = "音频未能启动，本次请保持页面开启";
      console.warn("Background audio failed to start", error);
    });
  }
}

function startPreparation() {
  state.status = "preparing";
  state.preparationStartedAt = performance.now();
  state.lastPhaseIndex = -1;
  $("#prepare-count").textContent = PREPARATION_SECONDS;
  showScreen("#prepare-screen");
  beginBackgroundTrack();
  runFrame();
}

function startSession() {
  const elapsed = Math.max(0, trackTime() - PREPARATION_SECONDS);
  state.status = "running";
  state.sessionStartedAt = performance.now() - elapsed * 1000;
  state.pausedElapsed = elapsed;
  state.lastPhaseIndex = -1;
  showScreen("#session-screen");
  renderSession(elapsed);
  runFrame();
}

function runFrame() {
  cancelAnimationFrame(state.frame);
  state.frame = requestAnimationFrame(tick);
}

function tick() {
  if (state.status === "preparing") {
    const elapsed = trackTime();
    const remaining = Math.max(0, Math.ceil(PREPARATION_SECONDS - elapsed));
    $("#prepare-count").textContent = remaining || 1;
    if (elapsed >= PREPARATION_SECONDS) {
      startSession();
      return;
    }
  } else if (state.status === "running") {
    const elapsed = sessionElapsed();
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
  orb.style.setProperty("--orb-scale", String(0.72 + 0.28 * expansion));
  orb.style.setProperty("--orb-glow", String(0.58 + 0.34 * expansion));
  orb.style.setProperty("--phase-progress", String(snapshot.phaseProgress));

  if (phaseChanged && snapshot.phase !== "completed") {
    state.lastPhaseIndex = snapshot.phaseIndex;
    vibrate(snapshot.phase);
  }
}

function pauseSession() {
  if (state.status !== "running") return;
  state.pausedElapsed = sessionElapsed();
  state.status = "paused";
  cancelAnimationFrame(state.frame);
  sessionAudio.pause();
  setMediaPlaybackState("paused");
  $("#phase-title").textContent = "已暂停";
  $("#phase-time").classList.add("hidden");
  $("#paused-hint").classList.remove("hidden");
  $("#pause-button").textContent = "▶  继续练习";
}

function resumeSession() {
  if (state.status !== "paused") return;
  sessionAudio.currentTime = PREPARATION_SECONDS + state.pausedElapsed;
  sessionAudio.volume = preferences.sound ? 1 : 0;
  sessionAudio.muted = !preferences.sound;
  state.sessionStartedAt = performance.now() - state.pausedElapsed * 1000;
  state.status = "running";
  $("#phase-time").classList.remove("hidden");
  $("#paused-hint").classList.add("hidden");
  $("#pause-button").innerHTML = "Ⅱ&nbsp;&nbsp;暂停";
  renderSession(state.pausedElapsed);

  const playback = sessionAudio.play();
  if (playback) {
    playback.then(() => {
      state.usingAudioClock = true;
      setMediaPlaybackState("playing");
    }).catch(() => {
      state.usingAudioClock = false;
    });
  }
  runFrame();
}

function resetSession() {
  cancelAnimationFrame(state.frame);
  sessionAudio.pause();
  sessionAudio.currentTime = 0;
  state.status = "idle";
  state.lastPhaseIndex = -1;
  state.usingAudioClock = false;
  setMediaPlaybackState("none");
  showScreen("#home-screen");
}

function completeSession() {
  if (state.status === "completed") return;
  cancelAnimationFrame(state.frame);
  sessionAudio.pause();
  state.status = "completed";
  state.usingAudioClock = false;
  vibrate("completed");
  setMediaPlaybackState("none");
  showScreen("#complete-screen");
}

function syncAfterVisibilityChange() {
  if (sessionAudio.ended || sessionAudio.currentTime >= PREPARATION_SECONDS + SESSION_SECONDS - 0.05) {
    if (state.status !== "idle") completeSession();
    return;
  }

  if (state.status === "preparing" && sessionAudio.currentTime >= PREPARATION_SECONDS) startSession();
  if (state.status === "running") {
    renderSession(sessionElapsed());
    runFrame();
  }
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
  sessionAudio.volume = preferences.sound ? 1 : 0;
  sessionAudio.muted = !preferences.sound;
  $("#lock-note").textContent = preferences.sound
    ? "可息屏练习 · 10 分钟后自动结束"
    : "开启海浪与提示音后可息屏练习";
});

sessionAudio.addEventListener("ended", () => {
  if (state.status !== "idle") completeSession();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") syncAfterVisibilityChange();
});

configureMediaSession();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js"));
}
