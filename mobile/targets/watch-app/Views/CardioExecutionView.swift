import SwiftUI
import WatchKit
import Combine

// MARK: - Cardio Execution View

struct CardioExecutionView: View {
    let item: WatchCardioItem
    let onComplete: (_ elapsedSeconds: Int) -> Void

    @State private var phase: CardioPhase = .idle
    @State private var countdownValue: Int = 5
    @State private var timeRemaining: Int = 0
    @State private var currentRound: Int = 1
    @State private var totalElapsed: Int = 0
    @State private var isPaused: Bool = false
    @State private var timerCancellable: AnyCancellable?

    // Wall-clock anchors — the timer is driven by absolute dates, not by counting
    // ticks. This keeps interval timing and elapsed time correct even when the
    // watch screen sleeps (wrist down / Always-On) and the runloop stops firing:
    // the first tick after resume catches up through every phase that elapsed.
    @State private var phaseDeadline: Date?       // absolute end of the current timed phase
    @State private var cardioStartedAt: Date?     // when work first began (after countdown)
    @State private var pausedAt: Date?            // when the user paused (continuous only)
    @State private var pausedAccumulated: TimeInterval = 0

    private enum CardioPhase {
        case idle, countdown, work, rest, completed
    }

    var body: some View {
        ZStack {
            backgroundColor.ignoresSafeArea()

            switch phase {
            case .idle:
                idleView
            case .countdown:
                countdownView
            case .work:
                if item.isInterval {
                    intervalWorkView
                } else {
                    continuousView
                }
            case .rest:
                intervalRestView
            case .completed:
                completedView
            }
        }
        .onDisappear {
            timerCancellable?.cancel()
        }
    }

    // MARK: - Background Color

    private var backgroundColor: Color {
        switch phase {
        case .work where item.isInterval:
            return Color.red.opacity(0.05)
        case .rest:
            return Color.green.opacity(0.05)
        default:
            return Color.black
        }
    }

    // MARK: - Idle View

    private var idleView: some View {
        VStack(spacing: 10) {
            Image(systemName: item.equipmentIcon)
                .font(.system(size: 28))
                .foregroundStyle(.cyan)

            Text("Aeróbio")
                .font(.headline)
                .foregroundStyle(.white)

            VStack(spacing: 4) {
                Text(item.config.equipmentLabel ?? item.config.equipment ?? "Cardio")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                Text(item.summaryText)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                if let intensity = item.config.intensity, !intensity.isEmpty {
                    Text(intensity)
                        .font(.caption2)
                        .foregroundStyle(.cyan.opacity(0.8))
                }
            }

            Button("Iniciar") {
                startCountdown()
            }
            .buttonStyle(.borderedProminent)
            .tint(.cyan)
        }
        .padding()
    }

    // MARK: - Countdown View

    private var countdownView: some View {
        VStack(spacing: 12) {
            Spacer()

            Text("\(countdownValue)")
                .font(.system(size: 60, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .contentTransition(.numericText())

            Text("PREPARE-SE")
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)

            Spacer()
        }
    }

    // MARK: - Continuous Mode View

    private var continuousView: some View {
        VStack(spacing: 6) {
            // Progress ring + timer
            ZStack {
                Circle()
                    .stroke(Color.gray.opacity(0.2), lineWidth: 8)
                    .frame(width: 100, height: 100)

                Circle()
                    .trim(from: 0, to: continuousProgress)
                    .stroke(Color.cyan, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .frame(width: 100, height: 100)

                Text(formatTime(timeRemaining))
                    .font(.system(size: 28, weight: .bold, design: .monospaced))
                    .foregroundStyle(.white)
                    .monospacedDigit()
            }

            // Equipment + intensity
            HStack(spacing: 4) {
                Image(systemName: item.equipmentIcon)
                    .font(.system(size: 11))
                Text(item.config.equipmentLabel ?? "Aeróbio")
                    .font(.caption)
            }
            .foregroundStyle(.secondary)

            if let intensity = item.config.intensity, !intensity.isEmpty {
                Text(intensity)
                    .font(.caption2)
                    .foregroundStyle(.cyan.opacity(0.8))
            }

            // Buttons
            HStack(spacing: 12) {
                Button(isPaused ? "Retomar" : "Pausar") {
                    togglePause()
                }
                .font(.caption)
                .buttonStyle(.bordered)

                Button("Concluir") {
                    completeCardio()
                }
                .font(.caption)
                .buttonStyle(.borderedProminent)
                .tint(.cyan)
            }
        }
        .padding(.horizontal, 8)
    }

    // MARK: - Interval Work View

    private var intervalWorkView: some View {
        let totalRounds = item.config.rounds ?? 8

        return VStack(spacing: 6) {
            Text("TRABALHO")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.red)
                .tracking(1)

            Text(formatTime(timeRemaining))
                .font(.system(size: 44, weight: .bold, design: .monospaced))
                .foregroundStyle(.red)
                .monospacedDigit()

            Text("Round \(currentRound)/\(totalRounds)")
                .font(.subheadline)
                .foregroundStyle(.white)

            roundDots(total: totalRounds, completed: currentRound - 1)
                .padding(.vertical, 2)

            HStack(spacing: 12) {
                Button("Pular") {
                    skipPhase()
                }
                .font(.caption)
                .buttonStyle(.bordered)

                Button("Concluir") {
                    completeCardio()
                }
                .font(.caption)
                .buttonStyle(.borderedProminent)
                .tint(.cyan)
            }
        }
        .padding(.horizontal, 8)
    }

    // MARK: - Interval Rest View

    private var intervalRestView: some View {
        let totalRounds = item.config.rounds ?? 8

        return VStack(spacing: 6) {
            Text("DESCANSO")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.green)
                .tracking(1)

            Text(formatTime(timeRemaining))
                .font(.system(size: 44, weight: .bold, design: .monospaced))
                .foregroundStyle(.green)
                .monospacedDigit()

            Text("Round \(currentRound)/\(totalRounds)")
                .font(.subheadline)
                .foregroundStyle(.white)

            roundDots(total: totalRounds, completed: currentRound - 1)
                .padding(.vertical, 2)

            HStack(spacing: 12) {
                Button("Pular") {
                    skipPhase()
                }
                .font(.caption)
                .buttonStyle(.bordered)

                Button("Concluir") {
                    completeCardio()
                }
                .font(.caption)
                .buttonStyle(.borderedProminent)
                .tint(.cyan)
            }
        }
        .padding(.horizontal, 8)
    }

    // MARK: - Completed View

    private var completedView: some View {
        VStack(spacing: 8) {
            Spacer()

            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 36))
                .foregroundStyle(.green)

            Text("Concluído!")
                .font(.headline)
                .foregroundStyle(.white)

            Text(formatTime(totalElapsed) + " total")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            if item.isInterval {
                let totalRounds = item.config.rounds ?? 8
                Text("\(min(currentRound, totalRounds))/\(totalRounds) rounds")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()
            // Reserve space for the "Finalizar Treino" overlay button
            Spacer().frame(height: 44)
        }
    }

    // MARK: - Round Dots

    private func roundDots(total: Int, completed: Int) -> some View {
        let maxVisible = min(total, 12)
        let dotSize: CGFloat = total > 8 ? 5 : 6
        let spacing: CGFloat = total > 8 ? 2 : 3

        return HStack(spacing: spacing) {
            ForEach(0..<maxVisible, id: \.self) { i in
                Circle()
                    .fill(i < completed ? Color.cyan : Color.gray.opacity(0.4))
                    .frame(width: dotSize, height: dotSize)
            }
        }
    }

    // MARK: - Progress

    private var continuousProgress: CGFloat {
        let total = item.totalDurationSeconds
        guard total > 0 else { return 0 }
        let elapsed = total - timeRemaining
        return CGFloat(min(max(Double(elapsed) / Double(total), 0), 1))
    }

    // MARK: - Timer Logic (wall-clock driven)

    /// Seconds remaining in the current timed phase, derived from the absolute deadline.
    private func remaining(at now: Date = Date()) -> Int {
        guard let deadline = phaseDeadline else { return 0 }
        return max(0, Int(deadline.timeIntervalSince(now).rounded(.up)))
    }

    /// Total active cardio time (work + rest), computed from wall-clock so it stays
    /// correct across suspensions. Excludes the countdown and any paused time.
    private func computeTotalElapsed(at now: Date = Date()) -> Int {
        guard let start = cardioStartedAt else { return 0 }
        let livePause = pausedAt.map { now.timeIntervalSince($0) } ?? 0
        return max(0, Int(now.timeIntervalSince(start) - pausedAccumulated - livePause))
    }

    private func startCountdown() {
        phase = .countdown
        countdownValue = 5
        cardioStartedAt = nil
        pausedAt = nil
        pausedAccumulated = 0
        phaseDeadline = Date().addingTimeInterval(5)
        startTimer()
    }

    private func togglePause() {
        if isPaused {
            // Resume — fold the paused span into the accumulator and push the deadline.
            isPaused = false
            if let pAt = pausedAt {
                let span = Date().timeIntervalSince(pAt)
                pausedAccumulated += span
                if let d = phaseDeadline { phaseDeadline = d.addingTimeInterval(span) }
                pausedAt = nil
            }
            startTimer()
        } else {
            isPaused = true
            pausedAt = Date()
            timerCancellable?.cancel()
        }
    }

    private func skipPhase() {
        guard item.isInterval, phase == .work || phase == .rest else { return }
        // Collapse the current phase and advance immediately, chaining from now.
        phaseDeadline = Date()
        advancePhase()
        let now = Date()
        timeRemaining = remaining(at: now)
        totalElapsed = computeTotalElapsed(at: now)
    }

    private func startTimer() {
        timerCancellable?.cancel()
        timerCancellable = Timer.publish(every: 1, on: .main, in: .common)
            .autoconnect()
            .sink { _ in
                tick()
            }
    }

    private func tick() {
        guard !isPaused else { return }
        let now = Date()

        // Catch up through every phase whose deadline has already passed. A single
        // suspended interval can span multiple work/rest rounds; this loop advances
        // through all of them so currentRound and elapsed time stay accurate.
        while phase != .completed, let deadline = phaseDeadline, now >= deadline {
            advancePhase()
        }
        if phase == .completed { return }

        let newRemaining = remaining(at: now)
        if phase == .countdown {
            if newRemaining != countdownValue {
                countdownValue = newRemaining
                if newRemaining > 0 { WKInterfaceDevice.current().play(.click) }
            }
        }
        timeRemaining = newRemaining
        totalElapsed = computeTotalElapsed(at: now)
    }

    /// Advance to the next phase, chaining the new deadline off the previous one so
    /// absolute timing never drifts, even after long suspensions.
    private func advancePhase() {
        let base = phaseDeadline ?? Date()
        let totalRounds = item.config.rounds ?? 8

        switch phase {
        case .countdown:
            cardioStartedAt = base
            phase = .work
            if item.isInterval {
                currentRound = 1
                phaseDeadline = base.addingTimeInterval(Double(item.config.workSeconds ?? 30))
            } else {
                phaseDeadline = base.addingTimeInterval(Double(item.totalDurationSeconds))
            }
            WKInterfaceDevice.current().play(.start)

        case .work where item.isInterval:
            if currentRound >= totalRounds {
                finalizeCompleted()
                return
            }
            phase = .rest
            phaseDeadline = base.addingTimeInterval(Double(item.config.restSeconds ?? 15))
            WKInterfaceDevice.current().play(.directionUp)

        case .work:
            // Continuous mode finished.
            finalizeCompleted()

        case .rest:
            let nextRound = currentRound + 1
            if nextRound > totalRounds {
                finalizeCompleted()
            } else {
                currentRound = nextRound
                phase = .work
                phaseDeadline = base.addingTimeInterval(Double(item.config.workSeconds ?? 30))
                WKInterfaceDevice.current().play(.start)
            }

        default:
            break
        }
    }

    /// Manual "Concluir" tap.
    private func completeCardio() {
        finalizeCompleted()
    }

    private func finalizeCompleted() {
        let elapsed = computeTotalElapsed()
        phase = .completed
        phaseDeadline = nil
        timerCancellable?.cancel()
        totalElapsed = elapsed
        WKInterfaceDevice.current().play(.success)
        onComplete(elapsed)
    }

    // MARK: - Formatting

    private func formatTime(_ seconds: Int) -> String {
        let m = seconds / 60
        let s = seconds % 60
        return String(format: "%d:%02d", m, s)
    }
}
