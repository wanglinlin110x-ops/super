import Foundation

enum BreathingPhase: String, Equatable, Sendable {
    case inhale
    case exhale
    case completed

    var title: String {
        switch self {
        case .inhale: "吸气"
        case .exhale: "呼气"
        case .completed: "已完成"
        }
    }
}

struct BreathingSnapshot: Equatable, Sendable {
    let elapsed: TimeInterval
    let phase: BreathingPhase
    let phaseIndex: Int
    let phaseProgress: Double
    let phaseRemainingSeconds: Int
    let totalRemainingSeconds: Int
    let completedCycles: Int

    static let initial = BreathingTimeline.snapshot(at: 0)
}

enum BreathingTimeline {
    static let phaseDuration: TimeInterval = 5
    static let cycleDuration: TimeInterval = 10
    static let sessionDuration: TimeInterval = 600
    static let totalCycles = 60

    static func snapshot(at rawElapsed: TimeInterval) -> BreathingSnapshot {
        let elapsed = min(max(rawElapsed, 0), sessionDuration)

        guard elapsed < sessionDuration else {
            return BreathingSnapshot(
                elapsed: sessionDuration,
                phase: .completed,
                phaseIndex: 120,
                phaseProgress: 1,
                phaseRemainingSeconds: 0,
                totalRemainingSeconds: 0,
                completedCycles: totalCycles
            )
        }

        let phaseIndex = Int(floor(elapsed / phaseDuration))
        let phaseElapsed = elapsed - (Double(phaseIndex) * phaseDuration)
        let progress = min(max(phaseElapsed / phaseDuration, 0), 1)
        let phase: BreathingPhase = phaseIndex.isMultiple(of: 2) ? .inhale : .exhale

        return BreathingSnapshot(
            elapsed: elapsed,
            phase: phase,
            phaseIndex: phaseIndex,
            phaseProgress: progress,
            phaseRemainingSeconds: max(1, Int(ceil(phaseDuration - phaseElapsed))),
            totalRemainingSeconds: max(1, Int(ceil(sessionDuration - elapsed))),
            completedCycles: min(Int(elapsed / cycleDuration), totalCycles)
        )
    }
}
