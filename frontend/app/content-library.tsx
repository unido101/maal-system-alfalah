import React, { useCallback, useState, useEffect } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import {
  T, Card, Badge, SearchBar, ChipRow, LoadingState, ErrorState, EmptyState, Fab, ScreenHeader, PrimaryButton,
} from "@/src/ui";
import { colors, spacing, radius, font } from "@/src/theme";
import { formatDate } from "@/src/format";

const STATUS_FILTERS = [
  { key: "", label: "Semua" },
  { key: "Draft", label: "Draf" },
  { key: "Approved", label: "Disetujui" },
  { key: "In Production", label: "Produksi" },
  { key: "Published", label: "Terbit" },
  { key: "Archived", label: "Arsip" },
];
const STATUS_LABELS: Record<string, string> = {
  Draft: "Draf", Approved: "Disetujui", "In Production": "Produksi", Published: "Terbit", Archived: "Arsip",
};
const DNA_COLORS: Record<string, string> = {
  "MASJID INI AGAK LAEN": "#0D9488", "BUAT APA?": "#064E3B", "JANGAN... TAPI...": "#D97706",
  "KELIHATANNYA SEPELE": "#059669", "BUKAN TENTANG BANGUNANNYA": "#C5A059", "PESAN UNTUK KAMU": "#DC2626",
};

export default function ContentLibrary() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  useEffect(() => {
    if (user && user.role !== "manager" && user.role !== "content") router.replace("/(tabs)/home");
  }, [user, router]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    try { setError(null); setItems(await api.get<any[]>("/content-items", { q: q || undefined, status: status || undefined })); }
    catch (e: any) { setError(e?.message); }
    finally { setLoading(false); }
  }, [q, status]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <ScreenHeader title="Content Library" onBack={() => router.back()} subtitle={`${items.length} konten AI`} />
        <View style={{ marginTop: spacing.md }}>
          <SearchBar value={q} onChangeText={setQ} placeholder="Cari konten..." testID="cl-search" />
        </View>
      </View>
      <View style={styles.chipWrap}>
        <ChipRow items={STATUS_FILTERS} value={status} onChange={setStatus} testIDPrefix="cl-status" />
      </View>

      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : items.length === 0 ? (
        <EmptyState icon="sparkles" title="Belum ada konten AI"
          subtitle="Gunakan Alfalah AI Assistant untuk membuat konten pertama Anda."
          action={<PrimaryButton label="Buka AI Assistant" icon="sparkles" onPress={() => router.push("/ai")} testID="cl-open-ai" />} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.md, gap: spacing.md, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const dc = DNA_COLORS[item.content_dna] || colors.brand;
            return (
              <Card onPress={() => router.push(`/content-item/${item.id}`)} testID={`cl-card-${item.id}`}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }}>
                  <T weight="semibold" size={font.base} style={{ flex: 1 }} numberOfLines={2}>{item.title}</T>
                  <Badge label={STATUS_LABELS[item.status] || item.status} bg={colors.brandTertiary} fg={colors.brand} />
                </View>
                <View style={[styles.dnaTag, { backgroundColor: dc + "1A", borderColor: dc, marginTop: spacing.sm }]}>
                  <Ionicons name="color-wand" size={12} color={dc} />
                  <T size={font.sm} weight="semibold" color={dc}>{item.content_dna}</T>
                </View>
                <T size={font.sm} color={colors.muted} numberOfLines={2} style={{ marginTop: spacing.sm }}>"{item.hook}"</T>
                <View style={styles.footer}>
                  <T size={font.sm} color={colors.muted}>{formatDate(item.created_at)}{item.related_program_name ? ` • ${item.related_program_name}` : ""}</T>
                  {item.related_task_id ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                      <Ionicons name="link" size={13} color={colors.success} />
                      <T size={font.sm} color={colors.success} weight="semibold">Tugas dibuat</T>
                    </View>
                  ) : null}
                </View>
              </Card>
            );
          }}
        />
      )}
      <Fab testID="cl-fab" icon="sparkles" onPress={() => router.push("/ai")} bottom={insets.bottom + 20} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  chipWrap: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.sm },
  dnaTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1, alignSelf: "flex-start" },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
});
