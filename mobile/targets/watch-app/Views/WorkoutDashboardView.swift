import SwiftUI
import WatchKit

/// Workout metrics page showing progress, heart rate, active calories, and elapsed time.
/// Displayed as a vertical page below the exercise carousel.
struct WorkoutDashboardView: View {
  let workoutStartDate: Date
  /// When true the workout is being executed on the iPhone and the Watch is just
  /// mirroring activity — local set progress would be stale, so we show a mirror
  /// banner instead of the progress bar.
  var mirroredFromPhone: Bool = false
  var onDiscardWorkout: (() -> Void)? = nil
  @EnvironmentObject private var healthKitManager: HealthKitManager
  @EnvironmentObject private var workoutStore: WorkoutExecutionStore

  private var displayPadding: WatchDisplayPadding { WatchDisplayPadding.current }

  var body: some View {
    // Companion mode adds the mirror banner, which can push the discard button
    // past the bottom edge (a fixed .verticalPage page clips it with no way to
    // scroll). A ScrollView keeps it reachable on every watch size; when the
    // content already fits, nothing scrolls.
    ScrollView {
      VStack(spacing: 6) {
      // Mirror banner when phone-driven; progress now syncs from the phone so it's
      // shown in both modes.
      if mirroredFromPhone {
        mirrorBanner
      }
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
            // B-03: clamp the lower bound to "now". A startedAt in the future (device
            // clock skew, or a stale snapshot) makes lowerBound > upperBound, which
            // traps the ClosedRange initializer and crashes the dashboard.
            timerInterval: min(workoutStartDate, Date.now)...Date.now,
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

      // Discard — visible but understated (the tap only opens a confirmation).
      // A tinted chip reads clearly outdoors, where dim red text on black had
      // effectively vanished.
      if let onDiscard = onDiscardWorkout {
        Button(action: onDiscard) {
          HStack(spacing: 5) {
            Image(systemName: "xmark.circle.fill")
              .font(.system(size: 13))
            Text("Abandonar Treino")
              .font(.system(size: 13, weight: .semibold))
          }
          .foregroundStyle(.red)
          .frame(maxWidth: .infinity)
          .padding(.vertical, 8)
          .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
              .fill(Color.red.opacity(0.16))
          )
        }
        .buttonStyle(.plain)
        .padding(.top, 2)
      }
      }
      .padding(.horizontal, displayPadding.horizontal)
      .padding(.top, displayPadding.top)
      .padding(.bottom, 10)
      .frame(maxWidth: .infinity)
    }
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

  // MARK: - Mirror Banner (phone-driven workout)

  private var mirrorBanner: some View {
    HStack(spacing: 8) {
      Image(systemName: "iphone.gen3")
        .font(.system(size: 14))
        .foregroundStyle(Color.kinevoViolet)
      VStack(alignment: .leading, spacing: 1) {
        Text("Executando no celular")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(.white)
          .lineLimit(1)
          .minimumScaleFactor(0.8)
        Text("Acompanhando sua atividade")
          .font(.system(size: 10))
          .foregroundStyle(.secondary)
          .lineLimit(1)
          .minimumScaleFactor(0.8)
      }
      Spacer(minLength: 0)
    }
    .padding(.horizontal, 10)
    .padding(.vertical, 7)
    .frame(maxWidth: .infinity)
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
