import ActivityKit
import WidgetKit
import SwiftUI

// MARK: - Color Helpers

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 6:
            (a, r, g, b) = (255, (int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = ((int >> 24) & 0xFF, (int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Theme Constants

private let kinevoBackground = Color(hex: "0D0D17")
private let kinevoSurface = Color(hex: "1A1A2E")
private let kinevoViolet = Color(hex: "7C3AED")
private let kinevoVioletLight = Color(hex: "8B5CF6")
private let kinevoAmber = Color(hex: "F59E0B")
private let kinevoCyan = Color(hex: "06B6D4")
private let kinevoRed = Color(hex: "DC2626")
private let kinevoGreen = Color(hex: "059669")
private let kinetoTextPrimary = Color(hex: "E2E8F0")
private let kinetoTextSecondary = Color(hex: "64748B")

// MARK: - Helpers

private func itemTypeIcon(_ itemType: String?) -> String {
    switch itemType {
    case "warmup": return "flame.fill"
    case "cardio": return "heart.fill"
    default: return "dumbbell.fill"
    }
}

private func itemTypeColor(_ itemType: String?) -> Color {
    switch itemType {
    case "warmup": return kinevoAmber
    case "cardio": return kinevoCyan
    default: return kinevoVioletLight
    }
}

// MARK: - Live Activity Widget

struct WorkoutLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutActivityAttributes.self) { context in
            // Lock Screen / Banner view
            LockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded Dynamic Island
                DynamicIslandExpandedRegion(.leading) {
                    ExpandedLeading(context: context)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ExpandedTrailing(context: context)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    ExpandedBottom(context: context)
                }
            } compactLeading: {
                // Compact left — item type icon
                let itemType = context.state.currentItemType ?? "exercise"
                Image(systemName: itemTypeIcon(itemType))
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(itemTypeColor(itemType))
            } compactTrailing: {
                // Compact right — timer or set progress
                let state = context.state
                let itemType = state.currentItemType ?? "exercise"
                if (itemType == "warmup" || itemType == "cardio"),
                   let endTs = state.timerEndTimestamp {
                    let endDate = Date(timeIntervalSince1970: endTs / 1000)
                    if endDate > Date() {
                        Text(timerInterval: Date()...endDate, countsDown: true, showsHours: false)
                            .font(.system(size: 14, weight: .bold, design: .monospaced))
                            .foregroundColor(kinetoTextPrimary)
                            .monospacedDigit()
                            .id("compact-\(state.updateId ?? "")")
                    } else {
                        Text("\(state.setsCompleted)/\(state.totalSets)")
                            .font(.system(size: 14, weight: .bold, design: .rounded))
                            .foregroundColor(kinetoTextPrimary)
                    }
                } else {
                    Text("\(state.setsCompleted)/\(state.totalSets)")
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .foregroundColor(kinetoTextPrimary)
                }
            } minimal: {
                // Minimal — item type icon
                let itemType = context.state.currentItemType ?? "exercise"
                Image(systemName: itemTypeIcon(itemType))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(itemTypeColor(itemType))
            }
        }
    }
}

// MARK: - Lock Screen View

private struct LockScreenView: View {
    let context: ActivityViewContext<WorkoutActivityAttributes>

    private var state: WorkoutActivityAttributes.ContentState {
        context.state
    }

    private var itemType: String {
        state.currentItemType ?? "exercise"
    }

    private var progress: Double {
        guard state.totalSetsOverall > 0 else { return 0 }
        return Double(state.totalSetsCompleted) / Double(state.totalSetsOverall)
    }

    private var workoutStartDate: Date {
        Date(timeIntervalSince1970: state.workoutStartTimestamp / 1000)
    }

    private var restEndDate: Date? {
        guard let ts = state.restEndTimestamp else { return nil }
        return Date(timeIntervalSince1970: ts / 1000)
    }

    private var timerEndDate: Date? {
        guard let ts = state.timerEndTimestamp else { return nil }
        return Date(timeIntervalSince1970: ts / 1000)
    }

    private var timerProgress: Double {
        guard let totalSecs = state.timerTotalSeconds, totalSecs > 0,
              let endDate = timerEndDate else { return 0 }
        let remaining = max(0, endDate.timeIntervalSinceNow)
        return 1.0 - (remaining / Double(totalSecs))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Top Row: Workout name + elapsed timer
            HStack(alignment: .center) {
                HStack(spacing: 6) {
                    Image(systemName: itemTypeIcon(itemType))
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(itemTypeColor(itemType))
                    Text(context.attributes.workoutName)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(kinetoTextPrimary)
                        .lineLimit(1)
                }

                Spacer()

                // Elapsed timer (counts up) — or countdown for warmup/cardio
                if itemType == "warmup" || itemType == "cardio",
                   let endDate = timerEndDate, endDate > Date() {
                    Text(timerInterval: Date()...endDate, countsDown: true, showsHours: false)
                        .font(.system(size: 16, weight: .bold, design: .monospaced))
                        .foregroundColor(itemTypeColor(itemType))
                        .monospacedDigit()
                        .multilineTextAlignment(.trailing)
                        .id("lock-\(state.updateId ?? "")")
                } else {
                    HStack(spacing: 4) {
                        Image(systemName: "timer")
                            .font(.system(size: 11))
                            .foregroundColor(kinetoTextSecondary)
                        Text(timerInterval: workoutStartDate...Date.distantFuture, countsDown: false, showsHours: true)
                            .font(.system(size: 13, weight: .medium, design: .monospaced))
                            .foregroundColor(kinetoTextSecondary)
                            .multilineTextAlignment(.trailing)
                    }
                }
            }

            // Content — conditional based on item type
            switch itemType {
            case "warmup":
                WarmupContent(state: state, timerEndDate: timerEndDate, timerProgress: timerProgress)
            case "cardio":
                if state.cardioMode == "interval" {
                    CardioIntervalContent(state: state, timerEndDate: timerEndDate)
                } else {
                    CardioContinuousContent(state: state, timerEndDate: timerEndDate, timerProgress: timerProgress)
                }
            default:
                ExerciseContent(state: state, context: context, restEndDate: restEndDate)
            }

            // Overall progress bar (always shown)
            OverallProgressBar(progress: progress, totalSetsCompleted: state.totalSetsCompleted, totalSetsOverall: state.totalSetsOverall)
        }
        .padding(16)
        .background(kinevoBackground)
    }
}

// MARK: - Exercise Content (unchanged behavior)

private struct ExerciseContent: View {
    let state: WorkoutActivityAttributes.ContentState
    let context: ActivityViewContext<WorkoutActivityAttributes>
    let restEndDate: Date?

    var body: some View {
        // Exercise info
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Exerc\u{00ED}cio \(state.currentExerciseIndex + 1)/\(context.attributes.totalExercises)")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(kinetoTextSecondary)
                    .textCase(.uppercase)

                Text(state.currentExerciseName)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(1)
            }

            Spacer()

            // Set counter badge
            VStack(spacing: 2) {
                Text("S\u{00E9}rie")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(kinetoTextSecondary)
                    .textCase(.uppercase)
                Text("\(state.setsCompleted)/\(state.totalSets)")
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                    .foregroundColor(kinevoVioletLight)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(kinevoViolet.opacity(0.15))
            .cornerRadius(10)
        }

        // Rest timer (only visible when resting)
        if state.isResting, let endDate = restEndDate, endDate > Date() {
            HStack(spacing: 8) {
                Image(systemName: "hourglass")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(kinevoAmber)

                Text("Descansando")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(kinevoAmber)

                Spacer()

                // Native countdown timer
                Text(timerInterval: Date()...endDate, showsHours: false)
                    .font(.system(size: 16, weight: .bold, design: .monospaced))
                    .foregroundColor(kinevoAmber)
                    .multilineTextAlignment(.trailing)
                    .id("rest-\(state.updateId ?? "")")
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(kinevoAmber.opacity(0.1))
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(kinevoAmber.opacity(0.2), lineWidth: 1)
            )
        }
    }
}

// MARK: - Warmup Content

private struct WarmupContent: View {
    let state: WorkoutActivityAttributes.ContentState
    let timerEndDate: Date?
    let timerProgress: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("AQUECIMENTO")
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(kinetoTextSecondary)
                .tracking(2)

            if let warmupType = state.warmupType, !warmupType.isEmpty {
                Text(warmupType)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(1)
            }
        }

        // Timer progress bar
        if timerEndDate != nil, let totalSecs = state.timerTotalSeconds, totalSecs > 0 {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Color.white.opacity(0.08))
                        .frame(height: 6)

                    RoundedRectangle(cornerRadius: 3)
                        .fill(kinevoAmber)
                        .frame(width: max(0, geo.size.width * timerProgress), height: 6)
                }
            }
            .frame(height: 6)
        }
    }
}

// MARK: - Cardio Continuous Content

private struct CardioContinuousContent: View {
    let state: WorkoutActivityAttributes.ContentState
    let timerEndDate: Date?
    let timerProgress: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("AER\u{00D3}BIO")
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(kinetoTextSecondary)
                .tracking(2)

            // Equipment + intensity
            let parts = [state.cardioEquipment, state.cardioIntensity].compactMap { $0 }
            if !parts.isEmpty {
                Text(parts.joined(separator: " \u{00B7} "))
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(1)
            }
        }

        // Timer progress bar
        if timerEndDate != nil, let totalSecs = state.timerTotalSeconds, totalSecs > 0 {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Color.white.opacity(0.08))
                        .frame(height: 6)

                    RoundedRectangle(cornerRadius: 3)
                        .fill(kinevoCyan)
                        .frame(width: max(0, geo.size.width * timerProgress), height: 6)
                }
            }
            .frame(height: 6)
        }
    }
}

// MARK: - Cardio Interval Content

private struct CardioIntervalContent: View {
    let state: WorkoutActivityAttributes.ContentState
    let timerEndDate: Date?

    private var isWork: Bool {
        state.intervalPhase == "work"
    }

    private var phaseColor: Color {
        isWork ? kinevoRed : kinevoGreen
    }

    private var phaseLabel: String {
        isWork ? "TRABALHO" : "DESCANSO"
    }

    private var currentRound: Int {
        state.intervalCurrentRound ?? 1
    }

    private var totalRounds: Int {
        state.intervalTotalRounds ?? 1
    }

    var body: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 4) {
                // Phase badge
                Text(phaseLabel)
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundColor(phaseColor)
                    .tracking(2)

                // Equipment if present
                if let equipment = state.cardioEquipment, !equipment.isEmpty {
                    Text(equipment)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.white)
                        .lineLimit(1)
                }
            }

            Spacer()

            // Phase countdown timer
            if let endDate = timerEndDate, endDate > Date() {
                Text(timerInterval: Date()...endDate, countsDown: true, showsHours: false)
                    .font(.system(size: 24, weight: .bold, design: .monospaced))
                    .foregroundColor(phaseColor)
                    .monospacedDigit()
                    .id("interval-\(state.updateId ?? "")")
            }

            // Round counter badge
            VStack(spacing: 2) {
                Text("Round")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(kinetoTextSecondary)
                    .textCase(.uppercase)
                Text("\(currentRound)/\(totalRounds)")
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                    .foregroundColor(phaseColor)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(phaseColor.opacity(0.15))
            .cornerRadius(10)
        }

        // Round progress dots
        if totalRounds <= 20 {
            HStack(spacing: 4) {
                ForEach(0..<totalRounds, id: \.self) { i in
                    Circle()
                        .fill(i < currentRound - 1 ? kinevoCyan : (i == currentRound - 1 ? phaseColor : Color.white.opacity(0.15)))
                        .frame(width: totalRounds > 12 ? 5 : 6, height: totalRounds > 12 ? 5 : 6)
                }
            }
        }
    }
}

// MARK: - Overall Progress Bar

private struct OverallProgressBar: View {
    let progress: Double
    let totalSetsCompleted: Int
    let totalSetsOverall: Int

    var body: some View {
        VStack(spacing: 4) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.white.opacity(0.08))
                        .frame(height: 6)

                    RoundedRectangle(cornerRadius: 4)
                        .fill(
                            LinearGradient(
                                colors: [kinevoViolet, Color(hex: "3B82F6")],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: max(0, geo.size.width * progress), height: 6)
                }
            }
            .frame(height: 6)

            HStack {
                Text("Progresso geral")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(kinetoTextSecondary)
                Spacer()
                Text("\(totalSetsCompleted)/\(totalSetsOverall) s\u{00E9}ries")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(kinetoTextSecondary)
            }
        }
    }
}

// MARK: - Dynamic Island Expanded Views

private struct ExpandedLeading: View {
    let context: ActivityViewContext<WorkoutActivityAttributes>

    private var itemType: String {
        context.state.currentItemType ?? "exercise"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            switch itemType {
            case "warmup":
                Text("Aquecimento")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                if let warmupType = context.state.warmupType {
                    Text(warmupType)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(kinetoTextSecondary)
                }
            case "cardio":
                Text("Aer\u{00F3}bio")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                if context.state.cardioMode == "interval" {
                    let phase = context.state.intervalPhase == "work" ? "Trabalho" : "Descanso"
                    let round = context.state.intervalCurrentRound ?? 1
                    let total = context.state.intervalTotalRounds ?? 1
                    Text("\(phase) \u{00B7} \(round)/\(total)")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(context.state.intervalPhase == "work" ? kinevoRed : kinevoGreen)
                } else if let equipment = context.state.cardioEquipment {
                    Text(equipment)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(kinetoTextSecondary)
                }
            default:
                Text(context.state.currentExerciseName)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                Text("S\u{00E9}rie \(context.state.setsCompleted)/\(context.state.totalSets)")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(kinetoTextSecondary)
            }
        }
    }
}

private struct ExpandedTrailing: View {
    let context: ActivityViewContext<WorkoutActivityAttributes>

    private var workoutStartDate: Date {
        Date(timeIntervalSince1970: context.state.workoutStartTimestamp / 1000)
    }

    private var timerEndDate: Date? {
        guard let ts = context.state.timerEndTimestamp else { return nil }
        return Date(timeIntervalSince1970: ts / 1000)
    }

    private var itemType: String {
        context.state.currentItemType ?? "exercise"
    }

    var body: some View {
        VStack(alignment: .trailing, spacing: 2) {
            if (itemType == "warmup" || itemType == "cardio"),
               let endDate = timerEndDate, endDate > Date() {
                Text(timerInterval: Date()...endDate, countsDown: true, showsHours: false)
                    .font(.system(size: 14, weight: .bold, design: .monospaced))
                    .foregroundColor(itemTypeColor(itemType))
                    .multilineTextAlignment(.trailing)
                    .id("expanded-\(context.state.updateId ?? "")")
                Text(itemType == "warmup" ? "Aquecimento" : "Aer\u{00F3}bio")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(kinetoTextSecondary)
            } else {
                Text(timerInterval: workoutStartDate...Date.distantFuture, countsDown: false, showsHours: true)
                    .font(.system(size: 14, weight: .bold, design: .monospaced))
                    .foregroundColor(kinevoVioletLight)
                    .multilineTextAlignment(.trailing)
                Text("Dura\u{00E7}\u{00E3}o")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(kinetoTextSecondary)
            }
        }
    }
}

private struct ExpandedBottom: View {
    let context: ActivityViewContext<WorkoutActivityAttributes>

    private var state: WorkoutActivityAttributes.ContentState {
        context.state
    }

    private var progress: Double {
        guard state.totalSetsOverall > 0 else { return 0 }
        return Double(state.totalSetsCompleted) / Double(state.totalSetsOverall)
    }

    private var restEndDate: Date? {
        guard let ts = state.restEndTimestamp else { return nil }
        return Date(timeIntervalSince1970: ts / 1000)
    }

    var body: some View {
        VStack(spacing: 8) {
            // Progress bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Color.white.opacity(0.1))
                        .frame(height: 4)

                    RoundedRectangle(cornerRadius: 3)
                        .fill(
                            LinearGradient(
                                colors: [kinevoViolet, Color(hex: "3B82F6")],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: max(0, geo.size.width * progress), height: 4)
                }
            }
            .frame(height: 4)

            HStack {
                Text("\(state.totalSetsCompleted)/\(state.totalSetsOverall) s\u{00E9}ries")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(kinetoTextSecondary)

                Spacer()

                // Rest timer in expanded DI
                if state.isResting, let endDate = restEndDate, endDate > Date() {
                    HStack(spacing: 4) {
                        Image(systemName: "hourglass")
                            .font(.system(size: 10))
                            .foregroundColor(kinevoAmber)
                        Text(timerInterval: Date()...endDate, showsHours: false)
                            .font(.system(size: 11, weight: .bold, design: .monospaced))
                            .foregroundColor(kinevoAmber)
                            .id("di-rest-\(state.updateId ?? "")")
                    }
                }
            }
        }
    }
}
