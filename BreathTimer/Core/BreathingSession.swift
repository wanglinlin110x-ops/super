import Foundation
import UIKit

enum SessionStatus: Equatable {
    case idle
    case preparing
    case inhaling
    case exhaling
    case paused
    case completed
}

enum BreathFeedbackEvent: Equatable {
    case inhale
    case exhale
    case completed
}

@MainActor
protocol BreathFeedbackPlaying: AnyObject {
    func play(_ event: BreathFeedbackEvent, hapticsEnabled: Bool, soundEnabled: Bool)
}

@MainActor
final class BreathingSession: ObservableObject {
    static let preparationDuration: TimeInterval = 3

    @Published private(set) var status: SessionStatus = .idle
    @Published private(set) var preparationRemainingSeconds = 3
    @Published private(set) var snapshot: BreathingSnapshot = .initial

    var hapticsEnabled = true
    var soundEnabled = false

    private enum PausedSection {
        case preparation
        case breathing
    }

    private let feedbackPlayer: BreathFeedbackPlaying
    private let now: () -> TimeInterval
    private let setIdleTimerDisabled: (Bool) -> Void
    private let automaticallyUpdates: Bool

    private var updateTask: Task<Void, Never>?
    private var preparationStartedAt: TimeInterval?
    private var preparationElapsed: TimeInterval = 0
    private var breathingStartedAt: TimeInterval?
    private var breathingElapsed: TimeInterval = 0
    private var pausedSection: PausedSection?
    private var lastFeedbackPhaseIndex: Int?

    init(
        feedbackPlayer: BreathFeedbackPlaying,
        now: @escaping () -> TimeInterval = { ProcessInfo.processInfo.systemUptime },
        setIdleTimerDisabled: @escaping (Bool) -> Void = { UIApplication.shared.isIdleTimerDisabled = $0 },
        automaticallyUpdates: Bool = true
    ) {
        self.feedbackPlayer = feedbackPlayer
        self.now = now
        self.setIdleTimerDisabled = setIdleTimerDisabled
        self.automaticallyUpdates = automaticallyUpdates
    }

    var isRunning: Bool {
        status == .preparing || status == .inhaling || status == .exhaling
    }

    func start() {
        resetInternalState()
        status = .preparing
        preparationStartedAt = now()
        setIdleTimerDisabled(true)
        startUpdateLoopIfNeeded()
        update()
    }

    func update() {
        switch status {
        case .preparing:
            updatePreparation(at: now())
        case .inhaling, .exhaling:
            updateBreathing(at: now())
        case .idle, .paused, .completed:
            break
        }
    }

    func pause() {
        // Resolve any boundary crossed since the last display refresh before freezing time.
        update()
        guard isRunning else { return }
        let currentTime = now()

        switch status {
        case .preparing:
            preparationElapsed = currentPreparationElapsed(at: currentTime)
            preparationStartedAt = nil
            pausedSection = .preparation
        case .inhaling, .exhaling:
            breathingElapsed = currentBreathingElapsed(at: currentTime)
            breathingStartedAt = nil
            snapshot = BreathingTimeline.snapshot(at: breathingElapsed)
            pausedSection = .breathing
        case .idle, .paused, .completed:
            return
        }

        status = .paused
        stopUpdateLoop()
        setIdleTimerDisabled(false)
    }

    func pauseForInterruption() {
        guard isRunning else { return }
        pause()
    }

    func resume() {
        guard status == .paused, let pausedSection else { return }
        let currentTime = now()

        switch pausedSection {
        case .preparation:
            status = .preparing
            preparationStartedAt = currentTime
        case .breathing:
            status = status(for: snapshot.phase)
            breathingStartedAt = currentTime
            lastFeedbackPhaseIndex = snapshot.phaseIndex
        }

        self.pausedSection = nil
        setIdleTimerDisabled(true)
        startUpdateLoopIfNeeded()
        update()
    }

    func end() {
        stopUpdateLoop()
        setIdleTimerDisabled(false)
        resetInternalState()
        status = .idle
    }

    func completeAndReturnHome() {
        guard status == .completed else { return }
        end()
    }

    private func updatePreparation(at currentTime: TimeInterval) {
        let elapsed = currentPreparationElapsed(at: currentTime)

        guard elapsed >= Self.preparationDuration else {
            preparationRemainingSeconds = max(1, Int(ceil(Self.preparationDuration - elapsed)))
            return
        }

        let overshoot = elapsed - Self.preparationDuration
        preparationElapsed = Self.preparationDuration
        preparationStartedAt = nil
        breathingElapsed = 0
        breathingStartedAt = currentTime - overshoot
        lastFeedbackPhaseIndex = nil
        updateBreathing(at: currentTime)
    }

    private func updateBreathing(at currentTime: TimeInterval) {
        let elapsed = currentBreathingElapsed(at: currentTime)
        let newSnapshot = BreathingTimeline.snapshot(at: elapsed)
        snapshot = newSnapshot

        guard newSnapshot.phase != .completed else {
            finishSession()
            return
        }

        status = status(for: newSnapshot.phase)

        if newSnapshot.phaseIndex != lastFeedbackPhaseIndex {
            lastFeedbackPhaseIndex = newSnapshot.phaseIndex
            let event: BreathFeedbackEvent = newSnapshot.phase == .inhale ? .inhale : .exhale
            feedbackPlayer.play(event, hapticsEnabled: hapticsEnabled, soundEnabled: soundEnabled)
        }
    }

    private func finishSession() {
        breathingElapsed = BreathingTimeline.sessionDuration
        breathingStartedAt = nil
        snapshot = BreathingTimeline.snapshot(at: BreathingTimeline.sessionDuration)
        status = .completed
        stopUpdateLoop()
        setIdleTimerDisabled(false)
        feedbackPlayer.play(.completed, hapticsEnabled: hapticsEnabled, soundEnabled: soundEnabled)
    }

    private func currentPreparationElapsed(at currentTime: TimeInterval) -> TimeInterval {
        preparationElapsed + max(0, currentTime - (preparationStartedAt ?? currentTime))
    }

    private func currentBreathingElapsed(at currentTime: TimeInterval) -> TimeInterval {
        breathingElapsed + max(0, currentTime - (breathingStartedAt ?? currentTime))
    }

    private func status(for phase: BreathingPhase) -> SessionStatus {
        switch phase {
        case .inhale: .inhaling
        case .exhale: .exhaling
        case .completed: .completed
        }
    }

    private func startUpdateLoopIfNeeded() {
        guard automaticallyUpdates else { return }
        stopUpdateLoop()

        updateTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(33))
                guard !Task.isCancelled else { break }
                self?.update()
            }
        }
    }

    private func stopUpdateLoop() {
        updateTask?.cancel()
        updateTask = nil
    }

    private func resetInternalState() {
        stopUpdateLoop()
        preparationStartedAt = nil
        preparationElapsed = 0
        preparationRemainingSeconds = 3
        breathingStartedAt = nil
        breathingElapsed = 0
        pausedSection = nil
        lastFeedbackPhaseIndex = nil
        snapshot = .initial
    }
}
