import React from "react";
import {
  ImageBackground,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Dimensions,
  Platform,
  View,
} from "react-native";
import { SPACING } from "../constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
};

export default function ScreenLayout({ children, scroll = true }: Props) {
  const isLargeScreen = SCREEN_WIDTH >= 768 || Platform.OS === "web";

  return (
    <ImageBackground
      source={require("../../assets/wp5907462.webp")}
      style={styles.background}
      resizeMode="cover"
    >
      <SafeAreaView style={[styles.overlay, isLargeScreen && styles.overlayLarge]}>
        {scroll ? (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        ) : (
          <View style={styles.noScroll}>{children}</View>
        )}
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: "100%", height: "100%" },
  overlay: {
    flex: 1,
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.lg,
  },
  overlayLarge: {
    alignSelf: "center",
    maxWidth: 720,
    borderRadius: 16,
    overflow: "hidden",
  },
  scroll: {
    alignItems: "center",
    paddingBottom: 40,
  },
  noScroll: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
});
