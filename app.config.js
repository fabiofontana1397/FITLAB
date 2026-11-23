// Extends app.json with what depends on environment variables.
//
// Google Sign-In on iOS needs the "reversed" iOS client id as a URL scheme. It comes from
// EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID (xxxx.apps.googleusercontent.com → com.googleusercontent.apps.xxxx): without
// it the plugin is left out and the Google button stays hidden (see src/lib/auth/social.ts).
module.exports = ({ config }) => {
  // Public client id of the "FitLab iOS" OAuth client (Google Cloud project fitlab-515611); the env variable overrides it.
  const iosClientId =
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '703333923406-thbda8kun5rt1ps35v20j6n047isbt14.apps.googleusercontent.com';
  if (!iosClientId) return config;
  const iosUrlScheme = `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}`;
  return { ...config, plugins: [...(config.plugins ?? []), ['@react-native-google-signin/google-signin', { iosUrlScheme }]] };
};
