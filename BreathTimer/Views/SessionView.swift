import SwiftUI
import UIKit

struct SessionView: View {
    @ObservedObject var session: BreathingSession
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showingEndConfirmation = false

    var body: some View {
        ZStack {
            switch session.status {
            case .preparing:
                preparationContent
            case .completed:
                completionContent
            case .inhaling, .exhaling, .paused:
                breathingContent
            case .idle:
                EmptyView()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .confirmationDialog(
            "结束本次练习？",
            isPresented: $showingEndConfirmation,
            titleVisibility: .visible
        ) {
            Button("结束练习", role: .destructive, action: session.end)
            Button("继续练习", role: .cancel) {}
        } message: {
            Text("本次练习不会被记录为完成。")
        }
        .onChange(of: session.snapshot.phase) { oldPhase, newPhase in
            guard oldPhase != newPhase, newPhase != .completed else { return }
            UIAccessibility.post(notification: .announcement, argument: newPhase.title)
        }
    }

    private var preparationContent: some View {
        VStack(spacing: 24) {
            Spacer()
            Text("准备")
                .font(.title2.weight(.medium))
                .foregroundStyle(.white.opacity(0.64))
            Text("\(session.preparationRemainingSeconds)")
                .font(.system(size: 104, weight: .light, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(.white)
                .contentTransition(.numericText())
                .accessibilityLabel("还有 \(session.preparationRemainingSeconds) 秒开始")
            Text("放松肩膀，保持自然")
                .font(.body)
                .foregroundStyle(.white.opacity(0.48))
            Spacer()
            Button("取消", action: session.end)
                .font(.headline)
                .foregroundStyle(.white.opacity(0.7))
                .frame(minWidth: 88, minHeight: 52)
                .padding(.bottom, 26)
        }
        .padding(.horizontal, 24)
    }

    private var breathingContent: some View {
        VStack(spacing: 0) {
            HStack {
                Button {
                    showingEndConfirmation = true
                } label: {
                    Image(systemName: "xmark")
                        .font(.headline)
                        .frame(width: 48, height: 48)
                        .background(.white.opacity(0.06), in: Circle())
                }
                .accessibilityLabel("结束练习")

                Spacer()

                Text(session.snapshot.totalRemainingSeconds.minuteSecondText)
                    .font(.subheadline.monospacedDigit().weight(.medium))
                    .foregroundStyle(.white.opacity(0.58))
                    .accessibilityLabel("剩余 \(session.snapshot.totalRemainingSeconds / 60) 分 \(session.snapshot.totalRemainingSeconds % 60) 秒")

                Spacer()

                Color.clear.frame(width: 48, height: 48)
            }
            .foregroundStyle(.white.opacity(0.82))
            .padding(.horizontal, 20)
            .padding(.top, 8)

            Spacer(minLength: 22)

            BreathingOrb(
                phase: session.snapshot.phase,
                progress: session.snapshot.phaseProgress,
                reduceMotion: reduceMotion
            )

            VStack(spacing: 10) {
                Text(session.status == .paused ? "已暂停" : session.snapshot.phase.title)
                    .font(.system(.largeTitle, design: .rounded, weight: .semibold))
                    .foregroundStyle(.white)
                    .accessibilityAddTraits(.isHeader)

                if session.status == .paused {
                    Text("准备好后，继续你的节奏")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.5))
                } else {
                    Text("\(session.snapshot.phaseRemainingSeconds)")
                        .font(.title2.monospacedDigit().weight(.light))
                        .foregroundStyle(.white.opacity(0.52))
                        .contentTransition(.numericText())
                        .accessibilityLabel("本阶段剩余 \(session.snapshot.phaseRemainingSeconds) 秒")
                }
            }
            .padding(.top, 24)

            Spacer()

            Button {
                if session.status == .paused {
                    session.resume()
                } else {
                    session.pause()
                }
            } label: {
                Label(
                    session.status == .paused ? "继续练习" : "暂停",
                    systemImage: session.status == .paused ? "play.fill" : "pause.fill"
                )
                .font(.headline)
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .background(.white.opacity(0.09), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            }
            .buttonStyle(.plain)
            .foregroundStyle(.white.opacity(0.9))
            .padding(.horizontal, 24)
            .padding(.bottom, 28)
        }
    }

    private var completionContent: some View {
        VStack(spacing: 22) {
            Spacer()

            ZStack {
                Circle()
                    .fill(Color.indigo.opacity(0.18))
                    .frame(width: 150, height: 150)
                    .blur(radius: 18)
                Image(systemName: "checkmark")
                    .font(.system(size: 52, weight: .light))
                    .foregroundStyle(.white.opacity(0.9))
                    .frame(width: 116, height: 116)
                    .background(.white.opacity(0.07), in: Circle())
            }

            Text("练习完成")
                .font(.largeTitle.bold())
                .foregroundStyle(.white)
            Text("10 分钟 · 60 次呼吸周期")
                .font(.body.monospacedDigit())
                .foregroundStyle(.white.opacity(0.52))

            Spacer()

            Button(action: session.completeAndReturnHome) {
                Text("完成")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .frame(height: 58)
                    .background(Color(red: 0.42, green: 0.51, blue: 0.84), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            }
            .buttonStyle(.plain)
            .foregroundStyle(.white)
            .padding(.horizontal, 24)
            .padding(.bottom, 28)
        }
    }
}
