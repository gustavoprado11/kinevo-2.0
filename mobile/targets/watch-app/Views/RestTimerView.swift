import SwiftUI

struct RestTimerView: View {
    let duration: Int // seconds
    @Binding var isPresented: Bool
    let setNumber: Int

    @State private var endDate: Date

    init(duration: Int, isPresented: Binding<Bool>, setNumber: Int) {
        self.duration = duration
        self._isPresented = isPresented
        self.setNumber = setNumber
        self._endDate = State(initialValue: Date().addingTimeInterval(TimeInterval(duration)))
    }

    var body: some View {
        ZStack {
            Color.kinevoBg.ignoresSafeArea()

            VStack(spacing: 24) {
                Text("Descanso")
                    .font(.caption)
                    .foregroundColor(.kinevoTextSecondary)

                // Native countdown timer with progress circle
                ZStack {
                    // Progress circle background
                    Circle()
                        .stroke(Color.kinevoCard, lineWidth: 8)
                        .frame(width: 120, height: 120)

                    // Progress circle foreground (animated via timer)
                    Circle()
                        .trim(from: 0, to: progressValue)
                        .stroke(
                            Color.kinevoViolet,
                            style: StrokeStyle(lineWidth: 8, lineCap: .round)
                        )
                        .rotationEffect(.degrees(-90))
                        .frame(width: 120, height: 120)

                    // Native countdown text
                    Text(timerInterval: Date()...endDate, countsDown: true)
                        .font(.system(size: 36, weight: .ultraLight, design: .rounded))
                        .foregroundColor(.kinevoTextPrimary)
                        .monospacedDigit()
                }

                Text("Série \(setNumber) concluída")
                    .font(.caption2)
                    .foregroundColor(.kinevoTextSecondary)

                // Skip button
                Button(action: {
                    isPresented = false
                }) {
                    HStack {
                        Image(systemName: "forward.fill")
                            .font(.system(size: 14))
                        Text("Pular")
                            .font(.footnote)
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Color.kinevoCard)
                    .foregroundColor(.kinevoTextPrimary)
                    .cornerRadius(10)
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 40)
            }
        }
        .onAppear {
            // Auto-dismiss after duration
            DispatchQueue.main.asyncAfter(deadline: .now() + TimeInterval(duration)) {
                isPresented = false
            }
        }
    }

    private var progressValue: CGFloat {
        let elapsed = Date().timeIntervalSince(Date().addingTimeInterval(-TimeInterval(duration)))
        let progress = elapsed / TimeInterval(duration)
        return max(0, min(1, CGFloat(1 - progress)))
    }
}
