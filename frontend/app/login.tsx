import React, { useState } from "react";
import {
  View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
  Pressable, ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/auth";
import { useToast, T, TextField, PrimaryButton } from "@/src/ui";
import { colors, spacing, radius, font, shadow, roleLabels } from "@/src/theme";
import { ApiError } from "@/src/api";

const BG = "https://images.unsplash.com/photo-1728046421058-1e1e28e57193?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzB8MHwxfHNlYXJjaHwxfHxtb3NxdWUlMjBpbGx1c3RyYXRpb24lMjBtaW5pbWFsJTIwZ3JlZW58ZW58MHx8fHwxNzg4MzEyNDExfDA&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const { loginEmail, loginGoogle } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) { toast("Lengkapi email dan kata sandi", "error"); return; }
    setLoading(true);
    try {
      await loginEmail(email.trim(), password);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Gagal masuk", "error");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setGoogleLoading(true);
    try {
      await loginGoogle();
    } catch {
      toast("Gagal masuk dengan Google", "error");
    } finally {
      setGoogleLoading(false);
    }
  };

  const fillDemo = () => { setEmail("manager@alfalah.id"); setPassword("manager123"); };

  return (
    <View style={styles.root}>
      <Image source={{ uri: BG }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={["rgba(6,78,59,0.35)", "rgba(10,28,22,0.85)", colors.surfaceInverse]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ paddingTop: insets.top + spacing.xl, paddingHorizontal: spacing.xl, flex: 1, justifyContent: "center" }}>
            <View style={styles.logoBadge}>
              <Ionicons name="moon" size={26} color={colors.brandSecondary} />
            </View>
            <T weight="bold" size={font["2xl"]} color="#fff" style={{ marginTop: spacing.lg }}>
              Baitul Maal Al-Falah
            </T>
            <T color="rgba(255,255,255,0.85)" size={font.lg} style={{ marginTop: spacing.xs }}>
              Sistem Manajemen Masjid Raya Al-Falah Sragen
            </T>
          </View>

          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
            <T weight="bold" size={font.xl}>Masuk</T>
            <T color={colors.muted} style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
              Silakan masuk untuk melanjutkan
            </T>

            <View style={{ gap: spacing.md }}>
              <TextField label="Email" value={email} onChangeText={setEmail} placeholder="nama@alfalah.id"
                keyboardType="email-address" autoCapitalize="none" testID="login-email" />
              <TextField label="Kata Sandi" value={password} onChangeText={setPassword} placeholder="••••••••"
                secureTextEntry testID="login-password" />
            </View>

            <View style={{ marginTop: spacing.lg }}>
              <PrimaryButton label="Masuk" onPress={submit} loading={loading} testID="login-submit" />
            </View>

            <View style={styles.divider}>
              <View style={styles.line} /><T color={colors.muted} size={font.sm}>atau</T><View style={styles.line} />
            </View>

            <Pressable onPress={google} style={styles.googleBtn} testID="login-google">
              {googleLoading ? <ActivityIndicator color={colors.brand} /> : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Ionicons name="logo-google" size={18} color={colors.brand} />
                  <T weight="semibold" color={colors.onSurface}>Masuk dengan Google</T>
                </View>
              )}
            </Pressable>

            <Pressable onPress={fillDemo} style={styles.demoBox} testID="fill-demo">
              <Ionicons name="information-circle-outline" size={16} color={colors.brandSecondary} />
              <T size={font.sm} color={colors.onSurfaceSecondary} style={{ flex: 1 }}>
                Akun demo (data fiktif): manager@alfalah.id / manager123 — ketuk untuk isi otomatis
              </T>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceInverse },
  logoBadge: {
    width: 56, height: 56, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(197,160,89,0.5)",
  },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    padding: spacing.xl, ...shadow.header,
  },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginVertical: spacing.lg },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  googleBtn: {
    height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.surface,
  },
  demoBox: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg,
    backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
});
