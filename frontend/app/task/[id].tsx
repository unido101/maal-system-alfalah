import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { api } from "@/src/api";
import {
  T, Card, StatusBadge, PriorityBadge, ProgressBar, Avatar, LoadingState, ErrorState,
  BottomSheet, ConfirmSheet, PrimaryButton, ScreenHeader, useToast, TextField, SelectField,
} from "@/src/ui";
import { colors, spacing, radius, font, TASK_STATUSES, PLATFORMS } from "@/src/theme";
import { formatDate, relativeDeadline } from "@/src/format";

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusSheet, setStatusSheet] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [briefSheet, setBriefSheet] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [brief, setBrief] = useState<any>({});

  const load = useCallback(async () => {
    try {
      setError(null);
      const t = await api.get<any>(`/tasks/${id}`);
      setTask(t);
      setBrief(t.brief || {});
    } catch (e: any) {
      setError(e?.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const changeStatus = async (status: string) => {
    setStatusSheet(false);
    try {
      const t = await api.patch<any>(`/tasks/${id}/status`, { status });
      setTask(t);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast(`Status: ${status}`, "success");
    } catch (e: any) { toast(e?.message || "Gagal", "error"); }
  };

  const toggleItem = async (cid: string, completed: boolean) => {
    // optimistic
    setTask((t: any) => {
      const checklist = t.checklist.map((c: any) => c.id === cid ? { ...c, completed } : c);
      const done = checklist.filter((c: any) => c.completed).length;
      return { ...t, checklist, checklist_done: done, checklist_progress: Math.round(done / checklist.length * 100) };
    });
    try { await api.patch(`/tasks/${id}/checklist/${cid}`, { completed }); }
    catch { load(); }
  };

  const addItem = async () => {
    if (!newItem.trim()) return;
    try {
      await api.post(`/tasks/${id}/checklist`, { item: newItem.trim() });
      setNewItem("");
      load();
    } catch (e: any) { toast(e?.message || "Gagal", "error"); }
  };

  const deleteItem = async (cid: string) => {
    try { await api.del(`/tasks/${id}/checklist/${cid}`); load(); }
    catch (e: any) { toast(e?.message || "Gagal", "error"); }
  };

  const saveBrief = async () => {
    try {
      await api.put(`/tasks/${id}/brief`, brief);
      setBriefSheet(false);
      toast("Brief disimpan", "success");
      load();
    } catch (e: any) { toast(e?.message || "Gagal", "error"); }
  };

  const del = async () => {
    try { await api.del(`/tasks/${id}`); toast("Tugas dihapus", "success"); router.back(); }
    catch (e: any) { toast(e?.message || "Gagal", "error"); }
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.surface }}><HeaderBar insets={insets} onBack={() => router.back()} onDelete={() => setConfirmDel(true)} /><LoadingState /></View>;
  if (error || !task) return <View style={{ flex: 1, backgroundColor: colors.surface }}><HeaderBar insets={insets} onBack={() => router.back()} onDelete={() => setConfirmDel(true)} /><ErrorState message={error || undefined} onRetry={load} /></View>;

  const dl = relativeDeadline(task.deadline);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <HeaderBar insets={insets} onBack={() => router.back()} onDelete={() => setConfirmDel(true)} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}>
        <Card>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm, flexWrap: "wrap" }}>
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
            <View style={styles.catBadge}><T size={font.sm} color={colors.onSurfaceSecondary}>{task.category}</T></View>
          </View>
          <T weight="bold" size={font.xl}>{task.title}</T>
          {task.description ? <T color={colors.onSurfaceSecondary} style={{ marginTop: spacing.sm, lineHeight: 21 }}>{task.description}</T> : null}
          <Pressable onPress={() => setStatusSheet(true)} style={styles.statusChange} testID="change-status">
            <Ionicons name="swap-horizontal" size={16} color={colors.brand} />
            <T weight="semibold" color={colors.brand}>Ubah Status</T>
          </Pressable>
        </Card>

        <Card>
          <InfoRow icon="person" label="PIC" value={task.assignee?.name || "Belum ada"} />
          {task.program_name ? <InfoRow icon="flag" label="Program" value={task.program_name} /> : null}
          <InfoRow icon="play" label="Mulai" value={formatDate(task.start_date)} />
          <InfoRow icon="time" label="Deadline" value={`${formatDate(task.deadline)} (${dl.text})`} valueColor={dl.overdue ? colors.error : undefined} last />
        </Card>

        {/* Checklist */}
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
            <T weight="bold" size={font.lg}>Checklist</T>
            <T weight="semibold" color={colors.brand}>{task.checklist_done}/{task.checklist_total} • {task.checklist_progress}%</T>
          </View>
          {task.checklist_total > 0 ? <View style={{ marginBottom: spacing.md }}><ProgressBar value={task.checklist_progress} /></View> : null}
          {task.checklist?.map((c: any) => (
            <View key={c.id} style={styles.checkItem}>
              <Pressable onPress={() => toggleItem(c.id, !c.completed)} testID={`check-${c.id}`}
                style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 }}>
                <Ionicons name={c.completed ? "checkbox" : "square-outline"} size={22} color={c.completed ? colors.success : colors.muted} />
                <T style={{ flex: 1, textDecorationLine: c.completed ? "line-through" : "none" }}
                  color={c.completed ? colors.muted : colors.onSurface}>{c.item}</T>
              </Pressable>
              <Pressable onPress={() => deleteItem(c.id)} testID={`del-check-${c.id}`}>
                <Ionicons name="trash-outline" size={18} color={colors.muted} />
              </Pressable>
            </View>
          ))}
          <View style={styles.addRow}>
            <TextInput value={newItem} onChangeText={setNewItem} placeholder="Tambah item checklist..."
              placeholderTextColor={colors.muted} style={styles.addInput} testID="checklist-input"
              onSubmitEditing={addItem} returnKeyType="done" />
            <Pressable onPress={addItem} style={styles.addBtn} testID="add-checklist">
              <Ionicons name="add" size={22} color="#fff" />
            </Pressable>
          </View>
        </Card>

        {/* Brief */}
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm }}>
            <T weight="bold" size={font.lg}>Brief Konten</T>
            <Pressable onPress={() => setBriefSheet(true)} testID="edit-brief">
              <T weight="semibold" color={colors.brand}>{task.brief ? "Edit" : "Tambah"}</T>
            </Pressable>
          </View>
          {task.brief ? (
            <View style={{ gap: spacing.sm }}>
              {task.brief.objective ? <BriefRow label="Objektif" value={task.brief.objective} /> : null}
              {task.brief.target_audience ? <BriefRow label="Target Audiens" value={task.brief.target_audience} /> : null}
              {task.brief.platform ? <BriefRow label="Platform" value={task.brief.platform} /> : null}
              {task.brief.hook ? <BriefRow label="Hook" value={task.brief.hook} /> : null}
              {task.brief.cta ? <BriefRow label="CTA" value={task.brief.cta} /> : null}
              {task.brief.caption ? <BriefRow label="Caption" value={task.brief.caption} /> : null}
            </View>
          ) : <T color={colors.muted}>Belum ada brief. Ketuk "Tambah" untuk mengisi.</T>}
        </Card>
      </ScrollView>

      <BottomSheet open={statusSheet} onClose={() => setStatusSheet(false)} title="Ubah Status">
        <ScrollView style={{ maxHeight: 380 }}>
          {TASK_STATUSES.map((s) => (
            <Pressable key={s} onPress={() => changeStatus(s)} testID={`set-status-${s}`}
              style={({ pressed }) => [styles.optRow, { backgroundColor: pressed ? colors.surfaceSecondary : "transparent" }]}>
              <StatusBadge status={s} />
              {task.status === s ? <Ionicons name="checkmark" size={20} color={colors.brand} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      </BottomSheet>

      <BottomSheet open={briefSheet} onClose={() => setBriefSheet(false)} title="Brief Konten">
        <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: spacing.md }}>
            <TextField label="Objektif" value={brief.objective || ""} onChangeText={(v) => setBrief((b: any) => ({ ...b, objective: v }))} multiline />
            <TextField label="Target Audiens" value={brief.target_audience || ""} onChangeText={(v) => setBrief((b: any) => ({ ...b, target_audience: v }))} />
            <SelectField label="Platform" value={brief.platform} options={PLATFORMS} onSelect={(v) => setBrief((b: any) => ({ ...b, platform: v }))} />
            <TextField label="Format" value={brief.format || ""} onChangeText={(v) => setBrief((b: any) => ({ ...b, format: v }))} />
            <TextField label="Hook" value={brief.hook || ""} onChangeText={(v) => setBrief((b: any) => ({ ...b, hook: v }))} multiline />
            <TextField label="Konten Utama" value={brief.main_content || ""} onChangeText={(v) => setBrief((b: any) => ({ ...b, main_content: v }))} multiline />
            <TextField label="CTA" value={brief.cta || ""} onChangeText={(v) => setBrief((b: any) => ({ ...b, cta: v }))} />
            <TextField label="Caption" value={brief.caption || ""} onChangeText={(v) => setBrief((b: any) => ({ ...b, caption: v }))} multiline />
            <PrimaryButton label="Simpan Brief" onPress={saveBrief} testID="save-brief" />
          </View>
        </ScrollView>
      </BottomSheet>

      <ConfirmSheet open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={del}
        title="Hapus tugas ini?" message="Tindakan ini tidak dapat dibatalkan." />
    </View>
  );
}

function HeaderBar({ insets, onBack, onDelete }: { insets: any; onBack: () => void; onDelete: () => void }) {
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <ScreenHeader title="Detail Tugas" onBack={onBack}
        right={<Pressable onPress={onDelete} testID="delete-task" style={styles.delBtn}><Ionicons name="trash-outline" size={20} color={colors.error} /></Pressable>} />
    </View>
  );
}

function InfoRow({ icon, label, value, valueColor, last }: { icon: any; label: string; value: string; valueColor?: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Ionicons name={icon} size={16} color={colors.muted} />
        <T color={colors.muted}>{label}</T>
      </View>
      <T weight="semibold" color={valueColor} style={{ flex: 1, textAlign: "right" }} numberOfLines={1}>{value}</T>
    </View>
  );
}

function BriefRow({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <T size={font.sm} color={colors.muted}>{label}</T>
      <T style={{ lineHeight: 20 }}>{value}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  delBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#FDF3F3" },
  catBadge: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary },
  statusChange: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.md,
    alignSelf: "flex-start", backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.md, gap: spacing.md },
  checkItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  addRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, alignItems: "center" },
  addInput: { flex: 1, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, color: colors.onSurface, backgroundColor: colors.surfaceSecondary },
  addBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  optRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.md, paddingHorizontal: spacing.sm },
});
