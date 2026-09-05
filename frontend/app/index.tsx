import { View, ActivityIndicator } from "react-native";
import { colors } from "@/src/theme";

// Root index — the Gate in _layout redirects based on auth state.
export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.brand }}>
      <ActivityIndicator size="large" color={colors.brandSecondary} />
    </View>
  );
}
