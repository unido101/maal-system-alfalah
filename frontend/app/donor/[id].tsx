import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { T, Card, Avatar, Badge, ProgressBar, LoadingState, ErrorState, ScreenHeader } from "@/src/ui";
import { colors, spacing, radius, font, statusColors } from "@/src/theme";
import { formatRupiah, formatCompact, formatDate } from "@/src/format";

export default function DonorDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setError(null); setD(await api.get<any>(`/donors/${id}`)); }
    catch (e: any) { setError(e?.message); }
    finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <ScreenHeader title="Profil Donatur" onBack={() => router.back()} />
      </View>
      {loading ? <LoadingState /> : error || !d ? <ErrorState message={error || undefined} onRetry={load} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
          <Card style={{ alignItems: "center" }}>
            <Avatar name={d.name} size={72} />
            <T weight="bold" size={font.xl} style={{ marginTop: spacing.md }}>{d.name}</T>
            <T color={colors.muted}>{d.phone || "Tanpa nomor telepon"}</T>
            {d.notes ? <T size={font.sm} color={colors.muted} style={{ marginTop: 4 }}>{d.notes}</T> : null}
          </Card>

          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <MiniCard label="Total Donasi" value={formatCompact(d.total_donations)} color={colors.success} icon="cash" />
            <MiniCard label="Jumlah Donasi" value={String(d.donation_count)} color={colors.brand} icon="repeat" />
          </View>
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Ionicons name="calendar-outline" size={18} color={colors.muted} />
              <T color={colors.muted}>Donasi Terakhir</T>
              <T weight="semibold" style={{ flex: 1, textAlign: "right" }}>{formatDate(d.last_donation)}</T>
            </View>
          </Card>

          <T weight="bold" size={font.lg} style={{ marginTop: spacing.sm }}>Riwayat Donasi</T>
          {d.donations?.length ? d.donations.map((x: any) => {
            const sc = statusColors[x.payment_status];
            return (
              <Card key={x.id}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <T weight="semibold">{x.type}</T>
                    <T size={font.sm} color={colors.muted} numberOfLines={1}>{x.program_name || "Umum"} • {formatDate(x.date)}</T>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <T weight="bold" color={x.payment_status === "Paid" ? colors.success : colors.onSurface}>{formatCompact(x.amount)}</T>
                    <Badge label={sc?.label || x.payment_status} bg={sc?.bg || colors.surfaceTertiary} fg={sc?.fg || colors.muted} />
                  </View>
                </View>
              </Card>
            );
          }) : <Card><T color={colors.muted}>Belum ada donasi.</T></Card>}
        </ScrollView>
      )}
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
  miniCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  miniIcon: { width: 34, height: 34, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
});
