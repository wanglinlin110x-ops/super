import XCTest
@testable import BreathTimer

@MainActor
final class BreathingSessionTests: XCTestCase {
    func testPreparationStartsBreathingAtThreeSeconds() {
        let fixture = Fixture()
        fixture.session.start()

        XCTAssertEqual(fixture.session.status, .preparing)
        XCTAssertEqual(fixture.idleTimerChanges, [true])

        fixture.clock.time = 3
        fixture.session.update()

        XCTAssertEqual(fixture.session.status, .inhaling)
        XCTAssertEqual(fixture.session.snapshot.elapsed, 0, accuracy: 0.000_01)
        XCTAssertEqual(fixture.feedback.events.map(\.event), [.inhale])
    }

    func testPauseTimeDoesNotCountAndResumeKeepsPosition() {
        let fixture = Fixture()
        fixture.session.start()
        fixture.clock.time = 7.5
        fixture.session.update()
        XCTAssertEqual(fixture.session.snapshot.elapsed, 4.5, accuracy: 0.000_01)

        fixture.session.pause()
        fixture.clock.time = 107.5
        fixture.session.update()
        XCTAssertEqual(fixture.session.snapshot.elapsed, 4.5, accuracy: 0.000_01)
        XCTAssertEqual(fixture.session.status, .paused)

        fixture.session.resume()
        fixture.clock.time = 108
        fixture.session.update()
        XCTAssertEqual(fixture.session.snapshot.elapsed, 5, accuracy: 0.000_01)
        XCTAssertEqual(fixture.session.status, .exhaling)
    }

    func testDelayedUpdateOnlyEmitsCurrentPhaseFeedback() {
        let fixture = Fixture()
        fixture.session.start()
        fixture.clock.time = 3
        fixture.session.update()
        XCTAssertEqual(fixture.feedback.events.map(\.event), [.inhale])

        fixture.clock.time = 20
        fixture.session.update()

        XCTAssertEqual(fixture.session.snapshot.phaseIndex, 3)
        XCTAssertEqual(fixture.session.status, .exhaling)
        XCTAssertEqual(fixture.feedback.events.map(\.event), [.inhale, .exhale])
    }

    func testCompletionOccursAtExactlyTenMinutesOfActiveBreathing() {
        let fixture = Fixture()
        fixture.session.start()
        fixture.clock.time = 603
        fixture.session.update()

        XCTAssertEqual(fixture.session.status, .completed)
        XCTAssertEqual(fixture.session.snapshot.elapsed, 600)
        XCTAssertEqual(fixture.session.snapshot.completedCycles, 60)
        XCTAssertEqual(fixture.feedback.events.last?.event, .completed)
        XCTAssertEqual(fixture.idleTimerChanges, [true, false])
    }

    func testFeedbackReceivesDisabledPreferences() {
        let fixture = Fixture()
        fixture.session.hapticsEnabled = false
        fixture.session.soundEnabled = false
        fixture.session.start()
        fixture.clock.time = 3
        fixture.session.update()

        XCTAssertEqual(fixture.feedback.events.count, 1)
        XCTAssertFalse(fixture.feedback.events[0].hapticsEnabled)
        XCTAssertFalse(fixture.feedback.events[0].soundEnabled)
    }

    func testInterruptionPausesOnlyAnActiveSession() {
        let fixture = Fixture()
        fixture.session.pauseForInterruption()
        XCTAssertEqual(fixture.session.status, .idle)

        fixture.session.start()
        fixture.session.pauseForInterruption()
        XCTAssertEqual(fixture.session.status, .paused)
        XCTAssertEqual(fixture.idleTimerChanges, [true, false])
    }
}

@MainActor
private final class Fixture {
    let clock = ManualClock()
    let feedback = FeedbackSpy()
    private(set) var idleTimerChanges: [Bool] = []
    lazy var session = BreathingSession(
        feedbackPlayer: feedback,
        now: { [clock] in clock.time },
        setIdleTimerDisabled: { [weak self] in self?.idleTimerChanges.append($0) },
        automaticallyUpdates: false
    )
}

private final class ManualClock {
    var time: TimeInterval = 0
}

@MainActor
private final class FeedbackSpy: BreathFeedbackPlaying {
    struct Record {
        let event: BreathFeedbackEvent
        let hapticsEnabled: Bool
        let soundEnabled: Bool
    }

    private(set) var events: [Record] = []

    func play(_ event: BreathFeedbackEvent, hapticsEnabled: Bool, soundEnabled: Bool) {
        events.append(Record(event: event, hapticsEnabled: hapticsEnabled, soundEnabled: soundEnabled))
    }
}
