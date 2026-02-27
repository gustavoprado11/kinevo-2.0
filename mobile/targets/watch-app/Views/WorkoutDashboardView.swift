import SwiftUI

/// Workout metrics page showing heart rate, active calories, and elapsed time.
/// Displayed as a vertical page below the exercise carousel.
struct WorkoutDashboardView: View {
  let workoutStartDate: Date
  @EnvironmentObject private var healthKitManager: HealthKitManager

  var body: some View {
    VStack(spacing: 10) {
      // Heart Rate
      MetricCard(
        icon: "heart.fill",
        iconColor: .red,
        value: healthKitManager.heartRate > 0
          ? "\(Int(healthKitManager.heartRate))"
          : "--",
        unit: "BPM"
      )

      // Active Calories
      MetricCard(
        icon: "flame.fill",
        iconColor: .orange,
        value: "\(Int(healthKitManager.activeCalories))",
        unit: "KCAL"
      )

      // Elapsed Time
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
          .font(.system(size: 24, weight: .bold, design: .rounded))
          .monospacedDigit()
          .foregroundStyle(.white)

          Text("Tempo")
            .font(.system(size: 10))
            .foregroundStyle(.secondary)
        }

        Spacer()
      }
      .padding(.horizontal, 10)
      .padding(.vertical, 8)
      .background(
        RoundedRectangle(cornerRadius: 10, style: .continuous)
          .fill(Color.kinevoCard)
      )
    }
    .padding(.horizontal, 8)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.black.edgesIgnoringSafeArea(.all))
  }
}

// MARK: - MetricCard

private struct MetricCard: View {
  let icon: String
  let iconColor: Color
  let value: String
  let unit: String

  var body: some View {
    HStack(spacing: 10) {
      Image(systemName: icon)
        .font(.system(size: 18))
        .foregroundStyle(iconColor)
        .frame(width: 24)

      HStack(alignment: .firstTextBaseline, spacing: 3) {
        Text(value)
          .font(.system(size: 24, weight: .bold, design: .rounded))
          .foregroundStyle(.white)
        Text(unit)
          .font(.system(size: 11, weight: .medium))
          .foregroundStyle(.secondary)
      }

      Spacer()
    }
    .padding(.horizontal, 10)
    .padding(.vertical, 8)
    .background(
      RoundedRectangle(cornerRadius: 10, style: .continuous)
        .fill(Color.kinevoCard)
    )
  }
}
