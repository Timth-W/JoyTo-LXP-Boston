import Constants from "expo-constants";
import { useEffect, useRef } from "react";
import { ActivityIndicator, BackHandler, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { en } from "../src/i18n/en";
import { fr } from "../src/i18n/fr";

const copy = (Intl.DateTimeFormat().resolvedOptions().locale.startsWith("fr") ? fr : en).expoPreview;
// Matches the JoyTo tokens in src/app/globals.css.
const colors = { bg: "#f4efe5", navy: "#203b52", muted: "#5e6670", forest: "#2f6b57", surface: "#ffffff" };

function previewUrl() {
  const explicit = process.env.EXPO_PUBLIC_JOYTO_URL?.trim();
  if (explicit) return explicit.startsWith("https://") ? explicit : null;
  const host = Constants.expoConfig?.hostUri?.replace(/:\d+$/, "");
  return host ? `http://${host}:3000/expo-preview` : null;
}

function Preview() {
  const webView = useRef(null);
  const canGoBack = useRef(false);
  const uri = previewUrl();

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!canGoBack.current) return false;
      webView.current?.goBack();
      return true;
    });
    return () => subscription.remove();
  }, []);

  const loading = () => (
    <View style={styles.loading} accessibilityRole="progressbar">
      <ActivityIndicator size="large" color={colors.forest} />
    </View>
  );

  const error = () => (
    <View style={styles.message}>
      <Text style={styles.title}>{copy.unavailable}</Text>
      <Text style={styles.body}>{uri ? copy.networkHelp : copy.urlHelp}</Text>
      {uri ? (
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => webView.current?.reload()}>
          <Text style={styles.buttonText}>{copy.retry}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      {uri ? (
        <WebView
          ref={webView}
          source={{ uri }}
          style={styles.screen}
          startInLoadingState
          renderLoading={loading}
          renderError={error}
          allowsBackForwardNavigationGestures
          allowsInlineMediaPlayback
          mediaCapturePermissionGrantType="prompt"
          onNavigationStateChange={(navigation) => {
            canGoBack.current = navigation.canGoBack;
          }}
        />
      ) : (
        error()
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Preview />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  loading: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  message: { flex: 1, gap: 16, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.bg },
  title: { color: colors.navy, fontWeight: "700", fontSize: 24, textAlign: "center" },
  body: { color: colors.muted, fontSize: 17, textAlign: "center" },
  button: { justifyContent: "center", minHeight: 48, paddingHorizontal: 24, borderRadius: 24, backgroundColor: colors.forest },
  buttonText: { color: colors.surface, fontSize: 17, fontWeight: "700" },
});
