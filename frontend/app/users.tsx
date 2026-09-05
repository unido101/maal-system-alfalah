import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import {
  T, Card, Avatar, Badge, LoadingState, ErrorState, EmptyState, Fab, ScreenHeader,
  BottomSheet, TextField, SelectField, PrimaryButton, ConfirmSheet, useToast,
} from "@/src/ui";
import { colors, spacing, radius, font, roleLabels } from "@/src/theme";

const ROLE_OPTIONS = ["manager", "content", "fundraising"];

export default function Users() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ role: "content" });
  const [saving, setSaving] = useState(false);
  const [delUser, setDelUser] = useState<any>(null);

  const load = useCallback(async () => {
    try { setError(null); setUsers(await api.get<any[]>("/users")); }
    catch (e: any) { setError(e?.message); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openNew = () => { setEditing(null); setForm({ role: "content" }); setSheet(true); };
  const openEdit = (u: any) => { setEditing(u); setForm({ name: u.name, role: u.role }); setSheet(true); };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/users/${editing.id}`, { name: form.name, role: form.role, password: form.password || undefined });
        toast("Pengguna diperbarui", "success");
      } else {
        if (!form.name?.trim() || !form.email?.trim() || !form.password) throw new Error("Lengkapi nama, email, dan kata sandi");
        await api.post("/users", { name: form.name, email: form.email, password: form.password, role: form.role });
        toast("Pengguna ditambahkan", "success");
      }
      setSheet(false);
      load();
    } catch (e: any) { toast(e?.message || "Gagal", "error"); }
    finally { setSaving(false); }
  };

  const del = async () => {
    if (!delUser) return;
    try { await api.del(`/users/${delUser.id}`); toast("Pengguna dihapus", "success"); load(); }
    catch (e: any) { toast(e?.message || "Gagal", "error"); }
  };

  const roleBadgeColor = (r: string) =>
    r === "manager" ? { bg: colors.brandTertiary, fg: colors.brand }
      : r === "fundraising" ? { bg: "#E7F5EF", fg: colors.success }
        : { bg: "#E6F7F4", fg: colors.info };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <ScreenHeader title="Manajemen Pengguna" onBack={() => router.back()} subtitle={`${users.length} pengguna`} />
      </View>

      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : users.length === 0 ? (
        <EmptyState icon="people-outline" title="Belum ada pengguna" />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const rc = roleBadgeColor(item.role);
            return (
              <Card testID={`user-${item.id}`}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <Avatar name={item.name} size={44} uri={item.avatar} />
                  <View style={{ flex: 1 }}>
                    <T weight="semibold" numberOfLines={1}>{item.name}{item.id === user?.id ? " (Anda)" : ""}</T>
                    <T size={font.sm} color={colors.muted} numberOfLines={1}>{item.email}</T>
                    <View style={{ marginTop: 4 }}><Badge label={roleLabels[item.role]} bg={rc.bg} fg={rc.fg} /></View>
                  </View>
                  <View style={{ gap: spacing.md, alignItems: "center" }}>
                    <Pressable onPress={() => openEdit(item)} testID={`edit-user-${item.id}`}><Ionicons name="create-outline" size={20} color={colors.brand} /></Pressable>
                    {item.id !== user?.id ? (
                      <Pressable onPress={() => setDelUser(item)} testID={`del-user-${item.id}`}><Ionicons name="trash-outline" size={20} color={colors.muted} /></Pressable>
                    ) : null}
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}

      <Fab testID="add-user-fab" onPress={openNew} bottom={insets.bottom + 20} />

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title={editing ? "Edit Pengguna" : "Tambah Pengguna"}>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 460 }}>
          <View style={{ gap: spacing.md }}>
            <TextField label="Nama" value={form.name || ""} onChangeText={(v) => setForm((f: any) => ({ ...f, name: v }))} testID="u-name" />
            {!editing ? (
              <TextField label="Email" value={form.email || ""} onChangeText={(v) => setForm((f: any) => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" testID="u-email" />
            ) : null}
            <TextField label={editing ? "Kata Sandi Baru (opsional)" : "Kata Sandi"} value={form.password || ""} onChangeText={(v) => setForm((f: any) => ({ ...f, password: v }))} secureTextEntry testID="u-password" />
            <SelectField label="Peran" value={form.role} options={ROLE_OPTIONS} labelMap={roleLabels} onSelect={(v) => setForm((f: any) => ({ ...f, role: v }))} testID="u-role" />
            <PrimaryButton label="Simpan" onPress={save} loading={saving} testID="save-user" />
          </View>
        </ScrollView>
      </BottomSheet>

      <ConfirmSheet open={!!delUser} onClose={() => setDelUser(null)} onConfirm={del}
        title={`Hapus ${delUser?.name}?`} message="Pengguna tidak akan dapat mengakses aplikasi." />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
});
