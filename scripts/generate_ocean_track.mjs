import fs from "node:fs";
import path from "node:path";

const sampleRate = 16000;
const preparationSeconds = 3;
const sessionSeconds = 600;
const durationSeconds = preparationSeconds + sessionSeconds;
const totalSamples = sampleRate * durationSeconds;
const outputPath = process.argv[2] || "/tmp/ocean-breath-10min.wav";
const dataBytes = totalSamples * 2;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
const output = fs.openSync(outputPath, "w");

const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + dataBytes, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(sampleRate, 24);
header.writeUInt32LE(sampleRate * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(dataBytes, 40);
fs.writeSync(output, header);

let seed = 0x51f15e;
let slowNoise = 0;
let mediumNoise = 0;
let previousSample = 0;

function randomSigned() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return (seed / 0xffffffff) * 2 - 1;
}

function smoothStep(value) {
  const clamped = Math.min(Math.max(value, 0), 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function toneEnvelope(timeSinceStart, duration) {
  if (timeSinceStart < 0 || timeSinceStart >= duration) return 0;
  const attack = Math.min(timeSinceStart / 0.09, 1);
  const release = Math.min((duration - timeSinceStart) / 0.22, 1);
  return smoothStep(attack) * smoothStep(release);
}

const chunkSamples = sampleRate * 4;
for (let chunkStart = 0; chunkStart < totalSamples; chunkStart += chunkSamples) {
  const count = Math.min(chunkSamples, totalSamples - chunkStart);
  const chunk = Buffer.allocUnsafe(count * 2);

  for (let index = 0; index < count; index += 1) {
    const sampleIndex = chunkStart + index;
    const time = sampleIndex / sampleRate;
    const sessionTime = time - preparationSeconds;
    const white = randomSigned();

    slowNoise += (white - slowNoise) * 0.0024;
    mediumNoise += (white - mediumNoise) * 0.031;
    const airyNoise = white * 0.16 + mediumNoise * 1.18 + slowNoise * 2.35;

    let oceanLevel;
    if (sessionTime < 0) {
      oceanLevel = 0.07 + 0.05 * smoothStep(time / preparationSeconds);
    } else {
      const cyclePosition = (sessionTime % 10) / 10;
      const breathSwell = 0.5 - 0.5 * Math.cos(cyclePosition * Math.PI * 2);
      const naturalDrift = 0.86 + 0.08 * Math.sin(time * 0.41) + 0.06 * Math.sin(time * 0.17 + 1.2);
      oceanLevel = (0.12 + breathSwell * 0.17) * naturalDrift;
    }

    const startFade = smoothStep(time / 1.4);
    const oceanEndFade = sessionTime > 597.5 ? 1 - smoothStep((sessionTime - 597.5) / 2.5) : 1;
    let sample = airyNoise * oceanLevel * startFade * oceanEndFade;

    if (sessionTime >= 0 && sessionTime < sessionSeconds) {
      const phaseIndex = Math.floor(sessionTime / 5);
      const phaseStart = phaseIndex * 5;
      const phaseLocalTime = sessionTime - phaseStart;
      const phaseFrequency = phaseIndex % 2 === 0 ? 523.25 : 392;
      const phaseEnvelope = toneEnvelope(phaseLocalTime, phaseIndex % 2 === 0 ? 0.44 : 0.5);
      sample += Math.sin(Math.PI * 2 * phaseFrequency * phaseLocalTime) * phaseEnvelope * 0.125;
    }

    const completionTime = sessionTime - 599.18;
    const completionEnvelope = toneEnvelope(completionTime, 0.78);
    if (completionEnvelope > 0) {
      sample += (
        Math.sin(Math.PI * 2 * 523.25 * completionTime)
        + Math.sin(Math.PI * 2 * 659.25 * completionTime)
      ) * completionEnvelope * 0.07;
    }

    sample = previousSample * 0.08 + sample * 0.92;
    previousSample = sample;
    const limited = Math.tanh(sample * 1.18) * 0.82;
    chunk.writeInt16LE(Math.round(Math.max(-1, Math.min(1, limited)) * 32767), index * 2);
  }

  fs.writeSync(output, chunk);
}

fs.closeSync(output);
console.log(outputPath);
