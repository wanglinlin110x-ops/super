import SwiftUI

struct HomeView: View {
    @Binding var hapticsEnabled: Bool
    @Binding var soundEnabled: Bool
    let start: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                VStack(spacing: 10) {
                    Text("呼吸计时器")
                        .font(.largeTitle.bold())
                        .foregroundStyle(.white)

                    Text("给自己十分钟，慢慢安静下来")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.58))
                }
                .padding(.top, 42)

                BreathingOrb(phase: .inhale, progress: 0.58, reduceMotion: false)
                    .frame(height: 286)
                    .padding(.vertical, 12)

                VStack(spacing: 8) {
                    Text("吸气 5 秒  ·  呼气 5 秒")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.92))
                    Text("10 分钟 · 60 个呼吸周期")
                        .font(.subheadline.monospacedDigit())
                        .foregroundStyle(.white.opacity(0.52))
                }

                Button(action: start) {
                    Text("开始 10 分钟")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .frame(height: 58)
                        .background(
                            LinearGradient(
                                colors: [Color(red: 0.43, green: 0.53, blue: 0.88), Color(red: 0.34, green: 0.40, blue: 0.72)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            in: RoundedRectangle(cornerRadius: 20, style: .continuous)
                        )
                }
                .buttonStyle(.plain)
                .foregroundStyle(.white)
                .padding(.top, 30)
                .accessibilityHint("开始三秒准备倒计时")

                VStack(spacing: 10) {
                    PreferenceToggle(icon: "waveform.path", title: "触觉提示", isOn: $hapticsEnabled)
                    PreferenceToggle(icon: "speaker.wave.2", title: "声音提示", isOn: $soundEnabled)
                }
                .padding(.top, 18)

                Text("如感到头晕或不适，请恢复自然呼吸并停止练习。")
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.38))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 20)
                    .padding(.top, 22)
                    .padding(.bottom, 28)
            }
            .padding(.horizontal, 24)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .scrollIndicators(.hidden)
    }
}
