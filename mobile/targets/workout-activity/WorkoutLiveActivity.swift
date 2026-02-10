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
private let kinetoTextPrimary = Color(hex: "E2E8F0")
private let kinetoTextSecondary = Color(hex: "64748B")

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
                // Compact left
                Image(systemName: "dumbbell.fill")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(kinevoVioletLight)
            } compactTrailing: {
                // Compact right — current set progress
                let state = context.state
                Text("\(state.setsCompleted)/\(state.totalSets)")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundColor(kinetoTextPrimary)
            } minimal: {
                // Minimal — just icon
                Image(systemName: "dumbbell.fill")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(kinevoVioletLight)
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

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Top Row: Workout name + elapsed timer
            HStack(alignment: .center) {
                HStack(spacing: 6) {
                    Image(systemName: "dumbbell.fill")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(kinevoVioletLight)
                    Text(context.attributes.workoutName)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(kinetoTextPrimary)
                        .lineLimit(1)
                }

                Spacer()

                // Elapsed timer (counts up)
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

            // Progress bar
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
                    Text("\(state.totalSetsCompleted)/\(state.totalSetsOverall) s\u{00E9}ries")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(kinetoTextSecondary)
                }
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
        .padding(16)
        .background(kinevoBackground)
    }
}

// MARK: - Dynamic Island Expanded Views

private struct ExpandedLeading: View {
    let context: ActivityViewContext<WorkoutActivityAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
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

private struct ExpandedTrailing: View {
    let context: ActivityViewContext<WorkoutActivityAttributes>

    private var workoutStartDate: Date {
        Date(timeIntervalSince1970: context.state.workoutStartTimestamp / 1000)
    }

    var body: some View {
        VStack(alignment: .trailing, spacing: 2) {
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
                    }
                }
            }
        }
    }
}
