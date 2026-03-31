import SwiftUI
import WatchKit

/// Workout metrics page showing progress, heart rate, active calories, and elapsed time.
/// Displayed as a vertical page below the exercise carousel.
struct WorkoutDashboardView: View {
  let workoutStartDate: Date
  var onDiscardWorkout: (() -> Void)? = nil
  @EnvironmentObject private var healthKitManager: HealthKitManager
  @EnvironmentObject private var workoutStore: WorkoutExecutionStore

  private var displayPadding: WatchDisplayPadding { WatchDisplayPadding.current }

  var body: some View {
    VStack(spacing: 6) {
      // Workout progress
      progressSection

      // Heart Rate + Calories (side by side)
      HStack(spacing: 6) {
        CompactMetricCard(
          icon: "heart.fill",
          iconColor: .red,
          value: healthKitManager.heartRate > 0
            ? "\(Int(healthKitManager.heartRate))"
            : "--",
          unit: "BPM"
        )
        CompactMetricCard(
          icon: "flame.fill",
          iconColor: .orange,
          value: "\(Int(healthKitManager.activeCalories))",
          unit: "KCAL"
        )
      }

      // Elapsed Time + Discard
      HStack(spacing: 10) {
        Image(systemName: "clock")
          .font(.system(size: 18))
          .foregroundStyle(Color.kinevoViolet)
          .frame(width: 24)

        VStack(alignment: .leading, spacing: 0) {
          Text(
            timerInterval: workoutStartDate...Date.now,
            pauseTime: nil,
            countsDown: false,
            showsHours: true
          )
          .font(.system(size: 22, weight: .bold, design: .rounded))
          .monospacedDigit()
          .foregroundStyle(.white)

          Text("Tempo")
            .font(.system(size: 10))
            .foregroundStyle(.secondary)
        }

        Spacer()
      }
      .padding(.horizontal, 10)
      .padding(.vertical, 6)
      .background(
        RoundedRectangle(cornerRadius: 10, style: .continuous)
          .fill(Color.kinevoCard)
      )

      // Discard button — minimal text to avoid accidental taps
      if let onDiscard = onDiscardWorkout {
        Button(action: onDiscard) {
          Text("Abandonar Treino")
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(.red.opacity(0.7))
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
      }
    }
    .padding(.horizontal, displayPadding.horizontal)
    .padding(.top, displayPadding.top)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.black.edgesIgnoringSafeArea(.all))
  }

  // MARK: - Progress Section

  private var progressSection: some View {
    let completed = workoutStore.totalCompletedSets
    let total: Int = {
      guard let s = workoutStore.state else { return 0 }
      return s.exercises.reduce(0) { $0 + $1.sets.count }
    }()
    let progress = total > 0 ? Double(completed) / Double(total) : 0

    return VStack(spacing: 4) {
      HStack {
        Text("Progresso")
          .font(.system(size: 11, weight: .medium))
          .foregroundStyle(.secondary)
        Spacer()
        Text("\(completed)/\(total) séries")
          .font(.system(size: 11, weight: .bold, design: .rounded))
          .foregroundStyle(.white)
      }

      // Progress bar
      GeometryReader { geo in
        ZStack(alignment: .leading) {
          RoundedRectangle(cornerRadius: 3)
            .fill(Color.kinevoCard)
            .frame(height: 6)
          RoundedRectangle(cornerRadius: 3)
            .fill(
              LinearGradient(
                colors: [Color.kinevoViolet, Color.kinevoVioletLight],
                startPoint: .leading,
                endPoint: .trailing
              )
            )
            .frame(width: geo.size.width * progress, height: 6)
            .animation(.easeInOut(duration: 0.3), value: progress)
        }
      }
      .frame(height: 6)
    }
    .padding(.horizontal, 10)
    .padding(.vertical, 6)
    .background(
      RoundedRectangle(cornerRadius: 10, style: .continuous)
        .fill(Color.kinevoCard)
    )
  }
}

// MARK: - CompactMetricCard (side-by-side layout)

private struct CompactMetricCard: View {
  let icon: String
  let iconColor: Color
  let value: String
  let unit: String

  var body: some View {
    VStack(spacing: 2) {
      Image(systemName: icon)
        .font(.system(size: 14))
        .foregroundStyle(iconColor)

      HStack(alignment: .firstTextBaseline, spacing: 2) {
        Text(value)
          .font(.system(size: 20, weight: .bold, design: .rounded))
          .foregroundStyle(.white)
        Text(unit)
          .font(.system(size: 9, weight: .medium))
          .foregroundStyle(.secondary)
      }
    }
    .frame(maxWidth: .infinity)
    .padding(.vertical, 8)
    .background(
      RoundedRectangle(cornerRadius: 10, style: .continuous)
        .fill(Color.kinevoCard)
    )
  }
}
