import AVFoundation
import UIKit

@MainActor
final class SystemFeedbackService: BreathFeedbackPlaying {
    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private let format = AVAudioFormat(standardFormatWithSampleRate: 44_100, channels: 1)!

    private lazy var inhaleBuffer = makeTone(frequency: 523.25, duration: 0.34)
    private lazy var exhaleBuffer = makeTone(frequency: 392.00, duration: 0.42)
    private lazy var completionBuffer = makeCompletionTone()
    private var audioPrepared = false

    func play(_ event: BreathFeedbackEvent, hapticsEnabled: Bool, soundEnabled: Bool) {
        if hapticsEnabled {
            playHaptic(for: event)
        }

        if soundEnabled {
            playTone(for: event)
        }
    }

    private func playHaptic(for event: BreathFeedbackEvent) {
        switch event {
        case .inhale:
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.prepare()
            generator.impactOccurred(intensity: 0.55)
        case .exhale:
            let generator = UIImpactFeedbackGenerator(style: .soft)
            generator.prepare()
            generator.impactOccurred(intensity: 0.75)
        case .completed:
            let generator = UINotificationFeedbackGenerator()
            generator.prepare()
            generator.notificationOccurred(.success)
        }
    }

    private func playTone(for event: BreathFeedbackEvent) {
        prepareAudioIfNeeded()

        let buffer: AVAudioPCMBuffer
        switch event {
        case .inhale: buffer = inhaleBuffer
        case .exhale: buffer = exhaleBuffer
        case .completed: buffer = completionBuffer
        }

        if player.isPlaying {
            player.stop()
        }
        player.scheduleBuffer(buffer, at: nil, options: .interrupts)
        player.play()
    }

    private func prepareAudioIfNeeded() {
        guard !audioPrepared else {
            if !engine.isRunning { try? engine.start() }
            return
        }

        try? AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
        engine.attach(player)
        engine.connect(player, to: engine.mainMixerNode, format: format)
        engine.mainMixerNode.outputVolume = 0.32
        engine.prepare()
        try? engine.start()
        audioPrepared = true
    }

    private func makeTone(frequency: Double, duration: Double) -> AVAudioPCMBuffer {
        let frameCount = AVAudioFrameCount(format.sampleRate * duration)
        let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount)!
        buffer.frameLength = frameCount

        guard let samples = buffer.floatChannelData?[0] else { return buffer }

        for frame in 0..<Int(frameCount) {
            let time = Double(frame) / format.sampleRate
            let normalized = time / duration
            let envelope = pow(sin(.pi * normalized), 2)
            let fundamental = sin(2 * .pi * frequency * time)
            let overtone = 0.18 * sin(2 * .pi * frequency * 2 * time)
            samples[frame] = Float((fundamental + overtone) * envelope * 0.14)
        }

        return buffer
    }

    private func makeCompletionTone() -> AVAudioPCMBuffer {
        let duration = 0.65
        let frameCount = AVAudioFrameCount(format.sampleRate * duration)
        let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount)!
        buffer.frameLength = frameCount

        guard let samples = buffer.floatChannelData?[0] else { return buffer }

        for frame in 0..<Int(frameCount) {
            let time = Double(frame) / format.sampleRate
            let normalized = time / duration
            let envelope = pow(sin(.pi * normalized), 2)
            let first = sin(2 * .pi * 523.25 * time)
            let second = sin(2 * .pi * 659.25 * time)
            samples[frame] = Float((first + second) * envelope * 0.07)
        }

        return buffer
    }
}
