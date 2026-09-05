import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/src/auth";
import { T, Card, Avatar, Badge, ConfirmSheet, BottomSheet } from "@/src/ui";
import { colors, spacing, radius, font, roleLabels } from "@/src/theme";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [showRole, setShowRole] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const isManager = user?.role === "manager";

  const roleDesc: Record<string, string[]> = {
    manager: ["Akses penuh ke seluruh modul", "Dashboard, Konten, Fundraising, Keuangan", "Laporan & Manajemen Pengguna"],
    content: ["Tugas konten & brief", "Checklist & kalender", "Tidak dapat mengakses data keuangan"],
    fundraising: ["Donasi, donatur & program", "Progress fundraising", "Akses keuangan sesuai peran"],
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <LinearGradient colors={[colors.brand, "#053B2C"]} style={[styles.header, { paddingTop: insets.top + spacing.xl }]}>
        <View style={{ alignItems: "center" }}>
          <View style={styles.avatarRing}>
            <Avatar name={user?.name} size={76} />
          </View>
          <T weight="bold" size={font.xl} color="#fff" style={{ marginTop: spacing.md }}>{user?.name}</T>
          <T color="rgba(255,255,255,0.8)" size={font.base}>{user?.email}</T>
          <View style={{ marginTop: spacing.sm }}>
            <Badge label={roleLabels[user?.role || "content"]} bg="rgba(197,160,89,0.25)" fg={colors.brandSecondary} />
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}>
        <Card style={{ padding: 0 }}>
          {isManager ? (
            <Row icon="people" label="Manajemen Pengguna" onPress={() => router.push("/users")} testID="row-users" />
          ) : null}
          {isManager ? (
            <Row icon="wallet" label="Pengeluaran" onPress={() => router.push("/list/expense")} testID="row-expenses" />
          ) : null}
          <Row icon="shield-checkmark" label="Info Peran & Hak Akses" onPress={() => setShowRole(true)} testID="row-role" />
          <Row icon="information-circle" label="Tentang Aplikasi" onPress={() => setShowAbout(true)} testID="row-about" last />
        </Card>

        <View style={{ marginTop: spacing.lg }}>
          <Pressable onPress={() => setConfirmLogout(true)} style={styles.logoutBtn} testID="logout-btn">
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <T weight="semibold" color={colors.error}>Keluar</T>
          </Pressable>
        </View>

        <T size={font.sm} color={colors.muted} style={{ textAlign: "center", marginTop: spacing.xl }}>
          Baitul Maal Al-Falah v1.0{"\n"}Masjid Raya Al-Falah Sragen
        </T>
        <View style={styles.demoNote}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.warning} />
          <T size={font.sm} color={colors.onSurfaceSecondary} style={{ flex: 1 }}>
            Semua data di aplikasi ini adalah data contoh fiktif untuk pengembangan.
          </T>
        </View>
      </ScrollView>

      <ConfirmSheet open={confirmLogout} onClose={() => setConfirmLogout(false)} onConfirm={logout}
        title="Keluar dari akun?" message="Anda perlu masuk kembali untuk mengakses aplikasi."
        confirmLabel="Keluar" />

      <BottomSheet open={showRole} onClose={() => setShowRole(false)} title={`Peran: ${roleLabels[user?.role || "content"]}`}>
        <View style={{ gap: spacing.sm }}>
          {(roleDesc[user?.role || "content"] || []).map((d, i) => (
            <View key={i} style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <T style={{ flex: 1 }}>{d}</T>
            </View>
          ))}
        </View>
      </BottomSheet>

      <BottomSheet open={showAbout} onClose={() => setShowAbout(false)} title="Tentang Aplikasi">
        <T color={colors.onSurfaceSecondary} style={{ lineHeight: 22 }}>
          Sistem manajemen internal Baitul Maal & Media Masjid Raya Al-Falah Sragen. Membantu pengelolaan
          konten, fundraising, donasi, program, dan keuangan dalam satu tempat.{"\n\n"}
          Prinsip: Data → Informasi → Keputusan → Aksi.
        </T>
      </BottomSheet>
    </View>
  );
}

function Row({ icon, label, onPress, last, testID }:
  { icon: any; label: string; onPress: () => void; last?: boolean; testID?: string }) {
  return (
    <Pressable onPress={onPress} testID={testID}
      style={({ pressed }) => [styles.row, !last && styles.rowBorder, { backgroundColor: pressed ? colors.surfaceSecondary : "transparent" }]}>
      <View style={styles.rowIcon}><Ionicons name={icon} size={18} color={colors.brand} /></View>
      <T style={{ flex: 1 }} weight="medium">{label}</T>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  avatarRing: { padding: 4, borderRadius: 44, borderWidth: 2, borderColor: "rgba(197,160,89,0.6)" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowIcon: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: "#F3D0D0", backgroundColor: "#FDF3F3" },
  demoNote: { flexDirection: "row", gap: spacing.sm, alignItems: "center", marginTop: spacing.lg,
    padding: spacing.md, backgroundColor: "#FEF9F0", borderRadius: radius.md, borderWidth: 1, borderColor: "#F5E4C3" },
});
