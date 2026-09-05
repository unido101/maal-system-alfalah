import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import {
  T, Card, TextField, SelectField, EntitySelect, PrimaryButton, ScreenHeader, useToast, LoadingState,
} from "@/src/ui";
import { ContentResult } from "@/src/ContentResult";
import { colors, spacing, radius, font } from "@/src/theme";

const QUICK = [
  { key: "program", label: "Dari Program", icon: "flag", objective: "Awareness" },
  { key: "idea", label: "Dari Ide", icon: "bulb", objective: "Awareness" },
  { key: "facility", label: "Dari Fasilitas", icon: "business", objective: "Awareness" },
  { key: "fundraising", label: "Fundraising", icon: "gift", objective: "Fundraising" },
  { key: "develop", label: "Kembangkan Ide", icon: "sparkles", objective: "Engagement" },
];

const OBJECTIVES = ["Awareness", "Engagement", "Community", "Fundraising"];
const OBJ_LABELS: Record<string, string> = {
  Awareness: "Awareness (Kesadaran)", Engagement: "Engagement (Interaksi)",
  Community: "Community (Komunitas)", Fundraising: "Fundraising (Donasi)",
};

export default function AIAssistant() {
  const params = useLocalSearchParams<{ program_id?: string; source_type?: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  useEffect(() => {
    if (user && user.role !== "manager" && user.role !== "content") router.replace("/(tabs)/home");
  }, [user, router]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [form, setForm] = useState<any>({
    source_type: params.source_type || "idea",
    program_id: params.program_id || null,
    objective: params.source_type === "fundraising" ? "Fundraising" : "Awareness",
  });

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  useEffect(() => {
    (async () => { try { setPrograms(await api.get<any[]>("/ai/programs-context")); } catch {} })();
  }, []);

  const pickQuick = (q: any) => set("source_type", q.key) === undefined
    ? setForm((f: any) => ({ ...f, source_type: q.key, objective: q.objective }))
    : null;

  const generate = useCallback(async () => {
    // basic validation
    if (form.source_type === "program" && !form.program_id) { toast("Pilih program dulu", "error"); return; }
    if (["idea", "develop"].includes(form.source_type) && !form.idea?.trim()) { toast("Isi ide konten dulu", "error"); return; }
    if (form.source_type === "facility" && !form.facility?.trim()) { toast("Isi fasilitas/aktivitas dulu", "error"); return; }
    setGenerating(true);
    try {
      const item = await api.post<any>("/ai/generate", {
        source_type: form.source_type, program_id: form.program_id || null,
        idea: form.idea || "", facility: form.facility || "", problem: form.problem || "",
        target_audience: form.target_audience || "", important_facts: form.important_facts || "",
        available_footage: form.available_footage || "", objective: form.objective,
        fundraising_objective: form.fundraising_objective || "",
      });
      setResult(item);
    } catch (e: any) {
      toast(e?.message || "Gagal membuat konten", "error");
    } finally { setGenerating(false); }
  }, [form, toast]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <LinearGradient colors={[colors.brand, "#053B2C"]} style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <ScreenHeader title="Alfalah AI Assistant" onBack={() => (result ? setResult(null) : router.back())}
          right={<View style={styles.aiBadge}><Ionicons name="sparkles" size={18} color={colors.brandSecondary} /></View>} />
        {!result ? (
          <T color="rgba(255,255,255,0.85)" size={font.sm} style={{ marginTop: spacing.sm }}>
            Bantu ubah program, aktivitas, dan cerita Al-Falah menjadi konten yang menarik.
          </T>
        ) : null}
      </LinearGradient>

      {generating ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
          <View style={styles.genBox}>
            <Ionicons name="sparkles" size={34} color={colors.brandSecondary} />
            <T weight="bold" size={font.lg} style={{ marginTop: spacing.md }}>AI sedang menyusun konten...</T>
            <T color={colors.muted} style={{ marginTop: spacing.xs, textAlign: "center" }}>
              Menganalisa DNA, hook, script, shot list, CTA & caption.
            </T>
            <LoadingState label="" />
          </View>
        </View>
      ) : result ? (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
          <ContentResult item={result} onChange={setResult} />
        </ScrollView>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 40 }}
            keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <T weight="bold" size={font.base}>Mulai cepat</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: 2 }}>
              {QUICK.map((q) => {
                const active = form.source_type === q.key;
                return (
                  <Pressable key={q.key} testID={`quick-${q.key}`} onPress={() => setForm((f: any) => ({ ...f, source_type: q.key, objective: q.objective }))}
                    style={[styles.quickChip, active && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
                    <Ionicons name={q.icon as any} size={16} color={active ? "#fff" : colors.brand} />
                    <T size={font.sm} weight="semibold" color={active ? "#fff" : colors.onSurfaceSecondary}>{q.label}</T>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Card style={{ gap: spacing.md }}>
              {form.source_type === "program" ? (
                <EntitySelect label="Program" value={form.program_id} items={programs}
                  onSelect={(v) => set("program_id", v)} placeholder="Pilih program dari database" testID="ai-program" />
              ) : null}
              {form.source_type !== "program" ? (
                <TextField label={form.source_type === "facility" ? "Fasilitas / Aktivitas" : "Ide Konten"}
                  value={form.source_type === "facility" ? (form.facility || "") : (form.idea || "")}
                  onChangeText={(v) => set(form.source_type === "facility" ? "facility" : "idea", v)}
                  placeholder="cth: Masjid buka 24 jam untuk musafir" multiline testID="ai-idea" />
              ) : null}
              <TextField label="Fasilitas / Aktivitas (opsional)" value={form.facility || ""} onChangeText={(v) => set("facility", v)}
                placeholder="cth: area istirahat, teh jahe gratis" testID="ai-facility" />
              <TextField label="Masalah / Konteks (opsional)" value={form.problem || ""} onChangeText={(v) => set("problem", v)} multiline testID="ai-problem" />
              <TextField label="Target Audiens" value={form.target_audience || ""} onChangeText={(v) => set("target_audience", v)}
                placeholder="cth: Musafir, masyarakat umum" testID="ai-target" />
              <TextField label="Fakta Penting (terverifikasi)" value={form.important_facts || ""} onChangeText={(v) => set("important_facts", v)}
                placeholder="AI hanya pakai fakta yang Anda isi" multiline testID="ai-facts" />
              <TextField label="Footage Tersedia (opsional)" value={form.available_footage || ""} onChangeText={(v) => set("available_footage", v)} testID="ai-footage" />
              <SelectField label="Tujuan Konten" value={form.objective} options={OBJECTIVES} labelMap={OBJ_LABELS} onSelect={(v) => set("objective", v)} testID="ai-objective" />
              {form.objective === "Fundraising" || form.source_type === "fundraising" ? (
                <TextField label="Tujuan Fundraising" value={form.fundraising_objective || ""} onChangeText={(v) => set("fundraising_objective", v)} multiline testID="ai-fundraising" />
              ) : null}
            </Card>

            <View style={styles.factNote}>
              <Ionicons name="shield-checkmark-outline" size={15} color={colors.info} />
              <T size={font.sm} color={colors.onSurfaceSecondary} style={{ flex: 1 }}>
                AI tidak mengarang angka, testimoni, ayat, atau hadits. Fakta yang kosong ditandai [DATA DIPERLUKAN].
              </T>
            </View>

            <PrimaryButton label="Generate Konten" icon="sparkles" onPress={generate} testID="ai-generate" />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  aiBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  quickChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, height: 40, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  genBox: { alignItems: "center", padding: spacing.xl },
  factNote: { flexDirection: "row", gap: spacing.sm, alignItems: "center", padding: spacing.md, backgroundColor: "#E6F7F4", borderRadius: radius.md },
});
