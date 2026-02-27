import SwiftUI
import WatchKit

/// Now Playing page — embeds the system media controls inline.
/// Works with Spotify, Apple Music, or any media app playing on the iPhone.
/// Displayed as a vertical page below the workout dashboard.
///
/// Uses WatchKit's built-in NowPlayingView which provides full play/pause/skip
/// controls and volume (Digital Crown) — no custom implementation needed.
struct KinevoNowPlayingView: View {
  var body: some View {
    WatchKit.NowPlayingView()
  }
}
