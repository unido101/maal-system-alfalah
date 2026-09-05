import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import {
  T, Card, StatusBadge, Badge, ProgressBar, SearchBar,
  LoadingState, ErrorState, EmptyState, Fab, Avatar,
} from "@/src/ui";
import { colors, spacing, radius, font, statusColors } from "@/src/theme";
import { formatRupiah, formatCompact, formatDate } from "@/src/format";

const TABS = [
  { key: "program", label: "Program" },
  { key: "donation", label: "Donasi" },
  { key: "donor", label: "Donatur" },
];

export default function Fundraising() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<"program" | "donation" | "donor">("program");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const path = tab === "program" ? "/programs" : tab === "donation" ? "/donations" : "/donors";
      const data = await api.get<any[]>(path, { q: q || undefined });
      setItems(data);
    } catch (e: any) {
      setError(e?.message);
    } finally {
      setLoading(false);
    }
  }, [tab, q]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const fabAction = () => {
    if (tab === "program") router.push("/create/program");
    else if (tab === "donation") router.push("/create/donation");
    else router.push("/create/donor");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <T weight="bold" size={font.xl}>Fundraising</T>
        <View style={styles.segment}>
          {TABS.map((t) => (
            <Pressable key={t.key} testID={`fr-tab-${t.key}`} onPress={() => { setTab(t.key as any); setQ(""); }}
              style={[styles.segBtn, tab === t.key && styles.segActive]}>
              <T weight="semibold" size={font.base} color={tab === t.key ? "#fff" : colors.onSurfaceSecondary}>{t.label}</T>
            </Pressable>
          ))}
        </View>
        <View style={{ marginTop: spacing.md }}>
          <SearchBar value={q} onChangeText={setQ} placeholder={`Cari ${TABS.find(t => t.key === tab)?.label.toLowerCase()}...`} testID="fr-search" />
        </View>
      </View>

      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : items.length === 0 ? (
        <EmptyState icon="heart-outline" title={`Belum ada ${TABS.find(t => t.key === tab)?.label.toLowerCase()}`}
          subtitle="Tambahkan data baru dengan tombol +." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.md, gap: spacing.md, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) =>
            tab === "program" ? <ProgramCard p={item} onPress={() => router.push(`/program/${item.id}`)} />
              : tab === "donation" ? <DonationRow d={item} />
                : <DonorRow d={item} onPress={() => router.push(`/donor/${item.id}`)} />
          }
        />
      )}

      <Fab testID="fr-fab" onPress={fabAction} bottom={insets.bottom + 20} />
    </View>
  );
}

export function ProgramCard({ p, onPress }: { p: any; onPress: () => void }) {
  return (
    <Card onPress={onPress} testID={`program-card-${p.id}`}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1, paddingRight: spacing.sm }}>
          <T weight="semibold" size={font.lg} numberOfLines={1}>{p.name}</T>
          <T size={font.sm} color={colors.muted}>{p.category}</T>
        </View>
        <StatusBadge status={p.status} />
      </View>
      <View style={{ marginTop: spacing.md }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
          <T size={font.base} weight="semibold" color={colors.brand}>{formatCompact(p.total_raised)}</T>
          <T size={font.sm} color={colors.muted}>dari {formatCompact(p.target)}</T>
        </View>
        <ProgressBar value={p.achievement} color={p.achievement >= 100 ? colors.success : colors.brand} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
          <T size={font.sm} weight="semibold" color={colors.brandSecondary}>{p.achievement}% tercapai</T>
          <T size={font.sm} color={colors.muted}>{p.donation_count} donasi</T>
        </View>
      </View>
    </Card>
  );
}

function DonationRow({ d }: { d: any }) {
  const sc = statusColors[d.payment_status];
  return (
    <Card testID={`donation-row-${d.id}`}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flex: 1, paddingRight: spacing.sm }}>
          <T weight="semibold" size={font.base} numberOfLines={1}>{d.donor_name || "Donatur"}</T>
          <T size={font.sm} color={colors.muted} numberOfLines={1}>{d.type}{d.program_name ? ` • ${d.program_name}` : ""}</T>
          <T size={font.sm} color={colors.muted}>{formatDate(d.date)} • {d.payment_method}</T>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <T weight="bold" size={font.lg} color={d.payment_status === "Paid" ? colors.success : colors.onSurface}>
            {formatCompact(d.amount)}
          </T>
          <Badge label={sc?.label || d.payment_status} bg={sc?.bg || colors.surfaceTertiary} fg={sc?.fg || colors.muted} />
        </View>
      </View>
    </Card>
  );
}

function DonorRow({ d, onPress }: { d: any; onPress: () => void }) {
  return (
    <Card onPress={onPress} testID={`donor-row-${d.id}`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Avatar name={d.name} size={44} />
        <View style={{ flex: 1 }}>
          <T weight="semibold" size={font.base} numberOfLines={1}>{d.name}</T>
          <T size={font.sm} color={colors.muted}>{d.phone || "Tanpa nomor"} • {d.donation_count} donasi</T>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <T weight="bold" color={colors.brand}>{formatCompact(d.total_donations)}</T>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  segment: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: 4, marginTop: spacing.md },
  segBtn: { flex: 1, height: 38, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  segActive: { backgroundColor: colors.brand },
});
