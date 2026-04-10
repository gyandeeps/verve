import Colors from "@/constants/Colors";
import Layout from "@/constants/Layout";
import { Text, View } from "@/src/components/Themed";
import { SymbolView } from "expo-symbols";
import React from "react";
import { Platform, StyleSheet, TouchableOpacity } from "react-native";

interface SessionPaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  onNext: () => void;
  onPrev: () => void;
  isLoading?: boolean;
}

export function SessionPagination({
  currentPage,
  totalPages,
  totalCount,
  onNext,
  onPrev,
  isLoading,
}: SessionPaginationProps) {
  const iconSize = Platform.select({ ios: 14, android: 28 });

  return (
    <View style={styles.paginationContainer}>
      <TouchableOpacity
        style={[
          styles.pageButton,
          currentPage === 1 && styles.pageButtonDisabled,
        ]}
        onPress={onPrev}
        disabled={currentPage === 1 || isLoading}
      >
        <SymbolView
          name={{
            ios: "chevron.left",
            android: "chevron_left",
          }}
          tintColor={currentPage === 1 ? Colors.subText : Colors.primary}
          size={iconSize}
        />
      </TouchableOpacity>

      <View style={styles.pageInfo}>
        <Text style={styles.pageNumberText}>
          PAGE <Text style={styles.pageHighlight}>{currentPage}</Text> OF{" "}
          <Text style={styles.pageHighlight}>{totalPages}</Text>
        </Text>
        <Text style={styles.totalRecordsText}>{totalCount} RECORDS</Text>
      </View>

      <TouchableOpacity
        style={[
          styles.pageButton,
          currentPage === totalPages && styles.pageButtonDisabled,
        ]}
        onPress={onNext}
        disabled={currentPage === totalPages || isLoading}
      >
        <SymbolView
          name={{
            ios: "chevron.right",
            android: "chevron_right",
          }}
          tintColor={
            currentPage === totalPages ? Colors.subText : Colors.primary
          }
          size={iconSize}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  paginationContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  pageButton: {
    width: 36,
    height: 36,
    borderRadius: Layout.borderRadius,
    backgroundColor: Colors.surface_container,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  pageButtonDisabled: {
    opacity: 0.5,
  },
  pageInfo: {
    alignItems: "center",
  },
  pageNumberText: {
    fontSize: 12,
    fontFamily: "SpaceGroteskBold",
    color: Colors.subText,
    letterSpacing: 1,
  },
  pageHighlight: {
    color: Colors.primary,
  },
  totalRecordsText: {
    fontSize: 12,
    fontFamily: "SpaceGrotesk",
    color: Colors.tertiary,
    marginTop: 2,
    letterSpacing: 0.5,
  },
});
