import SwiftUI

struct NightBackground: View {
    var body: some View {
        LinearGradient(
            colors: [Color(red: 0.025, green: 0.035, blue: 0.075), .black],
            startPoint: .top,
            endPoint: .bottom
        )
        .ignoresSafeArea()
    }
}

struct BreathingOrb: View {
    let phase: BreathingPhase
    let progress: Double
    let reduceMotion: Bool

    private var easedProgress: Double {
        let value = min(max(progress, 0), 1)
        return value * value * (3 - 2 * value)
    }

    private var expansion: Double {
        switch phase {
        case .inhale: easedProgress
        case .exhale: 1 - easedProgress
        case .completed: 0.72
        }
    }

    private var scale: CGFloat {
        reduceMotion ? 0.84 : 0.55 + (0.45 * expansion)
    }

    var body: some View {
        ZStack {
            Circle()
                .fill(Color.indigo.opacity(0.12 + 0.12 * expansion))
                .blur(radius: 36)
                .scaleEffect(scale * 1.28)

            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Color(red: 0.72, green: 0.82, blue: 1).opacity(0.92),
                            Color(red: 0.40, green: 0.52, blue: 0.86).opacity(0.74),
                            Color.indigo.opacity(0.22)
                        ],
                        center: .topLeading,
                        startRadius: 8,
                        endRadius: 150
                    )
                )
                .overlay {
                    Circle()
                        .stroke(Color.white.opacity(0.16), lineWidth: 1)
                }
                .shadow(color: Color.indigo.opacity(0.34 + 0.18 * expansion), radius: 28)
                .scaleEffect(scale)

            if reduceMotion {
                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(
                        Color.white.opacity(0.72),
                        style: StrokeStyle(lineWidth: 3, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .padding(18)
            }
        }
        .frame(width: 270, height: 270)
        .opacity(reduceMotion ? 0.74 + 0.22 * expansion : 1)
        .accessibilityHidden(true)
    }
}

struct PreferenceToggle: View {
    let icon: String
    let title: String
    @Binding var isOn: Bool

    var body: some View {
        Toggle(isOn: $isOn) {
            Label(title, systemImage: icon)
                .font(.body.weight(.medium))
                .foregroundStyle(.white.opacity(0.88))
        }
        .tint(Color(red: 0.48, green: 0.58, blue: 0.92))
        .padding(.horizontal, 18)
        .frame(minHeight: 54)
        .background(.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

extension Int {
    var minuteSecondText: String {
        String(format: "%02d:%02d", self / 60, self % 60)
    }
}
