import SwiftUI

@main
struct BreathTimerApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                .preferredColorScheme(.dark)
        }
    }
}

struct RootView: View {
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("hapticsEnabled") private var hapticsEnabled = true
    @AppStorage("soundEnabled") private var soundEnabled = false
    @StateObject private var session = BreathingSession(feedbackPlayer: SystemFeedbackService())

    var body: some View {
        ZStack {
            NightBackground()

            if session.status == .idle {
                HomeView(
                    hapticsEnabled: $hapticsEnabled,
                    soundEnabled: $soundEnabled,
                    start: session.start
                )
                .transition(.opacity)
            } else {
                SessionView(session: session)
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.35), value: session.status == .idle)
        .onAppear(perform: syncPreferences)
        .onChange(of: hapticsEnabled) { _, _ in syncPreferences() }
        .onChange(of: soundEnabled) { _, _ in syncPreferences() }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase != .active {
                session.pauseForInterruption()
            }
        }
    }

    private func syncPreferences() {
        session.hapticsEnabled = hapticsEnabled
        session.soundEnabled = soundEnabled
    }
}
