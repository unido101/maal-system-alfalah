import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api";

import {
  T,
  TextField,
  SelectField,
  EntitySelect,
  DateField,
  PrimaryButton,
  useToast,
  ScreenHeader,
} from "@/src/ui";

import { colors, spacing, radius, font } from "@/src/theme";

import {
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  DONATION_TYPES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  EXPENSE_CATEGORIES,
  PROGRAM_STATUSES,
} from "@/src/theme";

const TITLES: Record<string, string> = {
  task: "Tugas Baru",
  donation: "Donasi Baru",
  program: "Program Baru",
  expense: "Pengeluaran Baru",
  donor: "Donatur Baru",
  lead: "Input Tamu",
};

export default function CreateScreen() {
  const { type, kind } = useLocalSearchParams<{
  type: string;
  kind?: string;
}>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();

  const [saving, setSaving] = useState(false);
  const [programs, setPrograms] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [donors, setDonors] = useState<any[]>([]);

  const [form, setForm] = useState<any>({
    date: new Date().toISOString(),

    priority: "Medium",

    status: type === "program" ? "Active" : "Draft",

    category:
      type === "task"
        ? "Feed"
        : type === "expense"
          ? "Operational"
          : "Sosial",

    // Donation
    type: "Sedekah",
    payment_method: "Cash",
    payment_status: "Paid",

    // General
    target: "",
    amount: "",

    // Donasi Barang
    item_name: "",
    item_description: "",
    item_quantity: "",
    item_unit: "",
    item_condition: "Baik",
    estimated_value: "",

    // Donatur
    newDonor: false,
  });

  const set = (k: string, v: any) =>
    setForm((f: any) => ({
      ...f,
      [k]: v,
    }));

  useEffect(() => {
    (async () => {
      try {
        if (
          ["task", "donation", "expense", "program"].includes(
            type as string
          )
        ) {
          const p = await api.get<any[]>("/programs");
          setPrograms(p);
        }

        if (
  type === "task" ||
  type === "program" ||
  type === "lead"
) {
  const u = await api.get<any[]>("/users");
  setUsers(u);
}
if (type === "donation" && kind === "barang") {
  setForm((prev) => ({
    ...prev,
    type: "Barang",
  }));
}

        if (type === "donation") {
          const d = await api.get<any[]>("/donors");
          setDonors(d);
        }
      } catch {}
    })();
  }, [type, kind]);

  const submit = useCallback(async () => {
    setSaving(true);

    try {
      // =========================================================
      // TASK
      // =========================================================
      if (type === "task") {
        if (!form.title?.trim()) {
          throw new Error("Judul wajib diisi");
        }

        await api.post("/tasks", {
          title: form.title,
          description: form.description || "",
          category: form.category,
          priority: form.priority,
          status: form.status,
          program_id: form.program_id || null,
          assigned_user_id: form.assigned_user_id || null,
          start_date: form.start_date || null,
          deadline: form.deadline || null,
        });

        toast("Tugas berhasil dibuat", "success");
      }

      // =========================================================
      // PROGRAM
      // =========================================================
      else if (type === "program") {
        if (!form.name?.trim()) {
          throw new Error("Nama program wajib diisi");
        }

        await api.post("/programs", {
          name: form.name,
          category: form.category,
          description: form.description || "",
          target: Number(form.target) || 0,
          status: form.status,
          pic_id: form.pic_id || null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
        });

        toast("Program berhasil dibuat", "success");
      }

      // =========================================================
      // DONATION
      // =========================================================
      else if (type === "donation") {
        if (!form.newDonor && !form.donor_id) {
          throw new Error("Pilih donatur");
        }

        if (form.newDonor && !form.donor_name?.trim()) {
          throw new Error("Nama donatur wajib diisi");
        }

        const isGoods = form.type === "Barang";

        // ---------------------------------------------------------
        // DONASI UANG
        // ---------------------------------------------------------
        if (!isGoods) {
          if (!Number(form.amount)) {
            throw new Error("Nominal wajib diisi");
          }
        }

        // ---------------------------------------------------------
        // DONASI BARANG
        // ---------------------------------------------------------
        if (isGoods) {
          if (!form.item_name?.trim()) {
            throw new Error("Nama barang wajib diisi");
          }

          if (!Number(form.item_quantity)) {
            throw new Error("Jumlah barang wajib diisi");
          }
        }

        await api.post("/donations", {
          donor_id: form.newDonor ? null : form.donor_id,

          donor_name: form.newDonor
            ? form.donor_name
            : null,

          donor_phone: form.newDonor
            ? form.donor_phone
            : null,

          program_id: form.program_id || null,

          date: form.date,

          // Jenis donasi langsung menggunakan pilihan
          // Sedekah / Infak / Zakat / Barang / dst.
          type: form.type,

          // PENTING:
          // Barang tidak masuk sebagai pemasukan uang.
          amount: isGoods
            ? 0
            : Number(form.amount),

          // -------------------------------------------------------
          // DATA BARANG
          // -------------------------------------------------------
          item_name: isGoods
            ? form.item_name
            : null,

          item_description: isGoods
            ? form.item_description || ""
            : "",

          item_quantity: isGoods
            ? Number(form.item_quantity)
            : 0,

          item_unit: isGoods
            ? form.item_unit || ""
            : "",

          item_condition: isGoods
            ? form.item_condition || ""
            : "",

          // Estimasi nilai barang hanya sebagai nilai aset/barang,
          // BUKAN pemasukan uang.
          estimated_value: isGoods
            ? Number(form.estimated_value) || 0
            : 0,

          // Barang otomatis dicatat sebagai Non-Tunai.
          payment_method: isGoods
            ? "Non-Tunai"
            : form.payment_method,

          payment_status: form.payment_status,

          notes: form.notes || "",
        });

        toast(
          isGoods
            ? "Donasi barang berhasil dicatat"
            : "Donasi berhasil dicatat",
          "success"
        );
      }

      // =========================================================
      // EXPENSE
      // =========================================================
      else if (type === "expense") {
        if (!form.description?.trim()) {
          throw new Error("Deskripsi wajib diisi");
        }

        if (!Number(form.amount)) {
          throw new Error("Nominal wajib diisi");
        }

        await api.post("/expenses", {
          description: form.description,
          category: form.category,
          amount: Number(form.amount),
          program_id: form.program_id || null,
          payment_method: form.payment_method,
          date: form.date,
          notes: form.notes || "",
        });

        toast("Pengeluaran berhasil dicatat", "success");
      }

      // =========================================================
      // DONOR
      // =========================================================
      else if (type === "donor") {
        if (!form.name?.trim()) {
          throw new Error("Nama donatur wajib diisi");
        }

        await api.post("/donors", {
          name: form.name,
          phone: form.phone || "",
          notes: form.notes || "",
        });

        toast("Donatur berhasil ditambahkan", "success");
      }

      // =========================================================
      // LEAD / TAMU
      // =========================================================
      else if (type === "lead") {
        if (!form.name?.trim()) {
          throw new Error("Nama tamu wajib diisi");
        }

        await api.post("/leads", {
          name: form.name.trim(),
          phone: form.phone || "",
          organization: form.organization || "",
          purpose: form.purpose || "",
          source: form.source || "Tamu Masjid",
          interest: form.interest || "Lainnya",
          status: form.lead_status || "Input",
          notes: form.notes || "",
          pic_id: form.pic_id || null,
          date: form.date,
        });

        toast("Lead berhasil dicatat", "success");
      }

      router.back();
    } catch (e: any) {
      toast(e?.message || "Gagal menyimpan", "error");
    } finally {
      setSaving(false);
    }
  }, [type, form, router, toast]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
      }}
    >
      {/* HEADER */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.sm,
          },
        ]}
      >
        <ScreenHeader
          title={TITLES[type as string] || "Baru"}
          onBack={() => router.back()}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.md,
            paddingBottom: insets.bottom + 120,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* =====================================================
              TASK
          ===================================================== */}
          {type === "task" && (
            <>
              <TextField
                label="Judul"
                value={form.title || ""}
                onChangeText={(v) => set("title", v)}
                placeholder="Judul tugas konten"
                testID="f-title"
              />

              <TextField
                label="Deskripsi"
                value={form.description || ""}
                onChangeText={(v) => set("description", v)}
                placeholder="Deskripsi singkat"
                multiline
                testID="f-desc"
              />

              <SelectField
                label="Kategori"
                value={form.category}
                options={TASK_CATEGORIES}
                onSelect={(v) => set("category", v)}
                testID="f-category"
              />

              <SelectField
                label="Prioritas"
                value={form.priority}
                options={TASK_PRIORITIES}
                onSelect={(v) => set("priority", v)}
                testID="f-priority"
              />

              <SelectField
                label="Status"
                value={form.status}
                options={TASK_STATUSES}
                onSelect={(v) => set("status", v)}
                testID="f-status"
              />

              <EntitySelect
                label="Program Terkait"
                value={form.program_id}
                items={programs}
                onSelect={(v) => set("program_id", v)}
                allowNone
                testID="f-program"
              />

              <EntitySelect
                label="PIC (Penanggung Jawab)"
                value={form.assigned_user_id}
                items={users}
                onSelect={(v) =>
                  set("assigned_user_id", v)
                }
                allowNone
                testID="f-pic"
              />

              <DateField
                label="Tanggal Mulai"
                value={form.start_date}
                onChange={(v) => set("start_date", v)}
                testID="f-start"
              />

              <DateField
                label="Deadline"
                value={form.deadline}
                onChange={(v) => set("deadline", v)}
                testID="f-deadline"
              />
            </>
          )}

          {/* =====================================================
              PROGRAM
          ===================================================== */}
          {type === "program" && (
            <>
              <TextField
                label="Nama Program"
                value={form.name || ""}
                onChangeText={(v) => set("name", v)}
                placeholder="cth: Program Makan Gratis"
                testID="f-name"
              />

              <TextField
                label="Kategori"
                value={form.category || ""}
                onChangeText={(v) =>
                  set("category", v)
                }
                placeholder="cth: Sosial"
                testID="f-pcategory"
              />

              <TextField
                label="Deskripsi"
                value={form.description || ""}
                onChangeText={(v) =>
                  set("description", v)
                }
                multiline
                testID="f-pdesc"
              />

              <TextField
                label="Target Dana (Rp)"
                value={form.target}
                onChangeText={(v) =>
                  set(
                    "target",
                    v.replace(/[^0-9]/g, "")
                  )
                }
                keyboardType="number-pad"
                placeholder="0"
                testID="f-target"
              />

              <SelectField
                label="Status"
                value={form.status}
                options={PROGRAM_STATUSES}
                onSelect={(v) => set("status", v)}
                testID="f-pstatus"
              />

              <EntitySelect
                label="PIC"
                value={form.pic_id}
                items={users}
                onSelect={(v) => set("pic_id", v)}
                allowNone
                testID="f-ppic"
              />

              <DateField
                label="Tanggal Mulai"
                value={form.start_date}
                onChange={(v) =>
                  set("start_date", v)
                }
                testID="f-pstart"
              />

              <DateField
                label="Tanggal Selesai"
                value={form.end_date}
                onChange={(v) =>
                  set("end_date", v)
                }
                testID="f-pend"
              />
            </>
          )}

          {/* =====================================================
              DONATION
          ===================================================== */}
          {type === "donation" && (
            <>
              {/* DONATUR */}
              <View style={styles.toggleRow}>
                <Pressable
                  testID="donor-existing"
                  onPress={() =>
                    set("newDonor", false)
                  }
                  style={[
                    styles.togglePill,
                    !form.newDonor &&
                      styles.togglePillActive,
                  ]}
                >
                  <T
                    weight="semibold"
                    color={
                      !form.newDonor
                        ? "#fff"
                        : colors.onSurfaceSecondary
                    }
                  >
                    Donatur Ada
                  </T>
                </Pressable>

                <Pressable
                  testID="donor-new"
                  onPress={() =>
                    set("newDonor", true)
                  }
                  style={[
                    styles.togglePill,
                    form.newDonor &&
                      styles.togglePillActive,
                  ]}
                >
                  <T
                    weight="semibold"
                    color={
                      form.newDonor
                        ? "#fff"
                        : colors.onSurfaceSecondary
                    }
                  >
                    Donatur Baru
                  </T>
                </Pressable>
              </View>

              {form.newDonor ? (
                <>
                  <TextField
                    label="Nama Donatur"
                    value={form.donor_name || ""}
                    onChangeText={(v) =>
                      set("donor_name", v)
                    }
                    placeholder="Nama lengkap"
                    testID="f-donorname"
                  />

                  <TextField
                    label="No. Telepon"
                    value={form.donor_phone || ""}
                    onChangeText={(v) =>
                      set("donor_phone", v)
                    }
                    keyboardType="phone-pad"
                    placeholder="08xxx"
                    testID="f-donorphone"
                  />
                </>
              ) : (
                <EntitySelect
                  label="Donatur"
                  value={form.donor_id}
                  items={donors}
                  onSelect={(v) =>
                    set("donor_id", v)
                  }
                  testID="f-donor"
                />
              )}

              {/* PROGRAM */}
              <EntitySelect
                label="Program"
                value={form.program_id}
                items={programs}
                onSelect={(v) =>
                  set("program_id", v)
                }
                allowNone
                testID="f-dprogram"
              />

              {/* =================================================
                  JENIS DONASI
                  Barang sekarang dipilih langsung dari sini.
              ================================================= */}
              <SelectField
                label="Jenis Donasi"
                value={form.type}
                options={DONATION_TYPES}
                onSelect={(v) => set("type", v)}
                testID="f-dtype"
              />

              {/* =================================================
                  DONASI UANG
                  Semua jenis selain Barang masuk ke alur uang.
              ================================================= */}
              {form.type !== "Barang" ? (
                <>
                  <TextField
                    label="Nominal (Rp)"
                    value={form.amount}
                    onChangeText={(v) =>
                      set(
                        "amount",
                        v.replace(/[^0-9]/g, "")
                      )
                    }
                    keyboardType="number-pad"
                    placeholder="0"
                    testID="f-amount"
                  />

                  <SelectField
                    label="Metode Pembayaran"
                    value={form.payment_method}
                    options={PAYMENT_METHODS}
                    onSelect={(v) =>
                      set(
                        "payment_method",
                        v
                      )
                    }
                    testID="f-method"
                  />

                  <SelectField
                    label="Status Pembayaran"
                    value={form.payment_status}
                    options={PAYMENT_STATUSES}
                    onSelect={(v) =>
                      set(
                        "payment_status",
                        v
                      )
                    }
                    testID="f-pstatus2"
                  />

                  {(
                    form.payment_method ===
                      "QRIS" ||
                    form.payment_method ===
                      "Payment Gateway"
                  ) ? (
                    <View
                      style={styles.pendingBox}
                    >
                      <Ionicons
                        name="construct-outline"
                        size={16}
                        color={colors.warning}
                      />

                      <T
                        size={font.sm}
                        color={
                          colors.onSurfaceSecondary
                        }
                        style={{ flex: 1 }}
                      >
                        Integrasi Payment
                        Gateway/QRIS otomatis
                        belum aktif (pending).
                        Status dicatat manual.
                      </T>
                    </View>
                  ) : null}
                </>
              ) : (
                /* =================================================
                   DONASI BARANG
                ================================================= */
                <>
                  <TextField
                    label="Nama Barang"
                    value={form.item_name}
                    onChangeText={(v) =>
                      set("item_name", v)
                    }
                    placeholder="Contoh: Beras"
                    testID="f-item-name"
                  />

                  <TextField
                    label="Deskripsi Barang"
                    value={
                      form.item_description
                    }
                    onChangeText={(v) =>
                      set(
                        "item_description",
                        v
                      )
                    }
                    placeholder="Contoh: Beras premium 5 kg"
                    multiline
                    testID="f-item-description"
                  />

                  <TextField
                    label="Jumlah"
                    value={form.item_quantity}
                    onChangeText={(v) =>
                      set(
                        "item_quantity",
                        v.replace(
                          /[^0-9.]/g,
                          ""
                        )
                      )
                    }
                    keyboardType="decimal-pad"
                    placeholder="0"
                    testID="f-item-quantity"
                  />

                  <TextField
                    label="Satuan"
                    value={form.item_unit}
                    onChangeText={(v) =>
                      set(
                        "item_unit",
                        v
                      )
                    }
                    placeholder="Contoh: kg, dus, pcs"
                    testID="f-item-unit"
                  />

                  <SelectField
                    label="Kondisi Barang"
                    value={
                      form.item_condition
                    }
                    options={[
                      "Baik",
                      "Baru",
                      "Layak Pakai",
                      "Perlu Pemeriksaan",
                    ]}
                    onSelect={(v) =>
                      set(
                        "item_condition",
                        v
                      )
                    }
                    testID="f-item-condition"
                  />

                  <TextField
                    label="Estimasi Nilai (Rp)"
                    value={
                      form.estimated_value
                    }
                    onChangeText={(v) =>
                      set(
                        "estimated_value",
                        v.replace(
                          /[^0-9]/g,
                          ""
                        )
                      )
                    }
                    keyboardType="number-pad"
                    placeholder="0"
                    testID="f-estimated-value"
                  />

                  <View
                    style={styles.pendingBox}
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={16}
                      color={colors.warning}
                    />

                    <T
                      size={font.sm}
                      color={
                        colors.onSurfaceSecondary
                      }
                      style={{ flex: 1 }}
                    >
                      Estimasi nilai barang
                      hanya untuk pencatatan
                      laporan dan tidak
                      dihitung sebagai
                      pemasukan uang.
                    </T>
                  </View>
                </>
              )}

              {/* TANGGAL */}
              <DateField
                label="Tanggal"
                value={form.date}
                onChange={(v) =>
                  set("date", v)
                }
                testID="f-date"
              />

              {/* CATATAN */}
              <TextField
                label="Catatan"
                value={form.notes || ""}
                onChangeText={(v) =>
                  set("notes", v)
                }
                multiline
                testID="f-notes"
              />
            </>
          )}

          {/* =====================================================
              EXPENSE
          ===================================================== */}
          {type === "expense" && (
            <>
              <TextField
                label="Deskripsi"
                value={form.description || ""}
                onChangeText={(v) =>
                  set("description", v)
                }
                placeholder="cth: Pembelian bahan makanan"
                testID="f-edesc"
              />

              <SelectField
                label="Kategori"
                value={form.category}
                options={EXPENSE_CATEGORIES}
                onSelect={(v) =>
                  set("category", v)
                }
                testID="f-ecategory"
              />

              <TextField
                label="Nominal (Rp)"
                value={form.amount}
                onChangeText={(v) =>
                  set(
                    "amount",
                    v.replace(
                      /[^0-9]/g,
                      ""
                    )
                  )
                }
                keyboardType="number-pad"
                placeholder="0"
                testID="f-eamount"
              />

              <EntitySelect
                label="Program Terkait"
                value={form.program_id}
                items={programs}
                onSelect={(v) =>
                  set("program_id", v)
                }
                allowNone
                testID="f-eprogram"
              />

              <SelectField
                label="Metode Pembayaran"
                value={form.payment_method}
                options={PAYMENT_METHODS}
                onSelect={(v) =>
                  set(
                    "payment_method",
                    v
                  )
                }
                testID="f-emethod"
              />

              <DateField
                label="Tanggal"
                value={form.date}
                onChange={(v) =>
                  set("date", v)
                }
                testID="f-edate"
              />

              <TextField
                label="Catatan"
                value={form.notes || ""}
                onChangeText={(v) =>
                  set("notes", v)
                }
                multiline
                testID="f-enotes"
              />
            </>
          )}

          {/* =====================================================
              DONOR
          ===================================================== */}
          {type === "donor" && (
            <>
              <TextField
                label="Nama Donatur"
                value={form.name || ""}
                onChangeText={(v) =>
                  set("name", v)
                }
                placeholder="Nama lengkap"
                testID="f-dname"
              />

              <TextField
                label="No. Telepon"
                value={form.phone || ""}
                onChangeText={(v) =>
                  set("phone", v)
                }
                keyboardType="phone-pad"
                placeholder="08xxx"
                testID="f-dphone"
              />

              <TextField
                label="Catatan"
                value={form.notes || ""}
                onChangeText={(v) =>
                  set("notes", v)
                }
                multiline
                testID="f-dnotes"
              />
            </>
          )}

          {/* =====================================================
              LEAD / TAMU
          ===================================================== */}
          {type === "lead" && (
            <>
              <TextField
                label="Nama Tamu / Lead"
                value={form.name || ""}
                onChangeText={(v) => set("name", v)}
                placeholder="Nama lengkap"
                testID="f-lead-name"
              />

              <TextField
                label="WhatsApp"
                value={form.phone || ""}
                onChangeText={(v) => set("phone", v)}
                keyboardType="phone-pad"
                placeholder="08xxx"
                testID="f-lead-phone"
              />

              <TextField
                label="Organisasi / Instansi"
                value={form.organization || ""}
                onChangeText={(v) =>
                  set("organization", v)
                }
                placeholder="Nama organisasi (opsional)"
                testID="f-lead-organization"
              />

              <TextField
                label="Keperluan"
                value={form.purpose || ""}
                onChangeText={(v) =>
                  set("purpose", v)
                }
                placeholder="Keperluan / kebutuhan tamu"
                multiline
                testID="f-lead-purpose"
              />

              <SelectField
                label="Sumber"
                value={
                  form.source || "Tamu Masjid"
                }
                options={[
                  "Tamu Masjid",
                  "WhatsApp",
                  "Instagram",
                  "Kajian",
                  "Program",
                  "Donatur",
                  "Lainnya",
                ]}
                onSelect={(v) =>
                  set("source", v)
                }
                testID="f-lead-source"
              />

              <SelectField
                label="Ketertarikan"
                value={
                  form.interest || "Lainnya"
                }
                options={[
                  "Zakat",
                  "Infak",
                  "Sedekah",
                  "Wakaf",
                  "Program",
                  "Layanan Masjid",
                  "Lainnya",
                ]}
                onSelect={(v) =>
                  set("interest", v)
                }
                testID="f-lead-interest"
              />

              <SelectField
                label="Status"
                value={
                  form.lead_status || "Input"
                }
                options={[
                  "Input",
                  "Follow Up",
                  "Qualified",
                  "Converted",
                  "Lost",
                ]}
                onSelect={(v) =>
                  set("lead_status", v)
                }
                testID="f-lead-status"
              />

              <EntitySelect
                label="PIC"
                value={form.pic_id}
                items={users}
                onSelect={(v) =>
                  set("pic_id", v)
                }
                allowNone
                testID="f-lead-pic"
              />

              <DateField
                label="Tanggal"
                value={form.date}
                onChange={(v) =>
                  set("date", v)
                }
                testID="f-lead-date"
              />

              <TextField
                label="Catatan"
                value={form.notes || ""}
                onChangeText={(v) =>
                  set("notes", v)
                }
                placeholder="Catatan follow up"
                multiline
                testID="f-lead-notes"
              />
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* FOOTER */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom:
              insets.bottom + spacing.md,
          },
        ]}
      >
        <PrimaryButton
          label="Simpan"
          onPress={submit}
          loading={saving}
          testID="submit-create"
        />
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },

  toggleRow: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: 4,
  },

  togglePill: {
    flex: 1,
    height: 40,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },

  togglePillActive: {
    backgroundColor: colors.brand,
  },

  pendingBox: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: "#FEF9F0",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#F5E4C3",
  },
});