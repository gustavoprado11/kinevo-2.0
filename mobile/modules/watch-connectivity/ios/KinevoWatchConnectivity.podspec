Pod::Spec.new do |s|
  s.name           = 'KinevoWatchConnectivity'
  s.version        = '1.0.0'
  s.summary        = 'Expo module for WatchConnectivity framework'
  s.description    = 'Bridge between React Native and Apple Watch using WatchConnectivity'
  s.author         = 'Kinevo'
  s.homepage       = 'https://kinevo.com'
  s.license        = 'MIT'
  s.platform       = :ios, '13.0'
  s.swift_version  = '5.4'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
end
