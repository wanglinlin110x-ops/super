export const PREPARATION_SECONDS = 3;
export const PHASE_SECONDS = 5;
export const SESSION_SECONDS = 600;
export const TOTAL_CYCLES = 60;

export function breathingSnapshot(rawElapsedSeconds) {
  const elapsed = Math.min(Math.max(rawElapsedSeconds, 0), SESSION_SECONDS);

  if (elapsed >= SESSION_SECONDS) {
    return {
      elapsed: SESSION_SECONDS,
      phase: "completed",
      phaseIndex: 120,
      phaseProgress: 1,
      phaseRemainingSeconds: 0,
      totalRemainingSeconds: 0,
      completedCycles: TOTAL_CYCLES,
    };
  }

  const phaseIndex = Math.floor(elapsed / PHASE_SECONDS);
  const phaseElapsed = elapsed - phaseIndex * PHASE_SECONDS;

  return {
    elapsed,
    phase: phaseIndex % 2 === 0 ? "inhale" : "exhale",
    phaseIndex,
    phaseProgress: Math.min(Math.max(phaseElapsed / PHASE_SECONDS, 0), 1),
    phaseRemainingSeconds: Math.max(1, Math.ceil(PHASE_SECONDS - phaseElapsed)),
    totalRemainingSeconds: Math.max(1, Math.ceil(SESSION_SECONDS - elapsed)),
    completedCycles: Math.min(Math.floor(elapsed / 10), TOTAL_CYCLES),
  };
}

export function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}
