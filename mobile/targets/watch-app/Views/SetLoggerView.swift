import SwiftUI

struct SetLoggerView: View {
    @EnvironmentObject var sessionManager: WatchSessionManager
    let exercise: WatchExercise
    let exerciseIndex: Int
    let totalExercises: Int

    @State private var completedSets: Set<Int> = []
    @State private var showRestTimer: Bool = false
    @State private var lastCompletedSetIndex: Int?

    var body: some View {
        VStack(spacing: 0) {
            // Exercise header
            VStack(spacing: 8) {
                Text(exercise.name)
                    .font(.headline)
                    .foregroundColor(.kinevoTextPrimary)
                    .multilineTextAlignment(.center)

                if let weight = exercise.weight {
                    Text("\(Int(weight))kg")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.kinevoViolet)
                }
            }
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity)
            .background(Color.kinevoCard)

            // Sets list
            ScrollView {
                VStack(spacing: 12) {
                    ForEach(0..<exercise.sets, id: \.self) { setIndex in
                        SetRow(
                            setNumber: setIndex + 1,
                            reps: exercise.reps,
                            weight: exercise.weight,
                            isCompleted: completedSets.contains(setIndex),
                            onComplete: {
                                completeSet(setIndex)
                            }
                        )
                    }
                }
                .padding()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.kinevoBg)
        .fullScreenCover(isPresented: $showRestTimer) {
            if let setIndex = lastCompletedSetIndex {
                RestTimerView(
                    duration: exercise.restTime,
                    isPresented: $showRestTimer,
                    setNumber: setIndex + 1
                )
            }
        }
        .onAppear {
            // Pre-populate completed sets from exercise data
            for i in 0..<exercise.completedSets {
                completedSets.insert(i)
            }
        }
    }

    private func completeSet(_ setIndex: Int) {
        guard !completedSets.contains(setIndex) else { return }

        completedSets.insert(setIndex)

        // Send to iPhone
        sessionManager.sendSetComplete(exerciseIndex: exerciseIndex, setIndex: setIndex)

        // Show rest timer if there's rest time and not the last set
        if exercise.restTime > 0 && setIndex < exercise.sets - 1 {
            lastCompletedSetIndex = setIndex
            showRestTimer = true
        }
    }
}

// MARK: - Set Row

struct SetRow: View {
    let setNumber: Int
    let reps: Int
    let weight: Double?
    let isCompleted: Bool
    let onComplete: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            // Set info
            VStack(alignment: .leading, spacing: 4) {
                Text("Série \(setNumber)")
                    .font(.caption)
                    .foregroundColor(.kinevoTextSecondary)

                HStack(spacing: 8) {
                    if let weight = weight {
                        Text("\(Int(weight))kg")
                            .font(.footnote)
                            .foregroundColor(.kinevoTextPrimary)
                    }
                    Text("\(reps) reps")
                        .font(.footnote)
                        .foregroundColor(.kinevoTextPrimary)
                }
            }

            Spacer()

            // Complete button
            Button(action: onComplete) {
                Image(systemName: isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 28))
                    .foregroundColor(isCompleted ? .kinevoSuccess : .kinevoViolet)
            }
            .disabled(isCompleted)
            .opacity(isCompleted ? 0.5 : 1.0)
        }
        .padding(12)
        .background(Color.kinevoCard)
        .cornerRadius(12)
    }
}
