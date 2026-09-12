import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api";
import {
  T,
  Card,
  StatusBadge,
  Badge,
  ProgressBar,
  SearchBar,
  LoadingState,
  ErrorState,
  EmptyState,
  Fab,
  Avatar,
} from "@/src/ui";
import {
  colors,
  spacing,
  radius,
  font,
  statusColors,
} from "@/src/theme";
import {
  formatCompact,
  formatDate,
} from "@/src/format";

type FundraisingTab = "program" | "donation" | "donor";

const TABS: { key: FundraisingTab; label: string }[] = [
  { key: "program", label: "Program" },
  { key: "donation", label: "Donasi" },
  { key: "donor", label: "Donatur" },
];

const TAB_LABELS: Record<FundraisingTab, string> = {
  program: "Program",
  donation: "Donasi",
  donor: "Donatur",
};

export default function Fundraising() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [tab, setTab] = useState<FundraisingTab>("program");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);

      const path =
        tab === "program"
          ? "/programs"
          : tab === "donation"
            ? "/donations"
            : "/donors";

      const data = await api.get<any[]>(path, {
        q: q.trim() || undefined,
      });

      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || "Gagal memuat data");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab, q]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const handleTabChange = (nextTab: FundraisingTab) => {
    setTab(nextTab);
    setQ("");
    setItems([]);
    setLoading(true);
  };

  const fabAction = () => {
    if (tab === "program") {
      router.push("/create/program");
      return;
    }

    if (tab === "donation") {
      router.push("/create/donation");
      return;
    }

    router.push("/create/donor");
  };

  const currentLabel = TAB_LABELS[tab];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.md,
          },
        ]}
      >
        <T weight="bold" size={font.xl}>
          Fundraising
        </T>

        {/* Tabs */}
        <View style={styles.segment}>
          {TABS.map((item) => {
            const active = tab === item.key;

            return (
              <Pressable
                key={item.key}
                testID={`fr-tab-${item.key}`}
                onPress={() => handleTabChange(item.key)}
                style={[
                  styles.segBtn,
                  active && styles.segActive,
                ]}
              >
                <T
                  weight="semibold"
                  size={font.base}
                  color={
                    active
                      ? "#fff"
                      : colors.onSurfaceSecondary
                  }
                >
                  {item.label}
                </T>
              </Pressable>
            );
          })}
        </View>

        {/* Search */}
        <View style={styles.searchWrapper}>
          <SearchBar
            value={q}
            onChangeText={setQ}
            placeholder={`Cari ${currentLabel.toLowerCase()}...`}
            testID="fr-search"
          />
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            setLoading(true);
            load();
          }}
        />
      ) : items.length === 0 ? (
        <View style={styles.emptyContainer}>
          {/* Tombol Sedekah Barang tetap tersedia walaupun belum ada donasi */}
          {tab === "donation" && (
            <GoodsButton
              onPress={() =>
                router.push("/create/donation?kind=barang")
              }
            />
          )}

          <EmptyState
            icon="heart-outline"
            title={`Belum ada ${currentLabel.toLowerCase()}`}
            subtitle="Tambahkan data baru dengan tombol +."
          />
        </View>
      ) : (
        <View style={styles.listContainer}>
          {/* Quick action khusus Donasi */}
          {tab === "donation" && (
            <GoodsButton
              onPress={() =>
                router.push("/create/donation?kind=barang")
              }
            />
          )}

          <FlatList
            data={items}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              if (tab === "program") {
                return (
                  <ProgramCard
                    p={item}
                    onPress={() =>
                      router.push(`/program/${item.id}`)
                    }
                  />
                );
              }

              if (tab === "donation") {
                return <DonationRow d={item} />;
              }

              return (
                <DonorRow
                  d={item}
                  onPress={() =>
                    router.push(`/donor/${item.id}`)
                  }
                />
              );
            }}
            ItemSeparatorComponent={() => (
              <View style={{ height: spacing.md }} />
            )}
          />
        </View>
      )}

      {/* FAB */}
      <Fab
        testID="fr-fab"
        onPress={fabAction}
        bottom={insets.bottom + 20}
      />
    </View>
  );
}

/* =========================================================
   GOODS BUTTON
========================================================= */

function GoodsButton({
  onPress,
}: {
  onPress: () => void;
}) {
  return (
    <Pressable
      testID="fr-add-goods"
      onPress={onPress}
      style={({ pressed }) => [
        styles.goodsButton,
        pressed && styles.goodsButtonPressed,
      ]}
    >
      <View style={styles.goodsIcon}>
        <Ionicons
          name="gift-outline"
          size={20}
          color={colors.primary}
        />
      </View>

      <View style={styles.goodsContent}>
        <T
          weight="bold"
          size={font.md}
          color={colors.onSurface}
        >
          Catat Sedekah Barang
        </T>

        <T
          size={font.sm}
          color={colors.textSecondary}
          numberOfLines={2}
        >
          Catat bantuan berupa barang dari donatur
        </T>
      </View>

      <Ionicons
        name="chevron-forward"
        size={20}
        color={colors.textSecondary}
      />
    </Pressable>
  );
}

/* =========================================================
   PROGRAM
========================================================= */

export function ProgramCard({
  p,
  onPress,
}: {
  p: any;
  onPress: () => void;
}) {
  const achievement = Number(p.achievement) || 0;
  const totalRaised = Number(p.total_raised) || 0;
  const target = Number(p.target) || 0;
  const donationCount = Number(p.donation_count) || 0;

  return (
    <Card
      onPress={onPress}
      testID={`program-card-${p.id}`}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderInfo}>
          <T
            weight="semibold"
            size={font.lg}
            numberOfLines={1}
          >
            {p.name || "Program"}
          </T>

          <T
            size={font.sm}
            color={colors.muted}
            numberOfLines={1}
          >
            {p.category || "Umum"}
          </T>
        </View>

        <StatusBadge status={p.status} />
      </View>

      <View style={styles.programProgress}>
        <View style={styles.progressHeader}>
          <T
            size={font.base}
            weight="semibold"
            color={colors.brand}
          >
            {formatCompact(totalRaised)}
          </T>

          <T size={font.sm} color={colors.muted}>
            dari {formatCompact(target)}
          </T>
        </View>

        <ProgressBar
          value={achievement}
          color={
            achievement >= 100
              ? colors.success
              : colors.brand
          }
        />

        <View style={styles.progressFooter}>
          <T
            size={font.sm}
            weight="semibold"
            color={colors.brandSecondary}
          >
            {achievement}% tercapai
          </T>

          <T size={font.sm} color={colors.muted}>
            {donationCount} donasi
          </T>
        </View>
      </View>
    </Card>
  );
}

/* =========================================================
   DONATION
========================================================= */

function DonationRow({ d }: { d: any }) {
  const paymentStatus = d.payment_status || "Pending";
  const sc = statusColors[paymentStatus];

  const isGoods =
    d.type === "Barang" ||
    d.type === "Non-Tunai" ||
    d.payment_method === "Non-Tunai";

  const displayAmount = Number(d.amount) || 0;
  const estimatedValue = Number(d.estimated_value) || 0;

  return (
    <Card testID={`donation-row-${d.id}`}>
      <View style={styles.donationRow}>
        <View style={styles.donationInfo}>
          <View style={styles.donorNameRow}>
            <T
              weight="semibold"
              size={font.base}
              numberOfLines={1}
            >
              {d.donor_name || "Donatur"}
            </T>

            {isGoods && (
              <View style={styles.goodsBadge}>
                <T
                  size={font.xs}
                  weight="semibold"
                  color={colors.primary}
                >
                  BARANG
                </T>
              </View>
            )}
          </View>

          {isGoods ? (
            <>
              <T
                size={font.sm}
                color={colors.onSurfaceSecondary}
                numberOfLines={1}
              >
                {d.item_name || "Donasi barang"}
                {d.item_quantity
                  ? ` • ${d.item_quantity} ${d.item_unit || "unit"}`
                  : ""}
              </T>

              <T
                size={font.sm}
                color={colors.muted}
                numberOfLines={1}
              >
                {formatDate(d.date)}
                {d.item_condition
                  ? ` • ${d.item_condition}`
                  : ""}
              </T>
            </>
          ) : (
            <>
              <T
                size={font.sm}
                color={colors.muted}
                numberOfLines={1}
              >
                {d.type || "Sedekah"}
                {d.program_name
                  ? ` • ${d.program_name}`
                  : ""}
              </T>

              <T size={font.sm} color={colors.muted}>
                {formatDate(d.date)}
                {" • "}
                {d.payment_method || "Cash"}
              </T>
            </>
          )}
        </View>

        <View style={styles.donationRight}>
          {isGoods ? (
            <T
              size={font.sm}
              weight="semibold"
              color={colors.brand}
            >
              Est.{" "}
              {formatCompact(estimatedValue)}
            </T>
          ) : (
            <T
              weight="bold"
              size={font.lg}
              color={
                paymentStatus === "Paid"
                  ? colors.success
                  : colors.onSurface
              }
            >
              {formatCompact(displayAmount)}
            </T>
          )}

          <Badge
            label={sc?.label || paymentStatus}
            bg={sc?.bg || colors.surfaceTertiary}
            fg={sc?.fg || colors.muted}
          />
        </View>
      </View>
    </Card>
  );
}

/* =========================================================
   DONOR
========================================================= */

function DonorRow({
  d,
  onPress,
}: {
  d: any;
  onPress: () => void;
}) {
  const donationCount = Number(d.donation_count) || 0;
  const totalDonations = Number(d.total_donations) || 0;

  return (
    <Card
      onPress={onPress}
      testID={`donor-row-${d.id}`}
    >
      <View style={styles.donorRow}>
        <Avatar
          name={d.name || "Donatur"}
          size={44}
        />

        <View style={styles.donorInfo}>
          <T
            weight="semibold"
            size={font.base}
            numberOfLines={1}
          >
            {d.name || "Donatur"}
          </T>

          <T
            size={font.sm}
            color={colors.muted}
            numberOfLines={1}
          >
            {d.phone || "Tanpa nomor"}
            {" • "}
            {donationCount} donasi
          </T>
        </View>

        <View style={styles.donorRight}>
          <T
            weight="bold"
            color={colors.brand}
          >
            {formatCompact(totalDonations)}
          </T>

          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.muted}
          />
        </View>
      </View>
    </Card>
  );
}

/* =========================================================
   STYLES
========================================================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
  },

  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  segment: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: 4,
    marginTop: spacing.md,
  },

  segBtn: {
    flex: 1,
    height: 38,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },

  segActive: {
    backgroundColor: colors.brand,
  },

  searchWrapper: {
    marginTop: spacing.md,
  },

  listContainer: {
    flex: 1,
  },

  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 120,
  },

  emptyContainer: {
    flex: 1,
    paddingTop: spacing.md,
  },

  /* Goods */

  goodsButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  goodsButtonPressed: {
    opacity: 0.75,
  },

  goodsIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },

  goodsContent: {
    flex: 1,
  },

  goodsBadge: {
    marginLeft: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.xs,
    backgroundColor: colors.primarySoft,
  },

  /* Card */

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  cardHeaderInfo: {
    flex: 1,
    paddingRight: spacing.sm,
  },

  programProgress: {
    marginTop: spacing.md,
  },

  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },

  progressFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },

  /* Donation */

  donationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  donationInfo: {
    flex: 1,
    paddingRight: spacing.sm,
  },

  donorNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },

  donationRight: {
    alignItems: "flex-end",
    gap: 4,
  },

  /* Donor */

  donorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },

  donorInfo: {
    flex: 1,
  },

  donorRight: {
    alignItems: "flex-end",
  },
});