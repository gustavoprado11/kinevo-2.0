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
        VStack(spacing: 10) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 40))
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

    // MARK: - Timer Logic

    private func startCountdown() {
        phase = .countdown
        countdownValue = 5
        startTimer()
    }

    private func togglePause() {
        isPaused.toggle()
        if isPaused {
            timerCancellable?.cancel()
        } else {
            startTimer()
        }
    }

    private func skipPhase() {
        switch phase {
        case .work where item.isInterval:
            transitionToRest()
        case .rest:
            transitionToNextWork()
        default:
            break
        }
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
        switch phase {
        case .countdown:
            if countdownValue <= 1 {
                // Start the actual cardio
                if item.isInterval {
                    phase = .work
                    timeRemaining = item.config.workSeconds ?? 30
                } else {
                    phase = .work
                    timeRemaining = item.totalDurationSeconds
                }
                WKInterfaceDevice.current().play(.start)
            } else {
                withAnimation(.easeInOut(duration: 0.3)) {
                    countdownValue -= 1
                }
                WKInterfaceDevice.current().play(.click)
            }

        case .work:
            totalElapsed += 1
            if timeRemaining <= 1 {
                if item.isInterval {
                    transitionToRest()
                } else {
                    completeCardio()
                }
            } else {
                timeRemaining -= 1
            }

        case .rest:
            totalElapsed += 1
            if timeRemaining <= 1 {
                transitionToNextWork()
            } else {
                timeRemaining -= 1
            }

        default:
            break
        }
    }

    private func transitionToRest() {
        let totalRounds = item.config.rounds ?? 8
        if currentRound >= totalRounds {
            completeCardio()
            return
        }
        phase = .rest
        timeRemaining = item.config.restSeconds ?? 15
        WKInterfaceDevice.current().play(.directionUp)
    }

    private func transitionToNextWork() {
        let totalRounds = item.config.rounds ?? 8
        let nextRound = currentRound + 1
        if nextRound > totalRounds {
            completeCardio()
        } else {
            currentRound = nextRound
            phase = .work
            timeRemaining = item.config.workSeconds ?? 30
            WKInterfaceDevice.current().play(.start)
        }
    }

    private func completeCardio() {
        phase = .completed
        timerCancellable?.cancel()
        WKInterfaceDevice.current().play(.success)
        onComplete(totalElapsed)
    }

    // MARK: - Formatting

    private func formatTime(_ seconds: Int) -> String {
        let m = seconds / 60
        let s = seconds % 60
        return String(format: "%d:%02d", m, s)
    }
}
