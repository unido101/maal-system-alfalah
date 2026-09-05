import React, { useState } from "react";
import { View, StyleSheet, Pressable, ScrollView, ActivityIndicator, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import {
  T, Card, Badge, PrimaryButton, GhostButton, BottomSheet, EntitySelect, DateField,
  SelectField, useToast,
} from "@/src/ui";
import { colors, spacing, radius, font } from "@/src/theme";

const DNA_COLORS: Record<string, string> = {
  "MASJID INI AGAK LAEN": "#0D9488",
  "BUAT APA?": "#064E3B",
  "JANGAN... TAPI...": "#D97706",
  "KELIHATANNYA SEPELE": "#059669",
  "BUKAN TENTANG BANGUNANNYA": "#C5A059",
  "PESAN UNTUK KAMU": "#DC2626",
};

const TRANSFORMS = [
  { key: "generate_again", label: "Buat Ulang", icon: "refresh" },
  { key: "improve_hook", label: "Perbaiki Hook", icon: "flash" },
  { key: "more_casual", label: "Lebih Santai", icon: "happy" },
  { key: "more_emotional", label: "Lebih Emosional", icon: "heart" },
  { key: "shorter", label: "Lebih Singkat", icon: "cut" },
  { key: "youth_friendly", label: "Anak Muda", icon: "sparkles" },
  { key: "fundraising_version", label: "Versi Fundraising", icon: "gift" },
];

const CONTENT_STATUSES = ["Draft", "Approved", "In Production", "Published", "Archived"];
const STATUS_LABELS: Record<string, string> = {
  Draft: "Draf", Approved: "Disetujui", "In Production": "Produksi", Published: "Terbit", Archived: "Arsip",
};

export function ContentResult({ item, onChange }: { item: any; onChange: (it: any) => void }) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({ strategy: true, hook: true, script: true });
  const [taskSheet, setTaskSheet] = useState(false);
  const [statusSheet, setStatusSheet] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [taskForm, setTaskForm] = useState<any>({ priority: "Medium" });
  const [creating, setCreating] = useState(false);

  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const transform = async (action: string) => {
    setBusy(action);
    try {
      const updated = await api.post<any>("/ai/transform", { content_item_id: item.id, action });
      onChange(updated);
      toast("Konten diperbarui", "success");
    } catch (e: any) {
      toast(e?.message || "Gagal transformasi", "error");
    } finally { setBusy(null); }
  };

  const copy = async (text: string) => {
    try { await Clipboard.setStringAsync(text); toast("Disalin ke clipboard", "success"); } catch {}
  };

  const openTaskSheet = async () => {
    try { if (users.length === 0) setUsers(await api.get<any[]>("/users")); } catch {}
    setTaskForm({ priority: "Medium", deadline: null, assigned_user_id: null });
    setTaskSheet(true);
  };

  const createTask = async () => {
    setCreating(true);
    try {
      const res = await api.post<any>(`/content-items/${item.id}/create-task`, {
        assigned_user_id: taskForm.assigned_user_id || null,
        deadline: taskForm.deadline || null,
        priority: taskForm.priority,
      });
      setTaskSheet(false);
      toast("Tugas konten berhasil dibuat", "success");
      onChange({ ...item, status: "In Production", related_task_id: res.task.id, related_task_status: res.task.status });
      router.push(`/task/${res.task.id}`);
    } catch (e: any) {
      toast(e?.message || "Gagal membuat tugas", "error");
    } finally { setCreating(false); }
  };

  const changeStatus = async (status: string) => {
    setStatusSheet(false);
    try {
      const updated = await api.put<any>(`/content-items/${item.id}`, { status });
      onChange(updated);
      toast(`Status: ${STATUS_LABELS[status]}`, "success");
    } catch (e: any) { toast(e?.message || "Gagal", "error"); }
  };

  const dnaColor = DNA_COLORS[item.content_dna] || colors.brand;
  const s = item.strategy || {};

  return (
    <View style={{ gap: spacing.md }}>
      {busy ? (
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.overlayBox}>
            <ActivityIndicator color={colors.brand} size="large" />
            <T weight="semibold" style={{ marginTop: spacing.sm }}>AI sedang bekerja...</T>
          </View>
        </View>
      ) : null}

      {/* Title + DNA + status */}
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm }}>
          <T weight="bold" size={font.xl} style={{ flex: 1 }}>{item.title}</T>
          <Pressable onPress={() => setStatusSheet(true)} testID="ci-status">
            <Badge label={STATUS_LABELS[item.status] || item.status} bg={colors.brandTertiary} fg={colors.brand} />
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" }}>
          <View style={[styles.dnaTag, { backgroundColor: dnaColor + "1A", borderColor: dnaColor }]}>
            <Ionicons name="color-wand" size={13} color={dnaColor} />
            <T size={font.sm} weight="semibold" color={dnaColor}>{item.content_dna}</T>
          </View>
          {item.related_program_name ? (
            <View style={styles.dnaTag}><Ionicons name="flag-outline" size={13} color={colors.muted} /><T size={font.sm} color={colors.muted}>{item.related_program_name}</T></View>
          ) : null}
        </View>
        {item.related_task_id ? (
          <Pressable onPress={() => router.push(`/task/${item.related_task_id}`)} style={styles.linkedTask} testID="ci-linked-task">
            <Ionicons name="link" size={15} color={colors.success} />
            <T size={font.sm} color={colors.success} weight="semibold">Terhubung ke tugas ({STATUS_LABELS[item.related_task_status] || item.related_task_status})</T>
          </Pressable>
        ) : null}
      </Card>

      <Section title="Strategi Konten" icon="bulb" open={open.strategy} onToggle={() => toggle("strategy")}>
        <StratRow label="Content DNA" value={s.dna || item.content_dna} />
        <StratRow label="Tipe Hook" value={s.hook_type} />
        <StratRow label="Pemicu Emosi" value={s.emotional_trigger} />
        <StratRow label="Target" value={s.target} />
        <StratRow label="Tujuan" value={s.goal} />
        <StratRow label="Pesan Utama" value={s.main_message} last />
      </Section>

      <Section title="Hook" icon="flash" open={open.hook} onToggle={() => toggle("hook")}>
        <View style={styles.hookBox}>
          <T weight="semibold" size={font.lg} style={{ lineHeight: 24 }}>"{item.hook}"</T>
          <Pressable onPress={() => copy(item.hook)} style={styles.copyBtn} testID="copy-hook"><Ionicons name="copy-outline" size={16} color={colors.brand} /></Pressable>
        </View>
      </Section>

      <Section title={`Script Reels (${(item.script || []).length} scene)`} icon="film" open={open.script} onToggle={() => toggle("script")}>
        {(item.script || []).map((sc: any, i: number) => (
          <View key={i} style={styles.scene}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
              <T weight="bold" color={colors.brand}>SCENE {sc.scene || i + 1}</T>
              <T size={font.sm} color={colors.muted}>{sc.duration}</T>
            </View>
            {sc.visual ? <SceneLine label="VISUAL" value={sc.visual} /> : null}
            {sc.voice_over ? <SceneLine label="VO" value={sc.voice_over} /> : null}
            {sc.text_overlay ? <SceneLine label="TEKS" value={sc.text_overlay} /> : null}
            {sc.edit ? <SceneLine label="EDIT" value={sc.edit} /> : null}
          </View>
        ))}
      </Section>

      <Section title="Shot List" icon="list" open={open.shots} onToggle={() => toggle("shots")}>
        {(item.shot_list || []).map((sh: string, i: number) => (
          <View key={i} style={styles.shotRow}>
            <Ionicons name="camera-outline" size={15} color={colors.brandSecondary} />
            <T style={{ flex: 1 }}>{sh}</T>
          </View>
        ))}
      </Section>

      <Section title="CTA" icon="megaphone" open={open.cta} onToggle={() => toggle("cta")}>
        {item.cta ? (
          <>
            <Badge label={item.cta.category} bg={colors.brandTertiary} fg={colors.brand} />
            <T style={{ marginTop: spacing.sm, lineHeight: 22 }}>{item.cta.text}</T>
          </>
        ) : null}
      </Section>

      <Section title="Caption" icon="chatbubble-ellipses" open={open.caption} onToggle={() => toggle("caption")}>
        <T style={{ lineHeight: 22 }}>{item.caption}</T>
        <View style={{ marginTop: spacing.md }}>
          <GhostButton label="Salin Caption" icon="copy-outline" onPress={() => copy(item.caption)} />
        </View>
      </Section>

      <Section title="Alternatif Hook" icon="git-branch" open={open.alt} onToggle={() => toggle("alt")}>
        {(item.alt_hooks || []).map((h: any, i: number) => (
          <View key={i} style={styles.altHook}>
            <Badge label={h.angle} bg={colors.surfaceSecondary} fg={colors.onSurfaceSecondary} />
            <T style={{ marginTop: 4, lineHeight: 21 }}>"{h.text}"</T>
          </View>
        ))}
      </Section>

      {/* Transform buttons */}
      <Card>
        <T weight="bold" style={{ marginBottom: spacing.md }}>Sempurnakan dengan AI</T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {TRANSFORMS.map((t) => (
            <Pressable key={t.key} testID={`transform-${t.key}`} onPress={() => transform(t.key)} disabled={!!busy}
              style={[styles.tBtn, busy === t.key && { backgroundColor: colors.brand }]}>
              <Ionicons name={t.icon as any} size={14} color={busy === t.key ? "#fff" : colors.brand} />
              <T size={font.sm} weight="semibold" color={busy === t.key ? "#fff" : colors.brand}>{t.label}</T>
            </Pressable>
          ))}
        </View>
      </Card>

      <PrimaryButton label={item.related_task_id ? "Buat Tugas Lagi" : "Buat Tugas Konten"} icon="checkbox"
        onPress={openTaskSheet} testID="create-task-btn" />

      {/* Create task sheet */}
      <BottomSheet open={taskSheet} onClose={() => setTaskSheet(false)} title="Buat Tugas Konten">
        <View style={{ gap: spacing.md }}>
          <T color={colors.muted} size={font.sm}>Judul, brief, hook, script, shot list, CTA & caption akan otomatis dipindahkan ke tugas.</T>
          <EntitySelect label="PIC (Penanggung Jawab)" value={taskForm.assigned_user_id} items={users}
            onSelect={(v) => setTaskForm((f: any) => ({ ...f, assigned_user_id: v }))} allowNone testID="task-pic" />
          <DateField label="Deadline" value={taskForm.deadline} onChange={(v) => setTaskForm((f: any) => ({ ...f, deadline: v }))} testID="task-deadline" />
          <SelectField label="Prioritas" value={taskForm.priority} options={["Low", "Medium", "High", "Urgent"]}
            labelMap={{ Low: "Rendah", Medium: "Sedang", High: "Tinggi", Urgent: "Mendesak" }}
            onSelect={(v) => setTaskForm((f: any) => ({ ...f, priority: v }))} testID="task-priority" />
          <PrimaryButton label="Buat Tugas" onPress={createTask} loading={creating} testID="confirm-create-task" />
        </View>
      </BottomSheet>

      <BottomSheet open={statusSheet} onClose={() => setStatusSheet(false)} title="Ubah Status Konten">
        {CONTENT_STATUSES.map((st) => (
          <Pressable key={st} onPress={() => changeStatus(st)} testID={`set-cstatus-${st}`}
            style={({ pressed }) => [styles.optRow, { backgroundColor: pressed ? colors.surfaceSecondary : "transparent" }]}>
            <T size={font.lg} color={item.status === st ? colors.brand : colors.onSurface} weight={item.status === st ? "semibold" : "regular"}>{STATUS_LABELS[st]}</T>
            {item.status === st ? <Ionicons name="checkmark" size={20} color={colors.brand} /> : null}
          </Pressable>
        ))}
      </BottomSheet>
    </View>
  );
}

function Section({ title, icon, open, onToggle, children }:
  { title: string; icon: any; open?: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <Card style={{ padding: 0 }}>
      <Pressable onPress={onToggle} style={styles.secHead} testID={`section-${title}`}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View style={styles.secIcon}><Ionicons name={icon} size={16} color={colors.brand} /></View>
          <T weight="bold" size={font.base}>{title}</T>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </Pressable>
      {open ? <View style={{ padding: spacing.lg, paddingTop: 0 }}>{children}</View> : null}
    </Card>
  );
}

function StratRow({ label, value, last }: { label: string; value?: string; last?: boolean }) {
  return (
    <View style={[styles.stratRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
      <T size={font.sm} color={colors.muted} style={{ width: 110 }}>{label}</T>
      <T size={font.base} weight="medium" style={{ flex: 1 }}>{value || "-"}</T>
    </View>
  );
}

function SceneLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: 2 }}>
      <T size={font.sm} weight="bold" color={colors.brandSecondary} style={{ width: 44 }}>{label}</T>
      <T size={font.sm} style={{ flex: 1, lineHeight: 19 }}>{value}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.55)", alignItems: "center", justifyContent: "center", zIndex: 50 },
  overlayBox: { backgroundColor: colors.surface, padding: spacing.xl, borderRadius: radius.lg, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  dnaTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  linkedTask: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.md, backgroundColor: "#E7F5EF", padding: spacing.sm, borderRadius: radius.sm },
  secHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg },
  secIcon: { width: 30, height: 30, borderRadius: radius.sm, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  stratRow: { flexDirection: "row", paddingVertical: spacing.sm, gap: spacing.sm },
  hookBox: { backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderLeftWidth: 3, borderLeftColor: colors.brandSecondary, flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  copyBtn: { padding: 4 },
  scene: { backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm },
  shotRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 5 },
  altHook: { backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm },
  tBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.md, height: 38, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.surface },
  optRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.md, paddingHorizontal: spacing.sm },
});
