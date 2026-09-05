import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import {
  T, Card, SearchBar, LoadingState, ErrorState, EmptyState, Fab, ScreenHeader, ConfirmSheet, useToast,
} from "@/src/ui";
import { colors, spacing, radius, font } from "@/src/theme";
import { formatRupiah, formatCompact, formatDate } from "@/src/format";

export default function ListScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [delId, setDelId] = useState<string | null>(null);

  const total = items.reduce((s, e) => s + (e.amount || 0), 0);

  const load = useCallback(async () => {
    try { setError(null); setItems(await api.get<any[]>("/expenses", { q: q || undefined })); }
    catch (e: any) { setError(e?.message); }
    finally { setLoading(false); }
  }, [q]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const del = async () => {
    if (!delId) return;
    try { await api.del(`/expenses/${delId}`); toast("Pengeluaran dihapus", "success"); load(); }
    catch (e: any) { toast(e?.message || "Gagal", "error"); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <ScreenHeader title="Pengeluaran" onBack={() => router.back()} subtitle={`Total: ${formatRupiah(total)}`} />
        <View style={{ marginTop: spacing.md }}>
          <SearchBar value={q} onChangeText={setQ} placeholder="Cari pengeluaran..." testID="expense-search" />
        </View>
      </View>

      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : items.length === 0 ? (
        <EmptyState icon="wallet-outline" title="Belum ada pengeluaran" subtitle="Catat pengeluaran dengan tombol +." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.md, gap: spacing.md, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Card testID={`expense-${item.id}`}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1, paddingRight: spacing.sm }}>
                  <T weight="semibold" numberOfLines={2}>{item.description}</T>
                  <T size={font.sm} color={colors.muted}>{item.category}{item.program_name ? ` • ${item.program_name}` : ""}</T>
                  <T size={font.sm} color={colors.muted}>{formatDate(item.date)} • {item.payment_method}</T>
                </View>
                <View style={{ alignItems: "flex-end", gap: spacing.sm }}>
                  <T weight="bold" size={font.lg} color={colors.error}>{formatCompact(item.amount)}</T>
                  <Pressable onPress={() => setDelId(item.id)} testID={`del-expense-${item.id}`}>
                    <Ionicons name="trash-outline" size={18} color={colors.muted} />
                  </Pressable>
                </View>
              </View>
            </Card>
          )}
        />
      )}

      <Fab testID="add-expense-fab" onPress={() => router.push("/create/expense")} bottom={insets.bottom + 20} />
      <ConfirmSheet open={!!delId} onClose={() => setDelId(null)} onConfirm={del}
        title="Hapus pengeluaran?" message="Data akan dihapus dari catatan keuangan." />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
});
