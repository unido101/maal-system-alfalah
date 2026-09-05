import React, { useCallback, useState, useMemo } from "react";
import { View, StyleSheet, FlatList, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import {
  T, Card, StatusBadge, PriorityBadge, ProgressBar, SearchBar, ChipRow,
  LoadingState, ErrorState, EmptyState, Fab, Avatar,
} from "@/src/ui";
import { colors, spacing, radius, font } from "@/src/theme";
import { relativeDeadline, formatDate, MONTHS_FULL } from "@/src/format";

const STATUS_FILTERS = [
  { key: "", label: "Semua" },
  { key: "In Progress", label: "Dikerjakan" },
  { key: "Review", label: "Review" },
  { key: "Revision", label: "Revisi" },
  { key: "Assigned", label: "Ditugaskan" },
  { key: "Published", label: "Terbit" },
  { key: "Draft", label: "Draf" },
];

export default function Content() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const canAI = user?.role === "manager" || user?.role === "content";
  const [mode, setMode] = useState<"list" | "calendar">("list");
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api.get<any[]>("/tasks", { q: q || undefined, status: status || undefined });
      setTasks(data);
    } catch (e: any) {
      setError(e?.message);
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <T weight="bold" size={font.xl}>Manajemen Konten</T>
            <T color={colors.muted} size={font.sm}>{tasks.length} tugas konten</T>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {canAI ? (
              <Pressable testID="open-ai" onPress={() => router.push("/ai")} style={[styles.toggleBtn, styles.aiBtn]}>
                <Ionicons name="sparkles" size={20} color="#fff" />
              </Pressable>
            ) : null}
            {canAI ? (
              <Pressable testID="open-library" onPress={() => router.push("/content-library")} style={styles.toggleBtn}>
                <Ionicons name="folder-open" size={20} color={colors.muted} />
              </Pressable>
            ) : null}
            <Pressable testID="toggle-list" onPress={() => setMode("list")}
              style={[styles.toggleBtn, mode === "list" && styles.toggleActive]}>
              <Ionicons name="list" size={20} color={mode === "list" ? colors.brand : colors.muted} />
            </Pressable>
            <Pressable testID="toggle-calendar" onPress={() => setMode("calendar")}
              style={[styles.toggleBtn, mode === "calendar" && styles.toggleActive]}>
              <Ionicons name="calendar" size={20} color={mode === "calendar" ? colors.brand : colors.muted} />
            </Pressable>
          </View>
        </View>
        <View style={{ marginTop: spacing.md }}>
          <SearchBar value={q} onChangeText={setQ} placeholder="Cari tugas konten..." testID="content-search" />
        </View>
      </View>

      {mode === "list" ? (
        <>
          <View style={styles.chipWrap}>
            <ChipRow items={STATUS_FILTERS} value={status} onChange={setStatus} testIDPrefix="status" />
          </View>
          {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : tasks.length === 0 ? (
            <EmptyState icon="albums-outline" title="Belum ada konten"
              subtitle="Tambahkan tugas konten pertama Anda untuk memulai." />
          ) : (
            <FlatList
              data={tasks}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.md, gap: spacing.md, paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => <TaskCard task={item} onPress={() => router.push(`/task/${item.id}`)} />}
            />
          )}
        </>
      ) : (
        <CalendarView tasks={tasks} loading={loading} onTaskPress={(id) => router.push(`/task/${id}`)} />
      )}

      <Fab testID="add-task-fab" onPress={() => router.push("/create/task")} bottom={insets.bottom + 20} />
    </View>
  );
}

export function TaskCard({ task, onPress }: { task: any; onPress: () => void }) {
  const dl = relativeDeadline(task.deadline);
  return (
    <Card onPress={onPress} testID={`task-card-${task.id}`}>
      <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm }}>
        <PriorityBadge priority={task.priority} />
        <StatusBadge status={task.status} />
        <View style={styles.catBadge}><T size={font.sm} color={colors.onSurfaceSecondary}>{task.category}</T></View>
      </View>
      <T weight="semibold" size={font.lg} numberOfLines={2}>{task.title}</T>
      {task.program_name ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
          <Ionicons name="flag-outline" size={13} color={colors.muted} />
          <T size={font.sm} color={colors.muted} numberOfLines={1}>{task.program_name}</T>
        </View>
      ) : null}
      {task.checklist_total > 0 ? (
        <View style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
            <T size={font.sm} color={colors.muted}>Checklist {task.checklist_done}/{task.checklist_total}</T>
            <T size={font.sm} weight="semibold" color={colors.brand}>{task.checklist_progress}%</T>
          </View>
          <ProgressBar value={task.checklist_progress} />
        </View>
      ) : null}
      <View style={styles.taskFooter}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          {task.assignee ? <Avatar name={task.assignee.name} size={24} /> : <Ionicons name="person-outline" size={16} color={colors.muted} />}
          <T size={font.sm} color={colors.muted} numberOfLines={1}>{task.assignee?.name || "Belum ada PIC"}</T>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="time-outline" size={14} color={dl.overdue ? colors.error : colors.muted} />
          <T size={font.sm} color={dl.overdue ? colors.error : colors.muted} weight={dl.overdue ? "semibold" : "regular"}>{dl.text}</T>
        </View>
      </View>
    </Card>
  );
}

function CalendarView({ tasks, loading, onTaskPress }:
  { tasks: any[]; loading: boolean; onTaskPress: (id: string) => void }) {
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<string>(new Date().toISOString().slice(0, 10));

  const byDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    tasks.forEach((t) => {
      if (t.deadline) {
        const k = t.deadline.slice(0, 10);
        (map[k] = map[k] || []).push(t);
      }
    });
    return map;
  }, [tasks]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedTasks = byDate[selected] || [];

  if (loading) return <LoadingState />;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
          <Pressable onPress={() => setCursor(new Date(year, month - 1, 1))} testID="cal-prev">
            <Ionicons name="chevron-back" size={22} color={colors.brand} />
          </Pressable>
          <T weight="bold" size={font.lg}>{MONTHS_FULL[month]} {year}</T>
          <Pressable onPress={() => setCursor(new Date(year, month + 1, 1))} testID="cal-next">
            <Ionicons name="chevron-forward" size={22} color={colors.brand} />
          </Pressable>
        </View>
        <View style={{ flexDirection: "row" }}>
          {["M", "S", "S", "R", "K", "J", "S"].map((d, i) => (
            <View key={i} style={styles.calHead}><T size={font.sm} color={colors.muted} weight="semibold">{d}</T></View>
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {cells.map((d, i) => {
            if (d === null) return <View key={i} style={styles.calCell} />;
            const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const has = (byDate[key] || []).length;
            const isSel = key === selected;
            return (
              <Pressable key={i} onPress={() => setSelected(key)} style={styles.calCell} testID={`cal-day-${d}`}>
                <View style={[styles.calDay, isSel && { backgroundColor: colors.brand }]}>
                  <T size={font.base} color={isSel ? "#fff" : colors.onSurface}>{d}</T>
                </View>
                {has ? <View style={[styles.calDot, { backgroundColor: isSel ? colors.brandSecondary : colors.brand }]} /> : <View style={{ height: 5 }} />}
              </Pressable>
            );
          })}
        </View>
      </Card>

      <T weight="bold" size={font.lg} style={{ marginTop: spacing.lg, marginBottom: spacing.md }}>
        {formatDate(selected)}
      </T>
      {selectedTasks.length === 0 ? (
        <Card><T color={colors.muted}>Tidak ada konten dengan deadline di tanggal ini.</T></Card>
      ) : (
        <View style={{ gap: spacing.md }}>
          {selectedTasks.map((t) => <TaskCard key={t.id} task={t} onPress={() => onTaskPress(t.id)} />)}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  toggleBtn: { width: 40, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceSecondary },
  aiBtn: { backgroundColor: colors.brand },
  toggleActive: { backgroundColor: colors.brandTertiary },
  chipWrap: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.sm },
  catBadge: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary },
  taskFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  calHead: { flex: 1, alignItems: "center", paddingVertical: spacing.xs },
  calCell: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 4 },
  calDay: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  calDot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 2 },
});
