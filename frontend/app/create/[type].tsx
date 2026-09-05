import React, { useEffect, useState, useCallback } from "react";
import {
  View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import {
  T, TextField, SelectField, EntitySelect, DateField, PrimaryButton, useToast, ScreenHeader,
} from "@/src/ui";
import { colors, spacing, radius, font } from "@/src/theme";
import {
  TASK_CATEGORIES, TASK_PRIORITIES, TASK_STATUSES, DONATION_TYPES, PAYMENT_METHODS,
  PAYMENT_STATUSES, EXPENSE_CATEGORIES, PROGRAM_STATUSES,
} from "@/src/theme";

const TITLES: Record<string, string> = {
  task: "Tugas Baru", donation: "Donasi Baru", program: "Program Baru",
  expense: "Pengeluaran Baru", donor: "Donatur Baru",
};

export default function CreateScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [programs, setPrograms] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [donors, setDonors] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    date: new Date().toISOString(),
    priority: "Medium", status: type === "program" ? "Active" : "Draft",
    category: type === "task" ? "Feed" : type === "expense" ? "Operational" : "Sosial",
    type: "Sedekah", payment_method: "Cash", payment_status: "Paid", target: "", amount: "",
    newDonor: false,
  });

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  useEffect(() => {
    (async () => {
      try {
        if (["task", "donation", "expense", "program"].includes(type as string)) {
          const p = await api.get<any[]>("/programs");
          setPrograms(p);
        }
        if (type === "task" || type === "program") {
          const u = await api.get<any[]>("/users");
          setUsers(u);
        }
        if (type === "donation") {
          const d = await api.get<any[]>("/donors");
          setDonors(d);
        }
      } catch {}
    })();
  }, [type]);

  const submit = useCallback(async () => {
    setSaving(true);
    try {
      if (type === "task") {
        if (!form.title?.trim()) throw new Error("Judul wajib diisi");
        await api.post("/tasks", {
          title: form.title, description: form.description || "", category: form.category,
          priority: form.priority, status: form.status, program_id: form.program_id || null,
          assigned_user_id: form.assigned_user_id || null, start_date: form.start_date || null,
          deadline: form.deadline || null,
        });
        toast("Tugas berhasil dibuat", "success");
      } else if (type === "program") {
        if (!form.name?.trim()) throw new Error("Nama program wajib diisi");
        await api.post("/programs", {
          name: form.name, category: form.category, description: form.description || "",
          target: Number(form.target) || 0, status: form.status, pic_id: form.pic_id || null,
          start_date: form.start_date || null, end_date: form.end_date || null,
        });
        toast("Program berhasil dibuat", "success");
      } else if (type === "donation") {
        if (!Number(form.amount)) throw new Error("Nominal wajib diisi");
        if (!form.newDonor && !form.donor_id) throw new Error("Pilih donatur");
        if (form.newDonor && !form.donor_name?.trim()) throw new Error("Nama donatur wajib diisi");
        await api.post("/donations", {
          donor_id: form.newDonor ? null : form.donor_id,
          donor_name: form.newDonor ? form.donor_name : null,
          donor_phone: form.newDonor ? form.donor_phone : null,
          program_id: form.program_id || null, type: form.type, amount: Number(form.amount),
          payment_method: form.payment_method, payment_status: form.payment_status,
          date: form.date, notes: form.notes || "",
        });
        toast("Donasi berhasil dicatat", "success");
      } else if (type === "expense") {
        if (!form.description?.trim()) throw new Error("Deskripsi wajib diisi");
        if (!Number(form.amount)) throw new Error("Nominal wajib diisi");
        await api.post("/expenses", {
          description: form.description, category: form.category, amount: Number(form.amount),
          program_id: form.program_id || null, payment_method: form.payment_method,
          date: form.date, notes: form.notes || "",
        });
        toast("Pengeluaran berhasil dicatat", "success");
      } else if (type === "donor") {
        if (!form.name?.trim()) throw new Error("Nama donatur wajib diisi");
        await api.post("/donors", { name: form.name, phone: form.phone || "", notes: form.notes || "" });
        toast("Donatur berhasil ditambahkan", "success");
      }
      router.back();
    } catch (e: any) {
      toast(e?.message || "Gagal menyimpan", "error");
    } finally {
      setSaving(false);
    }
  }, [type, form, router, toast]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <ScreenHeader title={TITLES[type as string] || "Baru"} onBack={() => router.back()} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 120 }}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {type === "task" && (
            <>
              <TextField label="Judul" value={form.title || ""} onChangeText={(v) => set("title", v)} placeholder="Judul tugas konten" testID="f-title" />
              <TextField label="Deskripsi" value={form.description || ""} onChangeText={(v) => set("description", v)} placeholder="Deskripsi singkat" multiline testID="f-desc" />
              <SelectField label="Kategori" value={form.category} options={TASK_CATEGORIES} onSelect={(v) => set("category", v)} testID="f-category" />
              <SelectField label="Prioritas" value={form.priority} options={TASK_PRIORITIES} onSelect={(v) => set("priority", v)} testID="f-priority" />
              <SelectField label="Status" value={form.status} options={TASK_STATUSES} onSelect={(v) => set("status", v)} testID="f-status" />
              <EntitySelect label="Program Terkait" value={form.program_id} items={programs} onSelect={(v) => set("program_id", v)} allowNone testID="f-program" />
              <EntitySelect label="PIC (Penanggung Jawab)" value={form.assigned_user_id} items={users} onSelect={(v) => set("assigned_user_id", v)} allowNone testID="f-pic" />
              <DateField label="Tanggal Mulai" value={form.start_date} onChange={(v) => set("start_date", v)} testID="f-start" />
              <DateField label="Deadline" value={form.deadline} onChange={(v) => set("deadline", v)} testID="f-deadline" />
            </>
          )}

          {type === "program" && (
            <>
              <TextField label="Nama Program" value={form.name || ""} onChangeText={(v) => set("name", v)} placeholder="cth: Program Makan Gratis" testID="f-name" />
              <TextField label="Kategori" value={form.category || ""} onChangeText={(v) => set("category", v)} placeholder="cth: Sosial" testID="f-pcategory" />
              <TextField label="Deskripsi" value={form.description || ""} onChangeText={(v) => set("description", v)} multiline testID="f-pdesc" />
              <TextField label="Target Dana (Rp)" value={form.target} onChangeText={(v) => set("target", v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" placeholder="0" testID="f-target" />
              <SelectField label="Status" value={form.status} options={PROGRAM_STATUSES} onSelect={(v) => set("status", v)} testID="f-pstatus" />
              <EntitySelect label="PIC" value={form.pic_id} items={users} onSelect={(v) => set("pic_id", v)} allowNone testID="f-ppic" />
              <DateField label="Tanggal Mulai" value={form.start_date} onChange={(v) => set("start_date", v)} testID="f-pstart" />
              <DateField label="Tanggal Selesai" value={form.end_date} onChange={(v) => set("end_date", v)} testID="f-pend" />
            </>
          )}

          {type === "donation" && (
            <>
              <View style={styles.toggleRow}>
                <Pressable testID="donor-existing" onPress={() => set("newDonor", false)}
                  style={[styles.togglePill, !form.newDonor && styles.togglePillActive]}>
                  <T weight="semibold" color={!form.newDonor ? "#fff" : colors.onSurfaceSecondary}>Donatur Ada</T>
                </Pressable>
                <Pressable testID="donor-new" onPress={() => set("newDonor", true)}
                  style={[styles.togglePill, form.newDonor && styles.togglePillActive]}>
                  <T weight="semibold" color={form.newDonor ? "#fff" : colors.onSurfaceSecondary}>Donatur Baru</T>
                </Pressable>
              </View>
              {form.newDonor ? (
                <>
                  <TextField label="Nama Donatur" value={form.donor_name || ""} onChangeText={(v) => set("donor_name", v)} placeholder="Nama lengkap" testID="f-donorname" />
                  <TextField label="No. Telepon" value={form.donor_phone || ""} onChangeText={(v) => set("donor_phone", v)} keyboardType="phone-pad" placeholder="08xxx" testID="f-donorphone" />
                </>
              ) : (
                <EntitySelect label="Donatur" value={form.donor_id} items={donors} onSelect={(v) => set("donor_id", v)} testID="f-donor" />
              )}
              <EntitySelect label="Program" value={form.program_id} items={programs} onSelect={(v) => set("program_id", v)} allowNone testID="f-dprogram" />
              <SelectField label="Jenis Donasi" value={form.type} options={DONATION_TYPES} onSelect={(v) => set("type", v)} testID="f-dtype" />
              <TextField label="Nominal (Rp)" value={form.amount} onChangeText={(v) => set("amount", v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" placeholder="0" testID="f-amount" />
              <SelectField label="Metode Pembayaran" value={form.payment_method} options={PAYMENT_METHODS} onSelect={(v) => set("payment_method", v)} testID="f-method" />
              <SelectField label="Status Pembayaran" value={form.payment_status} options={PAYMENT_STATUSES} onSelect={(v) => set("payment_status", v)} testID="f-pstatus2" />
              <DateField label="Tanggal" value={form.date} onChange={(v) => set("date", v)} testID="f-date" />
              <TextField label="Catatan" value={form.notes || ""} onChangeText={(v) => set("notes", v)} multiline testID="f-notes" />
              {(form.payment_method === "QRIS" || form.payment_method === "Payment Gateway") ? (
                <View style={styles.pendingBox}>
                  <Ionicons name="construct-outline" size={16} color={colors.warning} />
                  <T size={font.sm} color={colors.onSurfaceSecondary} style={{ flex: 1 }}>
                    Integrasi Payment Gateway/QRIS otomatis belum aktif (pending). Status dicatat manual.
                  </T>
                </View>
              ) : null}
            </>
          )}

          {type === "expense" && (
            <>
              <TextField label="Deskripsi" value={form.description || ""} onChangeText={(v) => set("description", v)} placeholder="cth: Pembelian bahan makanan" testID="f-edesc" />
              <SelectField label="Kategori" value={form.category} options={EXPENSE_CATEGORIES} onSelect={(v) => set("category", v)} testID="f-ecategory" />
              <TextField label="Nominal (Rp)" value={form.amount} onChangeText={(v) => set("amount", v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" placeholder="0" testID="f-eamount" />
              <EntitySelect label="Program Terkait" value={form.program_id} items={programs} onSelect={(v) => set("program_id", v)} allowNone testID="f-eprogram" />
              <SelectField label="Metode Pembayaran" value={form.payment_method} options={PAYMENT_METHODS} onSelect={(v) => set("payment_method", v)} testID="f-emethod" />
              <DateField label="Tanggal" value={form.date} onChange={(v) => set("date", v)} testID="f-edate" />
              <TextField label="Catatan" value={form.notes || ""} onChangeText={(v) => set("notes", v)} multiline testID="f-enotes" />
            </>
          )}

          {type === "donor" && (
            <>
              <TextField label="Nama Donatur" value={form.name || ""} onChangeText={(v) => set("name", v)} placeholder="Nama lengkap" testID="f-dname" />
              <TextField label="No. Telepon" value={form.phone || ""} onChangeText={(v) => set("phone", v)} keyboardType="phone-pad" placeholder="08xxx" testID="f-dphone" />
              <TextField label="Catatan" value={form.notes || ""} onChangeText={(v) => set("notes", v)} multiline testID="f-dnotes" />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton label="Simpan" onPress={submit} loading={saving} testID="submit-create" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  toggleRow: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: 4 },
  togglePill: { flex: 1, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  togglePillActive: { backgroundColor: colors.brand },
  pendingBox: { flexDirection: "row", gap: spacing.sm, alignItems: "center", padding: spacing.md,
    backgroundColor: "#FEF9F0", borderRadius: radius.md, borderWidth: 1, borderColor: "#F5E4C3" },
});
