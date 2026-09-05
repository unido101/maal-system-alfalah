import React from "react";
import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, font } from "@/src/theme";
import { useAuth } from "@/src/auth";

function icon(name: any, focused: boolean, color: string, size: number) {
  return <Ionicons name={focused ? name : (`${name}-outline` as any)} size={size} color={color} />;
}

export default function TabsLayout() {
  const { user } = useAuth();
  const role = user?.role;
  const showFundraising = role === "manager" || role === "fundraising";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontSize: font.sm, fontWeight: "600" },
      }}
      screenListeners={{
        tabPress: () => { Haptics.selectionAsync().catch(() => {}); },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Beranda", tabBarIcon: ({ focused, color, size }) => icon("home", focused, color, size) }} />
      <Tabs.Screen name="content" options={{ title: "Konten", tabBarIcon: ({ focused, color, size }) => icon("albums", focused, color, size) }} />
      <Tabs.Screen name="fundraising" options={{
        title: "Donasi",
        href: showFundraising ? undefined : null,
        tabBarIcon: ({ focused, color, size }) => icon("heart", focused, color, size),
      }} />
      <Tabs.Screen name="reports" options={{ title: "Laporan", tabBarIcon: ({ focused, color, size }) => icon("bar-chart", focused, color, size) }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: ({ focused, color, size }) => icon("person", focused, color, size) }} />
    </Tabs>
  );
}
