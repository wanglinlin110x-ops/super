import XCTest
@testable import BreathTimer

final class BreathingTimelineTests: XCTestCase {
    func testTimelineBoundaries() {
        assertSnapshot(at: 0, phase: .inhale, index: 0, phaseProgress: 0, totalRemaining: 600)
        assertSnapshot(at: 4.999, phase: .inhale, index: 0, phaseProgress: 0.9998, totalRemaining: 596)
        assertSnapshot(at: 5, phase: .exhale, index: 1, phaseProgress: 0, totalRemaining: 595)
        assertSnapshot(at: 9.999, phase: .exhale, index: 1, phaseProgress: 0.9998, totalRemaining: 591)
        assertSnapshot(at: 10, phase: .inhale, index: 2, phaseProgress: 0, totalRemaining: 590)
        assertSnapshot(at: 599.999, phase: .exhale, index: 119, phaseProgress: 0.9998, totalRemaining: 1)
        assertSnapshot(at: 600, phase: .completed, index: 120, phaseProgress: 1, totalRemaining: 0)
    }

    func testElapsedTimeIsClampedToSessionRange() {
        XCTAssertEqual(BreathingTimeline.snapshot(at: -20), .initial)
        XCTAssertEqual(BreathingTimeline.snapshot(at: 900).elapsed, 600)
        XCTAssertEqual(BreathingTimeline.snapshot(at: 900).phase, .completed)
    }

    func testCompletedCycleCountOnlyAdvancesAfterFullCycle() {
        XCTAssertEqual(BreathingTimeline.snapshot(at: 9.999).completedCycles, 0)
        XCTAssertEqual(BreathingTimeline.snapshot(at: 10).completedCycles, 1)
        XCTAssertEqual(BreathingTimeline.snapshot(at: 600).completedCycles, 60)
    }

    private func assertSnapshot(
        at elapsed: TimeInterval,
        phase: BreathingPhase,
        index: Int,
        phaseProgress: Double,
        totalRemaining: Int,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let snapshot = BreathingTimeline.snapshot(at: elapsed)
        XCTAssertEqual(snapshot.phase, phase, file: file, line: line)
        XCTAssertEqual(snapshot.phaseIndex, index, file: file, line: line)
        XCTAssertEqual(snapshot.phaseProgress, phaseProgress, accuracy: 0.000_01, file: file, line: line)
        XCTAssertEqual(snapshot.totalRemainingSeconds, totalRemaining, file: file, line: line)
    }
}
