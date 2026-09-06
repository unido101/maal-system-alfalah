import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, Pressable, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";
import { T, Card, LoadingState, ErrorState } from "@/src/ui";
import { colors, spacing, radius, font, shadow } from "@/src/theme";
import { greeting, todayLong, formatCompact, formatRupiah } from "@/src/format";

type Dash = any;

const QUICK_ACTIONS: Record<string, { key: string; label: string; icon: string; color: string }[]> = {
  manager: [
    { key: "task", label: "Tugas", icon: "add-circle", color: colors.brand },
    { key: "donation", label: "Donasi", icon: "heart", color: colors.success },
    { key: "program", label: "Program", icon: "flag", color: colors.brandSecondary },
    { key: "ai", label: "AI Konten", icon: "sparkles", color: colors.info },
  ],
  fundraising: [
    { key: "task", label: "Tugas", icon: "add-circle", color: colors.brand },
    { key: "donation", label: "Donasi", icon: "heart", color: colors.success },
    { key: "program", label: "Program", icon: "flag", color: colors.brandSecondary },
  ],
  content: [
    { key: "task", label: "Tugas", icon: "add-circle", color: colors.brand },
    { key: "ai", label: "AI Konten", icon: "sparkles", color: colors.info },
  ],
};

export default function Home() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const d = await api.get<Dash>("/dashboard");
      setData(d);
    } catch (e: any) {
      setError(e?.message || "Gagal memuat");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const actions = QUICK_ACTIONS[user?.role || "content"] || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing["2xl"] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient colors={[colors.brand, "#053B2C"]} style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <T color="rgba(255,255,255,0.8)" size={font.base}>{greeting()},</T>
              <T weight="bold" size={font.xl} color="#fff" numberOfLines={1}>Assalamu'alaikum, {user?.name?.split(" ")[0]}</T>
              <T color="rgba(255,255,255,0.7)" size={font.sm} style={{ marginTop: 2 }}>{todayLong()}</T>
            </View>
            <Pressable onPress={() => router.push("/(tabs)/profile")} style={styles.avatarBtn} testID="header-avatar">
              <T weight="bold" color="#fff">{(user?.name || "?").charAt(0).toUpperCase()}</T>
            </Pressable>
          </View>

          {/* Balance / Month card */}
          {data && (data.finance || data.fundraising) ? (
            <View style={styles.balanceCard}>
              {data.finance ? (
                <>
                  <T color="rgba(255,255,255,0.85)" size={font.sm}>Saldo Kas Saat Ini</T>
                  <T weight="bold" size={font["3xl"]} color="#fff" style={{ marginTop: 2 }}>
                    {formatRupiah(data.finance.closing_balance)}
                  </T>
                  <View style={{ flexDirection: "row", gap: spacing.xl, marginTop: spacing.md }}>
                    <MiniStat label="Pemasukan" value={formatCompact(data.finance.total_income)} up />
                    <MiniStat label="Pengeluaran" value={formatCompact(data.finance.total_expenses)} />
                    <View style={styles.statusPill}>
                      <T size={font.sm} weight="bold" color={colors.brand}>{data.finance.status}</T>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <T color="rgba(255,255,255,0.85)" size={font.sm}>Donasi Bulan Ini</T>
                  <T weight="bold" size={font["3xl"]} color="#fff" style={{ marginTop: 2 }}>
                    {formatRupiah(data.fundraising.month_total)}
                  </T>
                  <View style={{ flexDirection: "row", gap: spacing.xl, marginTop: spacing.md }}>
                    <MiniStat label="Target" value={formatCompact(data.fundraising.monthly_target)} />
                    <MiniStat label="Capaian" value={`${data.fundraising.achievement}%`} up />
                    <MiniStat label="Donatur" value={String(data.fundraising.donor_count)} />
                  </View>
                </>
              )}
            </View>
          ) : null}
        </LinearGradient>

        {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : data ? (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: spacing.lg }}>
            {/* Quick actions */}
            <View>
              <T weight="bold" size={font.lg} style={{ marginBottom: spacing.md }}>Aksi Cepat</T>
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                {actions.map((a) => (
                  <Pressable key={a.key} testID={`quick-${a.key}`} onPress={() => router.push(a.key === "ai" ? "/ai" : `/create/${a.key}`)}
                    style={styles.quickAction}>
                    <View style={[styles.quickIcon, { backgroundColor: a.color + "1A" }]}>
                      <Ionicons name={a.icon as any} size={22} color={a.color} />
                    </View>
                    <T size={font.sm} weight="medium" style={{ marginTop: spacing.xs }}>{a.label}</T>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Perlu perhatian */}
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.md }}>
                <Ionicons name="alert-circle" size={18} color={colors.warning} />
                <T weight="bold" size={font.lg}>Perlu Perhatian</T>
              </View>
              {data.attention?.length ? (
                <FlatList
                  data={data.attention}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(_, i) => String(i)}
                  contentContainerStyle={{ gap: spacing.md }}
                  renderItem={({ item }) => (
  <Pressable
    onPress={() => {
      const text = String(item.text || "").toLowerCase();

      if (text.includes("tugas melewati deadline")) {
        router.push("/(tabs)/content");
        return;
      }

      if (text.includes("konten menunggu review")) {
        router.push("/(tabs)/content");
        return;
      }

      if (text.includes("donasi menunggu konfirmasi")) {
        router.push("/(tabs)/fundraising");
        return;
      }

      if (text.includes("program") && text.includes("belum mencapai")) {
        router.push("/(tabs)/fundraising");
        return;
      }
    }}
    style={[
      styles.attentionCard,
      {
        borderLeftColor:
          item.type === "warning" ? colors.warning : colors.info,
      },
    ]}
  >
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
      }}
    >
      <Ionicons
        name={item.type === "warning" ? "warning" : "information-circle"}
        size={20}
        color={item.type === "warning" ? colors.warning : colors.info}
      />

      <Ionicons
        name="chevron-forward"
        size={18}
        color={colors.muted}
      />
    </View>

    <T
      size={font.base}
      weight="medium"
      style={{ marginTop: spacing.sm }}
      numberOfLines={3}
    >
      {item.text}
    </T>
  </Pressable>
)}
                />
              ) : (
                <Card><T color={colors.muted}>Tidak ada hal yang perlu perhatian. Alhamdulillah 🌙</T></Card>
              )}
            </View>

            {/* TODAY */}
            <Section title="Hari Ini">
  <Kpi
    icon="today"
    label="Tugas Hari Ini"
    value={data.today.tasks_today}
    color={colors.brand}
    onPress={() => router.push("/(tabs)/content")}
  />

  <Kpi
    icon="alarm"
    label="Tugas Telat"
    value={data.today.overdue_tasks}
    color={colors.error}
    onPress={() => router.push("/(tabs)/content")}
  />
  </Section>

            {/* FUNDRAISING */}
            {data.fundraising ? (
              <Section title="Fundraising">
                <Kpi icon="trending-up" label="Donasi Bulan Ini" value={formatCompact(data.fundraising.month_total)} color={colors.success} isText />
                <Kpi icon="flag-outline" label="Target Bulanan" value={formatCompact(data.fundraising.monthly_target)} color={colors.brand} isText />
                <Kpi icon="ribbon" label="Capaian" value={`${data.fundraising.achievement}%`} color={colors.brandSecondary} isText />
                <Kpi icon="people" label="Donatur" value={data.fundraising.donor_count} color={colors.info} />
              </Section>
            ) : null}

            {/* CONTENT */}
            <Section title="Konten">
              <Kpi icon="construct" label="Diproduksi" value={data.content.in_production} color={colors.warning} />
              <Kpi icon="eye" label="Menunggu Review" value={data.content.pending_review} color={colors.info} />
              <Kpi icon="checkmark-done" label="Terbit" value={data.content.published} color={colors.success} />
              <Kpi icon="alarm-outline" label="Konten Telat" value={data.content.overdue} color={colors.error} />
            </Section>

            {/* FINANCE */}
            {data.finance ? (
              <Section title="Keuangan">
                <Kpi icon="arrow-down-circle" label="Pemasukan" value={formatCompact(data.finance.total_income)} color={colors.success} isText />
                <Kpi icon="arrow-up-circle" label="Pengeluaran" value={formatCompact(data.finance.total_expenses)} color={colors.error} isText />
                <Kpi icon="wallet" label="Saldo" value={formatCompact(data.finance.closing_balance)} color={colors.brand} isText />
                <Kpi icon="stats-chart" label="Status" value={data.finance.status} color={data.finance.status === "DEFICIT" ? colors.error : colors.success} isText />
              </Section>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function MiniStat({ label, value, up }: { label: string; value: string; up?: boolean }) {
  return (
    <View>
      <T color="rgba(255,255,255,0.7)" size={font.sm}>{label}</T>
      <T color={up ? colors.brandSecondary : "#fff"} weight="bold" size={font.base} style={{ marginTop: 2 }}>{value}</T>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <T weight="bold" size={font.lg} style={{ marginBottom: spacing.md }}>{title}</T>
      <View style={styles.kpiGrid}>{children}</View>
    </View>
  );
}

function Kpi({
  icon,
  label,
  value,
  color,
  isText,
  onPress,
}: {
  icon: string;
  label: string;
  value: any;
  color: string;
  isText?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={styles.kpiCard}
    >
      <View style={[styles.kpiIcon, { backgroundColor: color + "1A" }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>

      <T
        weight="bold"
        size={isText ? font.lg : font["2xl"]}
        style={{ marginTop: spacing.sm }}
        numberOfLines={1}
      >
        {value}
      </T>

      <T color={colors.muted} size={font.sm} numberOfLines={1}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },

  avatarBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.md,
  },

  balanceCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: "#fff",
    alignSelf: "flex-start",
  },

  quickAction: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 82,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.sm,
  },

  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  attentionCard: {
    width: 260,
    minHeight: 120,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderLeftWidth: 4,
    ...shadow.sm,
  },

  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },

  kpiCard: {
    width: "47%",
    minHeight: 110,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.sm,
  },

  kpiIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});