import Colors from "@/constants/Colors";
import Layout from "@/constants/Layout";
import { BiometricData, databaseService } from "@/db/DatabaseService";
import { Text, View } from "@/src/components/Themed";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from "react-native";

const PAGE_SIZE = 5;

export default function BiometricsScreen() {
  const [data, setData] = useState<BiometricData[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const fetchBiometrics = useCallback(async (targetPage: number) => {
    setLoading(true);
    try {
      const offset = targetPage * PAGE_SIZE;
      const result = await databaseService.getBiometricsPaginated(
        offset,
        PAGE_SIZE,
      );
      const count = await databaseService.getBiometricCount();

      setData(result);
      setPage(targetPage);
      setTotalCount(count);
      setHasMore(offset + result.length < count);
    } catch (err) {
      console.error("Failed to fetch biometrics:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBiometrics(0);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBiometrics(0);
  };

  const handleNext = () => {
    if (hasMore && !loading) {
      fetchBiometrics(page + 1);
    }
  };

  const handlePrev = () => {
    if (page > 0 && !loading) {
      fetchBiometrics(page - 1);
    }
  };

  const renderItem = ({ item }: { item: BiometricData }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <Text style={styles.typeLabel}>
          {item.type === "HR" ? "Heart Rate" : item.type}
        </Text>
        <Text style={styles.timeLabel}>
          {new Date(item.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </Text>
      </View>

      <View style={styles.contentRow}>
        <View style={styles.valueContainer}>
          <Text style={styles.valueText}>{item.value.toFixed(0)}</Text>
          <Text style={styles.unitText}>bpm</Text>
        </View>

        <View style={styles.dateBadge}>
          <Text style={styles.dateText}>
            {new Date(item.timestamp).toLocaleDateString([], {
              month: "short",
              day: "numeric",
            })}
          </Text>
        </View>
      </View>

      <View style={styles.indicatorTrack}>
        <View
          style={[
            styles.indicatorFill,
            { width: `${Math.min(100, (item.value / 200) * 100)}%` },
          ]}
        />
      </View>
    </View>
  );

  const PaginationFooter = () => (
    <View style={styles.pagination}>
      <TouchableOpacity
        style={[styles.pageButton, page === 0 && styles.disabledButton]}
        onPress={handlePrev}
        disabled={page === 0 || loading}
      >
        <Text style={styles.pageButtonText}>Previous</Text>
      </TouchableOpacity>

      <Text style={styles.pageNumber}>
        Page {page + 1} of {Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}
      </Text>

      <TouchableOpacity
        style={[styles.pageButton, !hasMore && styles.disabledButton]}
        onPress={handleNext}
        disabled={!hasMore || loading}
      >
        <Text style={styles.pageButtonText}>Next</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.timestamp}-${index}`}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        ListHeaderComponent={<Text style={styles.title}>Health Records</Text>}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No biometrics found yet.</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          data.length > 0 ? (
            <PaginationFooter />
          ) : loading && !refreshing ? (
            <ActivityIndicator
              style={{ paddingVertical: 20 }}
              color={Colors.primary}
            />
          ) : null
        }
      />
      {loading && !refreshing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
    gap: 20,
  },
  title: {
    fontSize: 32,
    fontFamily: "InterExtraBold",
    paddingHorizontal: Layout.horizontalPadding,
    marginBottom: 24,
    letterSpacing: -1,
    color: Colors.text,
  },
  listContent: {
    paddingBottom: 40,
    gap: 12,
  },
  itemCard: {
    marginHorizontal: Layout.horizontalPadding,
    padding: 20,
    borderRadius: Layout.borderRadius,
    backgroundColor: Colors.surface_container,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  typeLabel: {
    fontSize: 11,
    fontFamily: "SpaceGroteskBold",
    color: Colors.tertiary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  timeLabel: {
    fontSize: 11,
    fontFamily: "SpaceGrotesk",
    color: Colors.subText,
  },
  contentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 16,
  },
  valueContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  valueText: {
    fontSize: 36,
    fontFamily: "InterExtraBold",
    color: Colors.text,
  },
  unitText: {
    fontSize: 14,
    fontFamily: "InterSemi",
    color: Colors.subText,
  },
  dateBadge: {
    backgroundColor: "rgba(173, 198, 255, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Layout.borderRadius,
  },
  dateText: {
    fontSize: 12,
    fontFamily: "InterBold",
    color: Colors.primary,
  },
  indicatorTrack: {
    height: 4,
    backgroundColor: Colors.surface_container,
    borderRadius: Layout.borderRadius,
    overflow: "hidden",
  },
  indicatorFill: {
    height: "100%",
    backgroundColor: Colors.tertiary,
    borderRadius: Layout.borderRadius,
  },
  emptyState: {
    padding: 60,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter",
    color: Colors.subText,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Layout.horizontalPadding,
    marginTop: 16,
    marginBottom: 20,
  },
  pageButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Colors.outline_variant,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Layout.borderRadius,
  },
  disabledButton: {
    opacity: 0.3,
  },
  pageButtonText: {
    color: Colors.text,
    fontFamily: "SpaceGroteskBold",
    fontSize: 12,
    textTransform: "uppercase",
  },
  pageNumber: {
    fontSize: 12,
    fontFamily: "SpaceGrotesk",
    color: Colors.subText,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11, 19, 38, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
});
