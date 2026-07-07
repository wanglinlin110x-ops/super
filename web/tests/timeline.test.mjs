import test from "node:test";
import assert from "node:assert/strict";
import { breathingSnapshot, formatTime } from "../timeline.mjs";

test("阶段边界准确", () => {
  assert.equal(breathingSnapshot(0).phase, "inhale");
  assert.equal(breathingSnapshot(4.999).phase, "inhale");
  assert.equal(breathingSnapshot(5).phase, "exhale");
  assert.equal(breathingSnapshot(9.999).phase, "exhale");
  assert.equal(breathingSnapshot(10).phase, "inhale");
});

test("600 秒完成 60 个周期", () => {
  const before = breathingSnapshot(599.999);
  assert.equal(before.phase, "exhale");
  assert.equal(before.totalRemainingSeconds, 1);

  const completed = breathingSnapshot(600);
  assert.equal(completed.phase, "completed");
  assert.equal(completed.completedCycles, 60);
  assert.equal(completed.totalRemainingSeconds, 0);
});

test("时间显示固定为两位", () => {
  assert.equal(formatTime(600), "10:00");
  assert.equal(formatTime(5), "00:05");
});
