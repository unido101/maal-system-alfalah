import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { T, LoadingState, ErrorState, ScreenHeader, ConfirmSheet, useToast } from "@/src/ui";
import { ContentResult } from "@/src/ContentResult";
import { colors, spacing } from "@/src/theme";

export default function ContentItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const load = useCallback(async () => {
    try { setError(null); setItem(await api.get<any>(`/content-items/${id}`)); }
    catch (e: any) { setError(e?.message); }
    finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const duplicate = async () => {
    try { const c = await api.post<any>(`/content-items/${id}/duplicate`); toast("Konten diduplikasi", "success"); router.replace(`/content-item/${c.id}`); }
    catch (e: any) { toast(e?.message || "Gagal", "error"); }
  };

  const del = async () => {
    try { await api.del(`/content-items/${id}`); toast("Konten diarsipkan", "success"); router.back(); }
    catch (e: any) { toast(e?.message || "Gagal", "error"); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <ScreenHeader title="Konten AI" onBack={() => router.back()}
          right={
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable onPress={duplicate} testID="duplicate-content" style={styles.hbtn}><Ionicons name="copy-outline" size={18} color={colors.brand} /></Pressable>
              <Pressable onPress={() => setConfirmDel(true)} testID="delete-content" style={styles.hbtn}><Ionicons name="trash-outline" size={18} color={colors.error} /></Pressable>
            </View>
          } />
      </View>
      {loading ? <LoadingState /> : error || !item ? <ErrorState message={error || undefined} onRetry={load} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
          <ContentResult item={item} onChange={setItem} />
        </ScrollView>
      )}
      <ConfirmSheet open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={del}
        title="Arsipkan konten ini?" message="Konten akan dihapus dari Content Library." confirmLabel="Arsipkan" />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  hbtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
});
