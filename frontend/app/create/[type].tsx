import React, { useCallback, useEffect, useState } from "react";
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

/* =========================================================
   TITLES
========================================================= */

const TITLES: Record<string, string> = {
  task: "Tugas Baru",
  donation: "Donasi Baru",
  program: "Program Baru",
  expense: "Pengeluaran Baru",
  donor: "Donatur Baru",
  lead: "Input Tamu",
};

/* =========================================================
   CONSTANTS
========================================================= */

const LEAD_SOURCES = [
  "Tamu Masjid",
  "WhatsApp",
  "Instagram",
  "Kajian",
  "Program",
  "Donatur",
  "Lainnya",
];

const LEAD_INTERESTS = [
  "Zakat",
  "Infak",
  "Sedekah",
  "Wakaf",
  "Program",
  "Layanan Masjid",
  "Lainnya",
];

const LEAD_STATUSES = [
  "Input",
  "Follow Up",
  "Qualified",
  "Converted",
  "Lost",
];

const ITEM_CONDITIONS = [
  "Baik",
  "Baru",
  "Layak Pakai",
  "Perlu Pemeriksaan",
];

/* =========================================================
   SCREEN
========================================================= */

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

  /* =======================================================
     FORM STATE
  ======================================================= */

  const [form, setForm] = useState<any>({
    date: new Date().toISOString(),

    /* Task */
    priority: "Medium",

    /* General status */
    status: type === "program" ? "Active" : "Draft",

    /* Category */
    category:
      type === "task"
        ? "Feed"
        : type === "expense"
          ? "Operational"
          : "Sosial",

    /* Donation */
    type: "Sedekah",
    payment_method: "Cash",
    payment_status: "Paid",

    /* General */
    target: "",
    amount: "",

    /* Donasi Barang */
    item_name: "",
    item_description: "",
    item_quantity: "",
    item_unit: "",
    item_condition: "Baik",
    estimated_value: "",

    /* Donatur */
    newDonor: false,

    /* Lead */
    name: "",
    phone: "",
    organization: "",
    purpose: "",
    source: "Tamu Masjid",
    interest: "Lainnya",
    lead_status: "Input",
    pic_id: "",
    notes: "",
  });

  const set = useCallback((key: string, value: any) => {
    setForm((prev: any) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  /* =======================================================
     LOAD DATA
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        /* ---------------------------------------------------
           PROGRAMS
        --------------------------------------------------- */

        if (
          ["task", "donation", "expense", "program"].includes(
            type as string
          )
        ) {
          const programData = await api.get<any[]>("/programs");

          if (mounted) {
            setPrograms(programData || []);
          }
        }

        /* ---------------------------------------------------
           USERS / PIC
        --------------------------------------------------- */

        if (
          type === "task" ||
          type === "program" ||
          type === "lead"
        ) {
          const userData = await api.get<any[]>("/users");

          if (mounted) {
            setUsers(userData || []);
          }
        }

        /* ---------------------------------------------------
           DONORS
        --------------------------------------------------- */

        if (type === "donation") {
          const donorData = await api.get<any[]>("/donors");

          if (mounted) {
            setDonors(donorData || []);
          }
        }

        /* ---------------------------------------------------
           QUICK ACTION: /create/donation?kind=barang
        --------------------------------------------------- */

        if (type === "donation" && kind === "barang") {
          if (mounted) {
            setForm((prev: any) => ({
              ...prev,
              type: "Barang",
            }));
          }
        }
      } catch (error) {
        console.error("Create form load error:", error);
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [type, kind]);

  /* =======================================================
     SUBMIT
  ======================================================= */

  const submit = useCallback(async () => {
    if (saving) return;

    setSaving(true);

    try {
      /* =====================================================
         TASK
      ===================================================== */

      if (type === "task") {
        if (!form.title?.trim()) {
          throw new Error("Judul wajib diisi");
        }

        await api.post("/tasks", {
          title: form.title.trim(),
          description: form.description?.trim() || "",
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

      /* =====================================================
         PROGRAM
      ===================================================== */

      else if (type === "program") {
        if (!form.name?.trim()) {
          throw new Error("Nama program wajib diisi");
        }

        await api.post("/programs", {
          name: form.name.trim(),
          category: form.category || "Sosial",
          description: form.description?.trim() || "",
          target: Number(form.target) || 0,
          status: form.status,
          pic_id: form.pic_id || null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
        });

        toast("Program berhasil dibuat", "success");
      }

      /* =====================================================
         DONATION
      ===================================================== */

      else if (type === "donation") {
        /* ---------------------------------------------------
           VALIDASI DONATUR
        --------------------------------------------------- */

        if (!form.newDonor && !form.donor_id) {
          throw new Error("Pilih donatur");
        }

        if (
          form.newDonor &&
          !form.donor_name?.trim()
        ) {
          throw new Error("Nama donatur wajib diisi");
        }

        const isGoods = form.type === "Barang";

        /* ---------------------------------------------------
           DONASI UANG
        --------------------------------------------------- */

        if (!isGoods) {
          const amount = Number(form.amount);

          if (!amount || amount <= 0) {
            throw new Error("Nominal wajib diisi");
          }
        }

        /* ---------------------------------------------------
           DONASI BARANG
        --------------------------------------------------- */

        if (isGoods) {
          const quantity = Number(form.item_quantity);

          if (!form.item_name?.trim()) {
            throw new Error("Nama barang wajib diisi");
          }

          if (!quantity || quantity <= 0) {
            throw new Error("Jumlah barang wajib diisi");
          }
        }

        /* ---------------------------------------------------
           SUBMIT DONASI
        --------------------------------------------------- */

        await api.post("/donations", {
          donor_id: form.newDonor
            ? null
            : form.donor_id || null,

          donor_name: form.newDonor
            ? form.donor_name.trim()
            : null,

          donor_phone: form.newDonor
            ? form.donor_phone || ""
            : null,

          program_id: form.program_id || null,

          date: form.date,

          /*
           * Jenis donasi:
           * Sedekah / Infak / Zakat / Barang / dst.
           */
          type: form.type,

          /*
           * PENTING:
           *
           * Donasi barang TIDAK masuk sebagai
           * pemasukan uang.
           */
          amount: isGoods
            ? 0
            : Number(form.amount),

          /* -------------------------------------------------
             DATA BARANG
          ------------------------------------------------- */

          item_name: isGoods
            ? form.item_name.trim()
            : null,

          item_description: isGoods
            ? form.item_description?.trim() || ""
            : "",

          item_quantity: isGoods
            ? Number(form.item_quantity)
            : 0,

          item_unit: isGoods
            ? form.item_unit?.trim() || ""
            : "",

          item_condition: isGoods
            ? form.item_condition || ""
            : "",

          /*
           * Estimasi nilai barang hanya untuk
           * pencatatan nilai barang.
           *
           * TIDAK dihitung sebagai pemasukan uang.
           */
          estimated_value: isGoods
            ? Number(form.estimated_value) || 0
            : 0,

          /*
           * Barang otomatis dicatat sebagai
           * transaksi Non-Tunai.
           */
          payment_method: isGoods
            ? "Non-Tunai"
            : form.payment_method,

          payment_status: form.payment_status,

          notes: form.notes?.trim() || "",
        });

        toast(
          isGoods
            ? "Donasi barang berhasil dicatat"
            : "Donasi berhasil dicatat",
          "success"
        );
      }

      /* =====================================================
         EXPENSE
      ===================================================== */

      else if (type === "expense") {
        if (!form.description?.trim()) {
          throw new Error("Deskripsi wajib diisi");
        }

        const amount = Number(form.amount);

        if (!amount || amount <= 0) {
          throw new Error("Nominal wajib diisi");
        }

        await api.post("/expenses", {
          description: form.description.trim(),
          category: form.category,
          amount,
          program_id: form.program_id || null,
          payment_method: form.payment_method,
          date: form.date,
          notes: form.notes?.trim() || "",
        });

        toast(
          "Pengeluaran berhasil dicatat",
          "success"
        );
      }

      /* =====================================================
         DONOR
      ===================================================== */

      else if (type === "donor") {
        if (!form.name?.trim()) {
          throw new Error("Nama donatur wajib diisi");
        }

        await api.post("/donors", {
          name: form.name.trim(),
          phone: form.phone || "",
          notes: form.notes?.trim() || "",
        });

        toast(
          "Donatur berhasil ditambahkan",
          "success"
        );
      }

      /* =====================================================
         LEAD / TAMU
      ===================================================== */

      else if (type === "lead") {
        if (!form.name?.trim()) {
          throw new Error("Nama tamu wajib diisi");
        }

        await api.post("/leads", {
          name: form.name.trim(),
          phone: form.phone || "",
          organization:
            form.organization?.trim() || "",
          purpose:
            form.purpose?.trim() || "",
          source:
            form.source || "Tamu Masjid",
          interest:
            form.interest || "Lainnya",
          status:
            form.lead_status || "Input",
          notes:
            form.notes?.trim() || "",
          pic_id:
            form.pic_id || null,
          date: form.date,
        });

        toast(
          "Lead berhasil dicatat",
          "success"
        );
      }

      /* =====================================================
         BACK
      ===================================================== */

      router.back();
    } catch (error: any) {
      console.error("Create submit error:", error);

      toast(
        error?.message || "Gagal menyimpan",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }, [
    type,
    form,
    saving,
    router,
    toast,
  ]);

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <View style={styles.container}>
      {/* =====================================================
          HEADER
      ===================================================== */}

      <View
        style={[
          styles.header,
          {
            paddingTop:
              insets.top + spacing.sm,
          },
        ]}
      >
        <ScreenHeader
          title={
            TITLES[type as string] || "Baru"
          }
          onBack={() => router.back()}
        />
      </View>

      {/* =====================================================
          FORM
      ===================================================== */}

      <KeyboardAvoidingView
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom:
                insets.bottom + 120,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* =================================================
              TASK
          ================================================= */}

          {type === "task" && (
            <>
              <TextField
                label="Judul"
                value={form.title || ""}
                onChangeText={(value) =>
                  set("title", value)
                }
                placeholder="Judul tugas konten"
                testID="f-title"
              />

              <TextField
                label="Deskripsi"
                value={form.description || ""}
                onChangeText={(value) =>
                  set("description", value)
                }
                placeholder="Deskripsi singkat"
                multiline
                testID="f-desc"
              />

              <SelectField
                label="Kategori"
                value={form.category}
                options={TASK_CATEGORIES}
                onSelect={(value) =>
                  set("category", value)
                }
                testID="f-category"
              />

              <SelectField
                label="Prioritas"
                value={form.priority}
                options={TASK_PRIORITIES}
                onSelect={(value) =>
                  set("priority", value)
                }
                testID="f-priority"
              />

              <SelectField
                label="Status"
                value={form.status}
                options={TASK_STATUSES}
                onSelect={(value) =>
                  set("status", value)
                }
                testID="f-status"
              />

              <EntitySelect
                label="Program Terkait"
                value={form.program_id}
                items={programs}
                onSelect={(value) =>
                  set("program_id", value)
                }
                allowNone
                testID="f-program"
              />

              <EntitySelect
                label="PIC (Penanggung Jawab)"
                value={form.assigned_user_id}
                items={users}
                onSelect={(value) =>
                  set(
                    "assigned_user_id",
                    value
                  )
                }
                allowNone
                testID="f-pic"
              />

              <DateField
                label="Tanggal Mulai"
                value={form.start_date}
                onChange={(value) =>
                  set(
                    "start_date",
                    value
                  )
                }
                testID="f-start"
              />

              <DateField
                label="Deadline"
                value={form.deadline}
                onChange={(value) =>
                  set(
                    "deadline",
                    value
                  )
                }
                testID="f-deadline"
              />
            </>
          )}

          {/* =================================================
              PROGRAM
          ================================================= */}

          {type === "program" && (
            <>
              <TextField
                label="Nama Program"
                value={form.name || ""}
                onChangeText={(value) =>
                  set("name", value)
                }
                placeholder="cth: Program Makan Gratis"
                testID="f-name"
              />

              <TextField
                label="Kategori"
                value={form.category || ""}
                onChangeText={(value) =>
                  set(
                    "category",
                    value
                  )
                }
                placeholder="cth: Sosial"
                testID="f-pcategory"
              />

              <TextField
                label="Deskripsi"
                value={form.description || ""}
                onChangeText={(value) =>
                  set(
                    "description",
                    value
                  )
                }
                multiline
                testID="f-pdesc"
              />

              <TextField
                label="Target Dana (Rp)"
                value={form.target}
                onChangeText={(value) =>
                  set(
                    "target",
                    value.replace(
                      /[^0-9]/g,
                      ""
                    )
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
                onSelect={(value) =>
                  set("status", value)
                }
                testID="f-pstatus"
              />

              <EntitySelect
                label="PIC"
                value={form.pic_id}
                items={users}
                onSelect={(value) =>
                  set("pic_id", value)
                }
                allowNone
                testID="f-ppic"
              />

              <DateField
                label="Tanggal Mulai"
                value={form.start_date}
                onChange={(value) =>
                  set(
                    "start_date",
                    value
                  )
                }
                testID="f-pstart"
              />

              <DateField
                label="Tanggal Selesai"
                value={form.end_date}
                onChange={(value) =>
                  set(
                    "end_date",
                    value
                  )
                }
                testID="f-pend"
              />
            </>
          )}

          {/* =================================================
              DONATION
          ================================================= */}

          {type === "donation" && (
            <>
              {/* ---------------------------------------------
                  DONATUR
              --------------------------------------------- */}

              <View style={styles.toggleRow}>
                <Pressable
                  testID="donor-existing"
                  onPress={() =>
                    set(
                      "newDonor",
                      false
                    )
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
                    set(
                      "newDonor",
                      true
                    )
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
                    value={
                      form.donor_name ||
                      ""
                    }
                    onChangeText={(value) =>
                      set(
                        "donor_name",
                        value
                      )
                    }
                    placeholder="Nama lengkap"
                    testID="f-donorname"
                  />

                  <TextField
                    label="No. Telepon"
                    value={
                      form.donor_phone ||
                      ""
                    }
                    onChangeText={(value) =>
                      set(
                        "donor_phone",
                        value
                      )
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
                  onSelect={(value) =>
                    set(
                      "donor_id",
                      value
                    )
                  }
                  testID="f-donor"
                />
              )}

              {/* ---------------------------------------------
                  PROGRAM
              --------------------------------------------- */}

              <EntitySelect
                label="Program"
                value={form.program_id}
                items={programs}
                onSelect={(value) =>
                  set(
                    "program_id",
                    value
                  )
                }
                allowNone
                testID="f-dprogram"
              />

              {/* ---------------------------------------------
                  JENIS DONASI
              --------------------------------------------- */}

              <SelectField
                label="Jenis Donasi"
                value={form.type}
                options={DONATION_TYPES}
                onSelect={(value) =>
                  set("type", value)
                }
                testID="f-dtype"
              />

              {/* ---------------------------------------------
                  DONASI UANG
              --------------------------------------------- */}

              {form.type !== "Barang" ? (
                <>
                  <TextField
                    label="Nominal (Rp)"
                    value={form.amount}
                    onChangeText={(value) =>
                      set(
                        "amount",
                        value.replace(
                          /[^0-9]/g,
                          ""
                        )
                      )
                    }
                    keyboardType="number-pad"
                    placeholder="0"
                    testID="f-amount"
                  />

                  <SelectField
                    label="Metode Pembayaran"
                    value={
                      form.payment_method
                    }
                    options={
                      PAYMENT_METHODS
                    }
                    onSelect={(value) =>
                      set(
                        "payment_method",
                        value
                      )
                    }
                    testID="f-method"
                  />

                  <SelectField
                    label="Status Pembayaran"
                    value={
                      form.payment_status
                    }
                    options={
                      PAYMENT_STATUSES
                    }
                    onSelect={(value) =>
                      set(
                        "payment_status",
                        value
                      )
                    }
                    testID="f-pstatus2"
                  />

                  {(form.payment_method ===
                    "QRIS" ||
                    form.payment_method ===
                      "Payment Gateway") && (
                    <View
                      style={
                        styles.pendingBox
                      }
                    >
                      <Ionicons
                        name="construct-outline"
                        size={16}
                        color={
                          colors.warning
                        }
                      />

                      <T
                        size={font.sm}
                        color={
                          colors.onSurfaceSecondary
                        }
                        style={{
                          flex: 1,
                        }}
                      >
                        Integrasi Payment
                        Gateway/QRIS
                        otomatis belum
                        aktif (pending).
                        Status dicatat
                        manual.
                      </T>
                    </View>
                  )}
                </>
              ) : (
                /* -------------------------------------------
                   DONASI BARANG
                ------------------------------------------- */

                <>
                  <TextField
                    label="Nama Barang"
                    value={
                      form.item_name
                    }
                    onChangeText={(value) =>
                      set(
                        "item_name",
                        value
                      )
                    }
                    placeholder="Contoh: Beras"
                    testID="f-item-name"
                  />

                  <TextField
                    label="Deskripsi Barang"
                    value={
                      form.item_description
                    }
                    onChangeText={(value) =>
                      set(
                        "item_description",
                        value
                      )
                    }
                    placeholder="Contoh: Beras premium 5 kg"
                    multiline
                    testID="f-item-description"
                  />

                  <TextField
                    label="Jumlah"
                    value={
                      form.item_quantity
                    }
                    onChangeText={(value) =>
                      set(
                        "item_quantity",
                        value.replace(
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
                    value={
                      form.item_unit
                    }
                    onChangeText={(value) =>
                      set(
                        "item_unit",
                        value
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
                    options={
                      ITEM_CONDITIONS
                    }
                    onSelect={(value) =>
                      set(
                        "item_condition",
                        value
                      )
                    }
                    testID="f-item-condition"
                  />

                  <TextField
                    label="Estimasi Nilai (Rp)"
                    value={
                      form.estimated_value
                    }
                    onChangeText={(value) =>
                      set(
                        "estimated_value",
                        value.replace(
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
                    style={
                      styles.pendingBox
                    }
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={16}
                      color={
                        colors.warning
                      }
                    />

                    <T
                      size={font.sm}
                      color={
                        colors.onSurfaceSecondary
                      }
                      style={{
                        flex: 1,
                      }}
                    >
                      Estimasi nilai
                      barang hanya
                      untuk pencatatan
                      laporan dan
                      tidak dihitung
                      sebagai
                      pemasukan uang.
                    </T>
                  </View>
                </>
              )}

              {/* ---------------------------------------------
                  TANGGAL
              --------------------------------------------- */}

              <DateField
                label="Tanggal"
                value={form.date}
                onChange={(value) =>
                  set(
                    "date",
                    value
                  )
                }
                testID="f-date"
              />

              {/* ---------------------------------------------
                  CATATAN
              --------------------------------------------- */}

              <TextField
                label="Catatan"
                value={
                  form.notes || ""
                }
                onChangeText={(value) =>
                  set(
                    "notes",
                    value
                  )
                }
                multiline
                testID="f-notes"
              />
            </>
          )}

          {/* =================================================
              EXPENSE
          ================================================= */}

          {type === "expense" && (
            <>
              <TextField
                label="Deskripsi"
                value={
                  form.description || ""
                }
                onChangeText={(value) =>
                  set(
                    "description",
                    value
                  )
                }
                placeholder="cth: Pembelian bahan makanan"
                testID="f-edesc"
              />

              <SelectField
                label="Kategori"
                value={form.category}
                options={
                  EXPENSE_CATEGORIES
                }
                onSelect={(value) =>
                  set(
                    "category",
                    value
                  )
                }
                testID="f-ecategory"
              />

              <TextField
                label="Nominal (Rp)"
                value={form.amount}
                onChangeText={(value) =>
                  set(
                    "amount",
                    value.replace(
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
                value={
                  form.program_id
                }
                items={programs}
                onSelect={(value) =>
                  set(
                    "program_id",
                    value
                  )
                }
                allowNone
                testID="f-eprogram"
              />

              <SelectField
                label="Metode Pembayaran"
                value={
                  form.payment_method
                }
                options={
                  PAYMENT_METHODS
                }
                onSelect={(value) =>
                  set(
                    "payment_method",
                    value
                  )
                }
                testID="f-emethod"
              />

              <DateField
                label="Tanggal"
                value={form.date}
                onChange={(value) =>
                  set(
                    "date",
                    value
                  )
                }
                testID="f-edate"
              />

              <TextField
                label="Catatan"
                value={
                  form.notes || ""
                }
                onChangeText={(value) =>
                  set(
                    "notes",
                    value
                  )
                }
                multiline
                testID="f-enotes"
              />
            </>
          )}

          {/* =================================================
              DONOR
          ================================================= */}

          {type === "donor" && (
            <>
              <TextField
                label="Nama Donatur"
                value={
                  form.name || ""
                }
                onChangeText={(value) =>
                  set(
                    "name",
                    value
                  )
                }
                placeholder="Nama lengkap"
                testID="f-dname"
              />

              <TextField
                label="No. Telepon"
                value={
                  form.phone || ""
                }
                onChangeText={(value) =>
                  set(
                    "phone",
                    value
                  )
                }
                keyboardType="phone-pad"
                placeholder="08xxx"
                testID="f-dphone"
              />

              <TextField
                label="Catatan"
                value={
                  form.notes || ""
                }
                onChangeText={(value) =>
                  set(
                    "notes",
                    value
                  )
                }
                multiline
                testID="f-dnotes"
              />
            </>
          )}

          {/* =================================================
              LEAD / TAMU
          ================================================= */}

          {type === "lead" && (
            <>
              <TextField
                label="Nama Tamu / Lead"
                value={
                  form.name || ""
                }
                onChangeText={(value) =>
                  set(
                    "name",
                    value
                  )
                }
                placeholder="Nama lengkap"
                testID="f-lead-name"
              />

              <TextField
                label="WhatsApp"
                value={
                  form.phone || ""
                }
                onChangeText={(value) =>
                  set(
                    "phone",
                    value
                  )
                }
                keyboardType="phone-pad"
                placeholder="08xxx"
                testID="f-lead-phone"
              />

              <TextField
                label="Organisasi / Instansi"
                value={
                  form.organization ||
                  ""
                }
                onChangeText={(value) =>
                  set(
                    "organization",
                    value
                  )
                }
                placeholder="Nama organisasi (opsional)"
                testID="f-lead-organization"
              />

              <TextField
                label="Keperluan"
                value={
                  form.purpose || ""
                }
                onChangeText={(value) =>
                  set(
                    "purpose",
                    value
                  )
                }
                placeholder="Keperluan / kebutuhan tamu"
                multiline
                testID="f-lead-purpose"
              />

              <SelectField
                label="Sumber"
                value={
                  form.source ||
                  "Tamu Masjid"
                }
                options={
                  LEAD_SOURCES
                }
                onSelect={(value) =>
                  set(
                    "source",
                    value
                  )
                }
                testID="f-lead-source"
              />

              <SelectField
                label="Ketertarikan"
                value={
                  form.interest ||
                  "Lainnya"
                }
                options={
                  LEAD_INTERESTS
                }
                onSelect={(value) =>
                  set(
                    "interest",
                    value
                  )
                }
                testID="f-lead-interest"
              />

              <SelectField
                label="Status"
                value={
                  form.lead_status ||
                  "Input"
                }
                options={
                  LEAD_STATUSES
                }
                onSelect={(value) =>
                  set(
                    "lead_status",
                    value
                  )
                }
                testID="f-lead-status"
              />

              <EntitySelect
                label="PIC"
                value={form.pic_id}
                items={users}
                onSelect={(value) =>
                  set(
                    "pic_id",
                    value
                  )
                }
                allowNone
                testID="f-lead-pic"
              />

              <DateField
                label="Tanggal"
                value={form.date}
                onChange={(value) =>
                  set(
                    "date",
                    value
                  )
                }
                testID="f-lead-date"
              />

              <TextField
                label="Catatan"
                value={
                  form.notes || ""
                }
                onChangeText={(value) =>
                  set(
                    "notes",
                    value
                  )
                }
                placeholder="Catatan follow up"
                multiline
                testID="f-lead-notes"
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* =====================================================
          FOOTER
      ===================================================== */}

      <View
        style={[
          styles.footer,
          {
            paddingBottom:
              insets.bottom +
              spacing.md,
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

/* ===========================================================
   STYLES
=========================================================== */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },

  flex: {
    flex: 1,
  },

  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },

  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },

  toggleRow: {
    flexDirection: "row",
    backgroundColor:
      colors.surfaceSecondary,
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