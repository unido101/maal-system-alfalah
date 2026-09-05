import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import {
  T, Card, StatusBadge, ProgressBar, LoadingState, ErrorState, ScreenHeader,
  ConfirmSheet, useToast, Badge, PrimaryButton,
} from "@/src/ui";
import { colors, spacing, radius, font, statusColors } from "@/src/theme";
import { formatRupiah, formatCompact, formatDate } from "@/src/format";

export default function ProgramDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const canEdit = user?.role === "manager" || user?.role === "fundraising";
  const canAI = user?.role === "manager" || user?.role === "content";
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const load = useCallback(async () => {
    try { setError(null); setP(await api.get<any>(`/programs/${id}`)); }
    catch (e: any) { setError(e?.message); }
    finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const del = async () => {
    try { await api.del(`/programs/${id}`); toast("Program dihapus", "success"); router.back(); }
    catch (e: any) { toast(e?.message || "Gagal", "error"); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <ScreenHeader title="Detail Program" onBack={() => router.back()}
          right={canEdit ? <Pressable onPress={() => setConfirmDel(true)} testID="delete-program" style={styles.delBtn}><Ionicons name="trash-outline" size={20} color={colors.error} /></Pressable> : undefined} />
      </View>

      {loading ? <LoadingState /> : error || !p ? <ErrorState message={error || undefined} onRetry={load} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <T weight="bold" size={font.xl}>{p.name}</T>
                <T size={font.sm} color={colors.muted}>{p.category}{p.pic_name ? ` • PIC ${p.pic_name}` : ""}</T>
              </View>
              <StatusBadge status={p.status} />
            </View>
            {p.description ? <T color={colors.onSurfaceSecondary} style={{ marginTop: spacing.sm, lineHeight: 21 }}>{p.description}</T> : null}
          </Card>

          {canAI ? (
            <Pressable testID="program-ai-btn" onPress={() => router.push(`/ai?program_id=${p.id}&source_type=program`)}
              style={styles.aiCta}>
              <View style={styles.aiIcon}><Ionicons name="sparkles" size={20} color={colors.brandSecondary} /></View>
              <View style={{ flex: 1 }}>
                <T weight="bold" color="#fff" size={font.base}>Buat Konten dengan AI</T>
                <T color="rgba(255,255,255,0.8)" size={font.sm}>AI paham konteks program ini</T>
              </View>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </Pressable>
          ) : null}

          <Card>
            <T color={colors.muted}>Total Terkumpul</T>
            <T weight="bold" size={font["2xl"]} color={colors.brand}>{formatRupiah(p.total_raised)}</T>
            <View style={{ marginTop: spacing.sm }}>
              <ProgressBar value={p.achievement} color={p.achievement >= 100 ? colors.success : colors.brand} height={10} />
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                <T size={font.sm} weight="semibold" color={colors.brandSecondary}>{p.achievement}% dari target</T>
                <T size={font.sm} color={colors.muted}>{formatCompact(p.target)}</T>
              </View>
            </View>
          </Card>

          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <MiniCard label="Pengeluaran" value={formatCompact(p.total_expenses)} color={colors.error} icon="arrow-up-circle" />
            <MiniCard label="Sisa Dana" value={formatCompact(p.remaining_funds)} color={colors.success} icon="wallet" />
          </View>

          <View>
            <T weight="bold" size={font.lg} style={{ marginBottom: spacing.md }}>Donasi Terbaru ({p.donation_count})</T>
            {p.recent_donations?.length ? p.recent_donations.map((d: any) => {
              const sc = statusColors[d.payment_status];
              return (
                <Card key={d.id} style={{ marginBottom: spacing.md }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <T weight="semibold" numberOfLines={1}>{d.donor_name || "Donatur"}</T>
                      <T size={font.sm} color={colors.muted}>{d.type} • {formatDate(d.date)}</T>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <T weight="bold" color={d.payment_status === "Paid" ? colors.success : colors.onSurface}>{formatCompact(d.amount)}</T>
                      <Badge label={sc?.label || d.payment_status} bg={sc?.bg || colors.surfaceTertiary} fg={sc?.fg || colors.muted} />
                    </View>
                  </View>
                </Card>
              );
            }) : <Card><T color={colors.muted}>Belum ada donasi untuk program ini.</T></Card>}
          </View>
        </ScrollView>
      )}

      <ConfirmSheet open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={del}
        title="Hapus program ini?" message="Program akan diarsipkan dan tidak muncul lagi." />
    </View>
  );
}

function MiniCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: any }) {
  return (
    <View style={styles.miniCard}>
      <View style={[styles.miniIcon, { backgroundColor: color + "1A" }]}><Ionicons name={icon} size={18} color={color} /></View>
      <T weight="bold" size={font.lg} style={{ marginTop: spacing.sm }} numberOfLines={1}>{value}</T>
      <T size={font.sm} color={colors.muted}>{label}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  delBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#FDF3F3" },
  miniCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  miniIcon: { width: 34, height: 34, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  aiCta: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.brand,
    borderRadius: radius.md, padding: spacing.lg },
  aiIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
});
