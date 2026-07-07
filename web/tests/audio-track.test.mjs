import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const audio = fs.readFileSync(new URL("../audio/ocean-breath-10min.wav", import.meta.url));

function findChunk(name) {
  let offset = 12;
  while (offset + 8 <= audio.length) {
    const chunkName = audio.toString("ascii", offset, offset + 4);
    const size = audio.readUInt32LE(offset + 4);
    if (chunkName === name) return { offset: offset + 8, size };
    offset += 8 + size + (size % 2);
  }
  throw new Error(`Missing WAV chunk: ${name}`);
}

const format = findChunk("fmt ");
const data = findChunk("data");
const sampleRate = audio.readUInt32LE(format.offset + 4);
const bitsPerSample = audio.readUInt16LE(format.offset + 14);

function rmsBetween(trackStartSeconds, trackEndSeconds) {
  const start = Math.round(trackStartSeconds * sampleRate);
  const end = Math.round(trackEndSeconds * sampleRate);
  let energy = 0;
  for (let index = start; index < end; index += 1) {
    const centered = audio[data.offset + index] - 128;
    energy += centered * centered;
  }
  return Math.sqrt(energy / (end - start));
}

test("锁屏音轨包含 3 秒准备和 600 秒练习", () => {
  assert.equal(sampleRate, 16000);
  assert.equal(bitsPerSample, 8);
  assert.equal(data.size / sampleRate, 603);
});

test("海浪在阶段边界持续且没有静音断点", () => {
  const windowSamples = Math.round(sampleRate * 0.1);
  let quietestRms = Infinity;

  for (let start = sampleRate * 3; start < data.size - sampleRate * 3; start += windowSamples) {
    let energy = 0;
    for (let index = 0; index < windowSamples; index += 1) {
      const centered = audio[data.offset + start + index] - 128;
      energy += centered * centered;
    }
    quietestRms = Math.min(quietestRms, Math.sqrt(energy / windowSamples));
  }

  assert.ok(quietestRms > 1.2, `quietest 100ms RMS was ${quietestRms}`);
});

test("涨潮逐渐增强，退潮逐渐减弱", () => {
  const inhaleEarly = rmsBetween(4.2, 4.8);
  const inhaleLate = rmsBetween(6.8, 7.4);
  const exhaleEarly = rmsBetween(9.2, 9.8);
  const exhaleLate = rmsBetween(11.8, 12.4);

  assert.ok(inhaleLate > inhaleEarly * 1.2, `inhale RMS ${inhaleEarly} -> ${inhaleLate}`);
  assert.ok(exhaleEarly > exhaleLate * 1.2, `exhale RMS ${exhaleEarly} -> ${exhaleLate}`);
});

test("阶段提示音清晰但不会压过海浪", () => {
  const promptRms = rmsBetween(3.14, 3.28);
  const nearbyOceanRms = rmsBetween(3.72, 3.86);

  assert.ok(promptRms > nearbyOceanRms * 1.05, `prompt RMS ${promptRms}, ocean RMS ${nearbyOceanRms}`);
  assert.ok(promptRms < nearbyOceanRms * 3, `prompt RMS ${promptRms}, ocean RMS ${nearbyOceanRms}`);
});
