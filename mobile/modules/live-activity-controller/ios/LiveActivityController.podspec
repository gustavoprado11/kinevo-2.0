Pod::Spec.new do |s|
  s.name           = 'LiveActivityController'
  s.version        = '1.0.0'
  s.summary        = 'Expo module for iOS Live Activities control'
  s.description    = 'Bridge between React Native and iOS ActivityKit for workout Live Activities'
  s.homepage       = 'https://github.com/gustavoprado11/kinevo-2.0'
  s.license        = 'MIT'
  s.author         = 'Kinevo'
  s.source         = { git: '' }
  s.swift_version  = '5.9'

  # Match the app's minimum deployment target.
  # ActivityKit availability is handled with @available(iOS 16.1, *) guards in Swift.
  s.ios.deployment_target = '15.1'

  s.source_files   = '**/*.swift'
  s.dependency 'ExpoModulesCore'
end
