// Design tokens for BAITUL MAAL AL-FALAH (from design_guidelines.json)
export const colors = {
  surface: "#FFFFFF",
  onSurface: "#1C2B26",
  surfaceSecondary: "#F4F7F5",
  onSurfaceSecondary: "#384B44",
  surfaceTertiary: "#E9EFEA",
  onSurfaceTertiary: "#1C2B26",
  surfaceInverse: "#0A1C16",
  onSurfaceInverse: "#FFFFFF",
  brand: "#064E3B",
  brandPrimary: "#064E3B",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#C5A059",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#E1EAE6",
  onBrandTertiary: "#064E3B",
  success: "#059669",
  onSuccess: "#FFFFFF",
  warning: "#D97706",
  onWarning: "#FFFFFF",
  error: "#DC2626",
  onError: "#FFFFFF",
  info: "#0D9488",
  onInfo: "#FFFFFF",
  border: "#E5EBE8",
  borderStrong: "#BCCDC5",
  divider: "#E5EBE8",
  muted: "#6B7C75",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };

export const font = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
};

export const shadow = {
  card: {
    shadowColor: "#0A1C16",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  header: {
    shadowColor: "#0A1C16",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
};

// Status + priority color maps
export const statusColors: Record<string, { bg: string; fg: string; label: string }> = {
  Draft: { bg: "#EEF1F0", fg: "#6B7C75", label: "Draf" },
  Assigned: { bg: "#E1EAE6", fg: "#064E3B", label: "Ditugaskan" },
  "In Progress": { bg: "#FEF3E2", fg: "#D97706", label: "Dikerjakan" },
  Review: { bg: "#E6F7F4", fg: "#0D9488", label: "Review" },
  Revision: { bg: "#FDECEC", fg: "#DC2626", label: "Revisi" },
  Completed: { bg: "#E7F5EF", fg: "#059669", label: "Selesai" },
  Published: { bg: "#E7F5EF", fg: "#059669", label: "Terbit" },
  Archived: { bg: "#EEF1F0", fg: "#6B7C75", label: "Arsip" },
  // program
  Active: { bg: "#E7F5EF", fg: "#059669", label: "Aktif" },
  // payment
  Paid: { bg: "#E7F5EF", fg: "#059669", label: "Lunas" },
  Pending: { bg: "#FEF3E2", fg: "#D97706", label: "Menunggu" },
  Cancelled: { bg: "#FDECEC", fg: "#DC2626", label: "Batal" },
};

export const priorityColors: Record<string, { bg: string; fg: string; label: string }> = {
  Low: { bg: "#EEF1F0", fg: "#6B7C75", label: "Rendah" },
  Medium: { bg: "#E6F7F4", fg: "#0D9488", label: "Sedang" },
  High: { bg: "#FEF3E2", fg: "#D97706", label: "Tinggi" },
  Urgent: { bg: "#FDECEC", fg: "#DC2626", label: "Mendesak" },
};

export const roleLabels: Record<string, string> = {
  manager: "Manajer",
  content: "Tim Konten",
  fundraising: "Fundraising / CS",
};

export const TASK_CATEGORIES = ["Reels", "Feed", "Story", "Poster", "Video", "Documentation", "Campaign", "Other"];
export const TASK_PRIORITIES = ["Low", "Medium", "High", "Urgent"];
export const TASK_STATUSES = ["Draft", "Assigned", "In Progress", "Review", "Revision", "Completed", "Published", "Archived"];
export const DONATION_TYPES = ["Sedekah", "Infaq", "Zakat", "Wakaf", "Donasi Program"];
export const PAYMENT_METHODS = ["Cash", "Transfer", "QRIS", "Payment Gateway", "Other"];
export const PAYMENT_STATUSES = ["Pending", "Paid", "Cancelled"];
export const EXPENSE_CATEGORIES = ["Program", "Operational", "Equipment", "Transportation", "Other"];
export const PROGRAM_STATUSES = ["Draft", "Active", "Completed", "Archived"];
export const PLATFORMS = ["Instagram", "TikTok", "Facebook", "YouTube", "WhatsApp"];
