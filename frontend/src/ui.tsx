import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput, Modal,
  ScrollView, Animated, Platform, ViewStyle, TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import DateTimePicker from "@react-native-community/datetimepicker";
import { colors, spacing, radius, font, shadow, statusColors, priorityColors } from "@/src/theme";
import { formatDate } from "@/src/format";

// ---------------------------------------------------------------- Text
export function T({ children, style, weight = "regular", size = font.base, color = colors.onSurface, numberOfLines }:
  { children: React.ReactNode; style?: TextStyle | TextStyle[]; weight?: "regular" | "medium" | "semibold" | "bold";
    size?: number; color?: string; numberOfLines?: number }) {
  const w: TextStyle = {
    regular: { fontWeight: "400" as const },
    medium: { fontWeight: "500" as const },
    semibold: { fontWeight: "600" as const },
    bold: { fontWeight: "700" as const },
  }[weight];
  return <Text numberOfLines={numberOfLines} style={[{ fontSize: size, color }, w, style]}>{children}</Text>;
}

// ---------------------------------------------------------------- Card
export function Card({ children, style, onPress, testID }:
  { children: React.ReactNode; style?: ViewStyle | ViewStyle[]; onPress?: () => void; testID?: string }) {
  const content = <View style={[styles.card, style]}>{children}</View>;
  if (onPress) {
    return (
      <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
        {content}
      </Pressable>
    );
  }
  return <View testID={testID}>{content}</View>;
}

// ---------------------------------------------------------------- Badge
export function Badge({ label, bg, fg, style }:
  { label: string; bg: string; fg: string; style?: ViewStyle }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={{ color: fg, fontSize: font.sm, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const c = statusColors[status] || { bg: colors.surfaceTertiary, fg: colors.onSurfaceSecondary, label: status };
  return <Badge label={c.label} bg={c.bg} fg={c.fg} />;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const c = priorityColors[priority] || { bg: colors.surfaceTertiary, fg: colors.onSurfaceSecondary, label: priority };
  return <Badge label={c.label} bg={c.bg} fg={c.fg} />;
}

// ---------------------------------------------------------------- ProgressBar
export function ProgressBar({ value, color = colors.brand, height = 8, track = colors.surfaceTertiary }:
  { value: number; color?: string; height?: number; track?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={{ height, backgroundColor: track, borderRadius: radius.pill, overflow: "hidden" }}>
      <View style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: radius.pill }} />
    </View>
  );
}

// ---------------------------------------------------------------- Buttons
export function PrimaryButton({ label, onPress, loading, disabled, icon, style, testID, variant = "primary" }:
  { label: string; onPress: () => void; loading?: boolean; disabled?: boolean; icon?: any;
    style?: ViewStyle; testID?: string; variant?: "primary" | "gold" | "danger" }) {
  const bg = variant === "gold" ? colors.brandSecondary : variant === "danger" ? colors.error : colors.brand;
  return (
    <Pressable
      testID={testID}
      onPress={() => { if (!disabled && !loading) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress(); } }}
      style={({ pressed }) => [styles.primaryBtn, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.9 : 1 }, style]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          {icon ? <Ionicons name={icon} size={18} color="#fff" /> : null}
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: font.lg }}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function GhostButton({ label, onPress, icon, testID, color = colors.brand }:
  { label: string; onPress: () => void; icon?: any; testID?: string; color?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress}
      style={({ pressed }) => [styles.ghostBtn, { opacity: pressed ? 0.7 : 1, borderColor: colors.border }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        {icon ? <Ionicons name={icon} size={16} color={color} /> : null}
        <Text style={{ color, fontWeight: "600", fontSize: font.base }}>{label}</Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------- States
export function LoadingState({ label = "Memuat..." }: { label?: string }) {
  return (
    <View style={styles.centerState} testID="loading-state">
      <ActivityIndicator size="large" color={colors.brand} />
      <T color={colors.muted} style={{ marginTop: spacing.md }}>{label}</T>
    </View>
  );
}

export function EmptyState({ icon = "folder-open-outline", title, subtitle, action, testID }:
  { icon?: any; title: string; subtitle?: string; action?: React.ReactNode; testID?: string }) {
  return (
    <View style={styles.centerState} testID={testID || "empty-state"}>
      <View style={styles.emptyIcon}><Ionicons name={icon} size={34} color={colors.brand} /></View>
      <T weight="bold" size={font.lg} style={{ marginTop: spacing.lg, textAlign: "center" }}>{title}</T>
      {subtitle ? <T color={colors.muted} style={{ marginTop: spacing.xs, textAlign: "center" }}>{subtitle}</T> : null}
      {action ? <View style={{ marginTop: spacing.lg }}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <View style={styles.centerState} testID="error-state">
      <View style={[styles.emptyIcon, { backgroundColor: "#FDECEC" }]}>
        <Ionicons name="alert-circle-outline" size={34} color={colors.error} />
      </View>
      <T weight="bold" size={font.lg} style={{ marginTop: spacing.lg }}>Gagal memuat data</T>
      {message ? <T color={colors.muted} style={{ marginTop: spacing.xs, textAlign: "center" }}>{message}</T> : null}
      {onRetry ? <View style={{ marginTop: spacing.lg }}><GhostButton label="Coba lagi" icon="refresh" onPress={onRetry} /></View> : null}
    </View>
  );
}

// ---------------------------------------------------------------- Inputs
export function TextField({ label, value, onChangeText, placeholder, keyboardType, multiline, secureTextEntry, testID, autoCapitalize }:
  { label?: string; value: string; onChangeText: (t: string) => void; placeholder?: string;
    keyboardType?: any; multiline?: boolean; secureTextEntry?: boolean; testID?: string; autoCapitalize?: any }) {
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <T weight="medium" size={font.base} color={colors.onSurfaceSecondary}>{label}</T> : null}
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        style={[styles.input, multiline && { height: 96, textAlignVertical: "top", paddingTop: spacing.md }]}
      />
    </View>
  );
}

export function SelectField({ label, value, options, onSelect, placeholder = "Pilih...", testID, labelMap }:
  { label?: string; value?: string | null; options: string[]; onSelect: (v: string) => void;
    placeholder?: string; testID?: string; labelMap?: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <T weight="medium" size={font.base} color={colors.onSurfaceSecondary}>{label}</T> : null}
      <Pressable testID={testID} onPress={() => setOpen(true)} style={styles.input}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flex: 1 }}>
          <T color={value ? colors.onSurface : colors.muted}>{value ? (labelMap?.[value] || value) : placeholder}</T>
          <Ionicons name="chevron-down" size={18} color={colors.muted} />
        </View>
      </Pressable>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={label || "Pilih"}>
        <ScrollView style={{ maxHeight: 380 }}>
          {options.map((o) => (
            <Pressable key={o} testID={`option-${o}`} onPress={() => { onSelect(o); setOpen(false); }}
              style={({ pressed }) => [styles.optionRow, { backgroundColor: pressed ? colors.surfaceSecondary : "transparent" }]}>
              <T size={font.lg} color={value === o ? colors.brand : colors.onSurface} weight={value === o ? "semibold" : "regular"}>
                {labelMap?.[o] || o}
              </T>
              {value === o ? <Ionicons name="checkmark" size={20} color={colors.brand} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

export function EntitySelect({ label, value, items, onSelect, placeholder = "Pilih...", testID, allowNone }:
  { label?: string; value?: string | null; items: { id: string; name: string }[];
    onSelect: (id: string | null) => void; placeholder?: string; testID?: string; allowNone?: boolean }) {
  const [open, setOpen] = useState(false);
  const current = items.find((i) => i.id === value);
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <T weight="medium" size={font.base} color={colors.onSurfaceSecondary}>{label}</T> : null}
      <Pressable testID={testID} onPress={() => setOpen(true)} style={styles.input}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flex: 1 }}>
          <T color={current ? colors.onSurface : colors.muted} numberOfLines={1}>{current ? current.name : placeholder}</T>
          <Ionicons name="chevron-down" size={18} color={colors.muted} />
        </View>
      </Pressable>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={label || "Pilih"}>
        <ScrollView style={{ maxHeight: 380 }}>
          {allowNone ? (
            <Pressable onPress={() => { onSelect(null); setOpen(false); }} style={styles.optionRow}>
              <T size={font.lg} color={colors.muted}>— Tidak ada —</T>
            </Pressable>
          ) : null}
          {items.map((o) => (
            <Pressable key={o.id} testID={`entity-${o.id}`} onPress={() => { onSelect(o.id); setOpen(false); }}
              style={({ pressed }) => [styles.optionRow, { backgroundColor: pressed ? colors.surfaceSecondary : "transparent" }]}>
              <T size={font.lg} color={value === o.id ? colors.brand : colors.onSurface} weight={value === o.id ? "semibold" : "regular"}>
                {o.name}
              </T>
              {value === o.id ? <Ionicons name="checkmark" size={20} color={colors.brand} /> : null}
            </Pressable>
          ))}
          {items.length === 0 ? <T color={colors.muted} style={{ padding: spacing.md }}>Belum ada data.</T> : null}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

export function ScreenHeader({ title, onBack, right, subtitle }:
  { title: string; onBack: () => void; right?: React.ReactNode; subtitle?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <Pressable onPress={onBack} testID="header-back" style={styles.backBtn}>
        <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <T weight="bold" size={font.lg} numberOfLines={1}>{title}</T>
        {subtitle ? <T size={font.sm} color={colors.muted} numberOfLines={1}>{subtitle}</T> : null}
      </View>
      {right}
    </View>
  );
}

export function DateField({ label, value, onChange, testID }:
  { label?: string; value?: string | null; onChange: (iso: string) => void; testID?: string }) {
  const [show, setShow] = useState(false);
  const dateVal = value ? new Date(value) : new Date();
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <T weight="medium" size={font.base} color={colors.onSurfaceSecondary}>{label}</T> : null}
      <Pressable testID={testID} onPress={() => setShow(true)} style={styles.input}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flex: 1 }}>
          <T color={value ? colors.onSurface : colors.muted}>{value ? formatDate(value) : "Pilih tanggal"}</T>
          <Ionicons name="calendar-outline" size={18} color={colors.muted} />
        </View>
      </Pressable>
      {show && Platform.OS !== "web" && (
        <DateTimePicker
          value={dateVal}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(e, d) => { setShow(Platform.OS === "ios"); if (d) onChange(d.toISOString()); }}
        />
      )}
      {show && Platform.OS === "web" && (
        <BottomSheet open={show} onClose={() => setShow(false)} title="Pilih tanggal">
          <WebDateGrid value={dateVal} onPick={(d) => { onChange(d.toISOString()); setShow(false); }} />
        </BottomSheet>
      )}
    </View>
  );
}

function WebDateGrid({ value, onPick }: { value: Date; onPick: (d: Date) => void }) {
  const days: Date[] = [];
  const start = new Date();
  start.setDate(start.getDate() - 7);
  for (let i = 0; i < 45; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d); }
  return (
    <ScrollView style={{ maxHeight: 360 }}>
      {days.map((d) => (
        <Pressable key={d.toISOString()} onPress={() => onPick(d)}
          style={({ pressed }) => [styles.optionRow, { backgroundColor: pressed ? colors.surfaceSecondary : "transparent" }]}>
          <T size={font.base}>{formatDate(d.toISOString())}</T>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ---------------------------------------------------------------- Search
export function SearchBar({ value, onChangeText, placeholder = "Cari...", testID }:
  { value: string; onChangeText: (t: string) => void; placeholder?: string; testID?: string }) {
  return (
    <View style={styles.searchBar}>
      <Ionicons name="search" size={18} color={colors.muted} />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={{ flex: 1, fontSize: font.base, color: colors.onSurface, paddingVertical: 0 }}
      />
      {value ? (
        <Pressable onPress={() => onChangeText("")} testID="clear-search">
          <Ionicons name="close-circle" size={18} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- Chip row (horizontal filter)
export function ChipRow({ items, value, onChange, labelMap, testIDPrefix = "chip" }:
  { items: { key: string; label: string }[]; value: string; onChange: (k: string) => void;
    labelMap?: Record<string, string>; testIDPrefix?: string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      style={{ maxHeight: 56 }}
      contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center", height: 56 }}>
      {items.map((it) => {
        const active = value === it.key;
        return (
          <Pressable key={it.key} testID={`${testIDPrefix}-${it.key}`} onPress={() => onChange(it.key)}
            style={[styles.chip, { backgroundColor: active ? colors.brand : colors.surface,
              borderColor: active ? colors.brand : colors.border }]}>
            <Text style={{ color: active ? "#fff" : colors.onSurfaceSecondary, fontWeight: "600", fontSize: font.base }}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ---------------------------------------------------------------- Bottom sheet
export function BottomSheet({ open, onClose, title, children }:
  { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetScrim} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        {title ? (
          <View style={styles.sheetHeader}>
            <T weight="bold" size={font.lg}>{title}</T>
            <Pressable onPress={onClose} testID="sheet-close"><Ionicons name="close" size={22} color={colors.muted} /></Pressable>
          </View>
        ) : null}
        {children}
      </View>
    </Modal>
  );
}

export function ConfirmSheet({ open, onClose, onConfirm, title, message, confirmLabel = "Hapus", danger = true }:
  { open: boolean; onClose: () => void; onConfirm: () => void; title: string; message?: string;
    confirmLabel?: string; danger?: boolean }) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {message ? <T color={colors.muted} style={{ marginBottom: spacing.lg }}>{message}</T> : null}
      <View style={{ gap: spacing.sm }}>
        <PrimaryButton label={confirmLabel} variant={danger ? "danger" : "primary"} testID="confirm-action"
          onPress={() => { onConfirm(); onClose(); }} />
        <Pressable onPress={onClose} style={styles.cancelBtn} testID="cancel-action">
          <T weight="semibold" color={colors.onSurfaceSecondary}>Batal</T>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

// ---------------------------------------------------------------- Avatar
export function Avatar({ name, size = 40, uri }: { name?: string; size?: number; uri?: string | null }) {
  const initials = (name || "?").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.brandTertiary,
      alignItems: "center", justifyContent: "center" }}>
      <T weight="bold" color={colors.brand} size={size * 0.36}>{initials}</T>
    </View>
  );
}

// ---------------------------------------------------------------- FAB
export function Fab({ onPress, icon = "add", bottom = 24, testID }:
  { onPress: () => void; icon?: any; bottom?: number; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress(); }}
      style={({ pressed }) => [styles.fab, { bottom, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
      <Ionicons name={icon} size={26} color="#fff" />
    </Pressable>
  );
}

// ---------------------------------------------------------------- Toast
type ToastFn = (msg: string, type?: "success" | "error" | "info") => void;
const ToastCtx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [type, setType] = useState<"success" | "error" | "info">("success");
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<any>(null);

  const show = useCallback<ToastFn>((m, t = "success") => {
    setMsg(m); setType(t);
    if (t === "error") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setMsg(null));
    }, 2600);
  }, [opacity]);

  const bg = type === "error" ? colors.error : type === "info" ? colors.brand : colors.success;
  const icon = type === "error" ? "close-circle" : type === "info" ? "information-circle" : "checkmark-circle";

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg ? (
        <Animated.View pointerEvents="none" style={[styles.toast, { opacity, backgroundColor: bg }]} testID="toast">
          <Ionicons name={icon as any} size={20} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "600", flex: 1, fontSize: font.base }}>{msg}</Text>
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border, ...shadow.card,
  },
  badge: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, alignSelf: "flex-start" },
  primaryBtn: { height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  ghostBtn: { height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center",
    paddingHorizontal: spacing.lg, borderWidth: 1, backgroundColor: colors.surface },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, minHeight: 260 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center" },
  input: {
    minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, paddingHorizontal: spacing.md, fontSize: font.base,
    color: colors.onSurface, justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 46, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  chip: { height: 36, borderRadius: radius.pill, paddingHorizontal: spacing.lg, borderWidth: 1,
    alignItems: "center", justifyContent: "center", flexShrink: 0 },
  sheetScrim: { flex: 1, backgroundColor: "rgba(10,28,22,0.45)" },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    padding: spacing.lg, paddingBottom: spacing["2xl"],
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: spacing.md },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  optionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  cancelBtn: { height: 48, alignItems: "center", justifyContent: "center" },
  fab: {
    position: "absolute", right: spacing.lg, width: 58, height: 58, borderRadius: 29,
    backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", ...shadow.header,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceSecondary },
  toast: {
    position: "absolute", top: 58, left: spacing.lg, right: spacing.lg, flexDirection: "row",
    alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, ...shadow.header,
  },
});

export { styles as uiStyles };
