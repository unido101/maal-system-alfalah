import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";
import {
  T, Card, ChipRow, ProgressBar, StatusBadge, Badge, DateField,
  LoadingState, ErrorState, EmptyState, GhostButton, useToast,
} from "@/src/ui";
import { colors, spacing, radius, font, statusColors } from "@/src/theme";
import { formatRupiah, formatCompact, formatDate } from "@/src/format";

const ALL_REPORTS = [
  { key: "fundraising", label: "Fundraising", roles: ["manager", "fundraising"] },
  { key: "donation", label: "Donasi", roles: ["manager", "fundraising"] },
  { key: "program", label: "Program", roles: ["manager", "fundraising"] },
  { key: "expense", label: "Pengeluaran", roles: ["manager"] },
  { key: "financial", label: "Keuangan", roles: ["manager"] },
  { key: "content", label: "Konten", roles: ["manager", "content", "fundraising"] },
];

export default function Reports() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const toast = useToast();
  const available = ALL_REPORTS.filter((r) => r.roles.includes(user?.role || "content"));
  const [type, setType] = useState(available[0]?.key || "content");
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

const handleExport = async (format: string) => {
  try {
    setExporting(format);

    const extension =
      format === "Excel" ? "xlsx" : format.toLowerCase();

    const params = new URLSearchParams();

    if (start) {
      params.append("start", start.slice(0, 10));
    }

    if (end) {
      params.append("end", end.slice(0, 10));
    }

    const query = params.toString();

    const endpoint =
      `/reports/export/${extension}/${type}` +
      (query ? `?${query}` : "");

    /*
     * Ambil file dari backend.
     *
     * PENTING:
     * Untuk sementara kita gunakan api.getBinary().
     * Jika api.ts belum memiliki method ini,
     * kita tambahkan pada langkah berikutnya.
     */

    const response = await api.getBinary(endpoint);

    const filename =
      `laporan-${type}-${new Date()
        .toISOString()
        .slice(0, 10)}.${extension}`;

    const fileUri =
      `${FileSystem.cacheDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(
      fileUri,
      response,
      {
        encoding: FileSystem.EncodingType.Base64,
      }
    );

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
    } else {
      toast(
        `Laporan ${format} berhasil dibuat`,
        "success"
      );
    }

  } catch (e: any) {

    console.error("Export error:", e);

    toast(
      e?.message || `Gagal export ${format}`,
      "error"
    );

  } finally {
    setExporting(null);
  }
};
  

  const load = useCallback(async () => {
    try {
      setError(null);
      const d = await api.get<any>(`/reports/${type}`, {
        start: start ? start.slice(0, 10) : undefined,
        end: end ? end.slice(0, 10) : undefined,
      });
      setData(d);
    } catch (e: any) {
      setError(e?.message);
    } finally {
      setLoading(false);
    }
  }, [type, start, end]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <T weight="bold" size={font.xl}>Laporan</T>
          <Pressable onPress={() => setShowFilter((s) => !s)} testID="toggle-filter"
            style={[styles.filterBtn, (start || end) && { backgroundColor: colors.brandTertiary }]}>
            <Ionicons name="options-outline" size={18} color={colors.brand} />
            <T size={font.sm} weight="semibold" color={colors.brand}>Filter</T>
          </Pressable>
        </View>
      </View>

      <View style={styles.chipWrap}>
        <ChipRow items={available} value={type} onChange={setType} testIDPrefix="report" />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}>
        {showFilter ? (
          <Card style={{ marginBottom: spacing.lg }}>
            <T weight="bold" size={font.base} style={{ marginBottom: spacing.md }}>Rentang Tanggal</T>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ flex: 1 }}><DateField label="Dari" value={start} onChange={setStart} testID="filter-start" /></View>
              <View style={{ flex: 1 }}><DateField label="Sampai" value={end} onChange={setEnd} testID="filter-end" /></View>
            </View>
            <View style={{ marginTop: spacing.md }}>
              <GhostButton label="Reset filter" icon="close" onPress={() => { setStart(null); setEnd(null); }} />
            </View>
          </Card>
        ) : null}

        {/* Export (pending) */}
        <View style={styles.exportRow}>
  {["Excel", "CSV", "PDF"].map((f) => (
    <Pressable
      key={f}
      testID={`export-${f}`}
      onPress={() => handleExport(f)}
      disabled={exporting !== null}
      style={[
        styles.exportBtn,
        exporting === f && { opacity: 0.5 },
      ]}
    >
      <Ionicons
        name="download-outline"
        size={16}
        color={colors.muted}
      />

      <T
        size={font.sm}
        weight="semibold"
        color={colors.onSurfaceSecondary}
      >
        {exporting === f
          ? "Memproses..."
          : f}
      </T>
    </Pressable>
  ))}
</View>

        {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> :
          <ReportBody type={type} data={data} />}
      </ScrollView>
    </View>
  );
}

function ReportBody({ type, data }: { type: string; data: any }) {
  if (!data) return null;

  if (type === "financial") {
    const s = data.summary;
    return (
      <View style={{ gap: spacing.md }}>
        <Card>
          <T color={colors.muted}>Saldo Akhir</T>
          <T weight="bold" size={font["3xl"]} color={s.closing_balance < 0 ? colors.error : colors.brand}>
            {formatRupiah(s.closing_balance)}
          </T>
          <Badge label={s.status} bg={s.status === "DEFICIT" ? "#FDECEC" : "#E7F5EF"}
            fg={s.status === "DEFICIT" ? colors.error : colors.success} style={{ marginTop: spacing.sm }} />
        </Card>
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <SummaryCard label="Total Pemasukan" value={s.total_income} color={colors.success} />
          <SummaryCard label="Total Pengeluaran" value={s.total_expenses} color={colors.error} />
        </View>
        <Card>
          <T weight="bold" style={{ marginBottom: spacing.md }}>Pemasukan per Jenis</T>
          {Object.entries(s.income_by_type).map(([k, v]: any) => (
            <BreakdownRow key={k} label={k} value={v} total={s.total_income} color={colors.success} />
          ))}
        </Card>
        <Card>
          <T weight="bold" style={{ marginBottom: spacing.md }}>Pengeluaran per Kategori</T>
          {Object.keys(s.expense_by_category).length === 0 ? <T color={colors.muted}>Belum ada pengeluaran.</T> :
            Object.entries(s.expense_by_category).map(([k, v]: any) => (
              <BreakdownRow key={k} label={k} value={v} total={s.total_expenses} color={colors.error} />
            ))}
        </Card>
      </View>
    );
  }

  if (type === "program") {
    if (!data.rows?.length) return <EmptyState title="Belum ada program" />;
    return (
      <View style={{ gap: spacing.md }}>
        {data.rows.map((p: any) => (
          <Card key={p.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <T weight="semibold" size={font.base} style={{ flex: 1 }} numberOfLines={1}>{p.name}</T>
              <StatusBadge status={p.status} />
            </View>
            <View style={{ marginTop: spacing.sm }}>
              <ProgressBar value={p.achievement} color={p.achievement >= 100 ? colors.success : colors.brand} />
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                <T size={font.sm} color={colors.muted}>Terkumpul {formatCompact(p.total_raised)}</T>
                <T size={font.sm} weight="semibold" color={colors.brand}>{p.achievement}%</T>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
                <T size={font.sm} color={colors.muted}>Pengeluaran {formatCompact(p.total_expenses)}</T>
                <T size={font.sm} color={colors.muted}>Sisa {formatCompact(p.remaining_funds)}</T>
              </View>
            </View>
          </Card>
        ))}
      </View>
    );
  }

  if (type === "content") {
    return (
      <View style={{ gap: spacing.md }}>
        <Card>
          <T weight="bold" style={{ marginBottom: spacing.md }}>Ringkasan Status Konten ({data.count})</T>
          {Object.keys(data.by_status || {}).length === 0 ? <T color={colors.muted}>Belum ada data.</T> :
            Object.entries(data.by_status).map(([k, v]: any) => (
              <View key={k} style={styles.statRow}>
                <StatusBadge status={k} />
                <T weight="bold">{v}</T>
              </View>
            ))}
        </Card>
      </View>
    );
  }

  // fundraising / donation / expense list-style
  const rows = data.rows || [];
  const isExpense = type === "expense";
  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <T color={colors.muted}>{isExpense ? "Total Pengeluaran" : "Total Donasi (Lunas)"}</T>
        <T weight="bold" size={font["2xl"]} color={isExpense ? colors.error : colors.success}>
          {formatRupiah(data.total)}
        </T>
        {data.count != null ? <T size={font.sm} color={colors.muted}>{data.count} transaksi</T> : null}
      </Card>
      {rows.length === 0 ? <EmptyState title="Tidak ada data pada rentang ini" /> :
        rows.map((r: any) => (
          <Card key={r.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <T weight="semibold" numberOfLines={1}>{isExpense ? r.description : (r.donor_name || "Donatur")}</T>
                <T size={font.sm} color={colors.muted} numberOfLines={1}>
                  {isExpense ? (r.category + (r.program_name ? ` • ${r.program_name}` : "")) : (r.type + (r.program_name ? ` • ${r.program_name}` : ""))}
                </T>
                <T size={font.sm} color={colors.muted}>{formatDate(r.date)}</T>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <T weight="bold" color={isExpense ? colors.error : colors.success}>{formatCompact(r.amount)}</T>
                {!isExpense ? <StatusBadge status={r.payment_status} /> : null}
              </View>
            </View>
          </Card>
        ))}
    </View>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.summaryCard]}>
      <T size={font.sm} color={colors.muted}>{label}</T>
      <T weight="bold" size={font.lg} color={color} numberOfLines={1}>{formatCompact(value)}</T>
    </View>
  );
}

function BreakdownRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <View style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <T size={font.base}>{label}</T>
        <T size={font.base} weight="semibold">{formatCompact(value)}</T>
      </View>
      <ProgressBar value={pct} color={color} height={6} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  chipWrap: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.sm },
  filterBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, height: 36,
    borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary },
  exportRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.sm },
  exportBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, height: 40,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  pendingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.warning },
  summaryCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border },
  statRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.divider },
});
