import Colors from "@/constants/Colors";
import Layout from "@/constants/Layout";
import { BiometricData, databaseService } from "@/db/DatabaseService";
import { healthService } from "@/services/health-service";
import { Text, View } from "@/src/components/Themed";
import { SymbolView } from "expo-symbols";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await healthService.catchUpSync();
    } catch (err) {
      console.error("Delayed HR Sync failed:", err);
    }
    fetchBiometrics(0);
  };

  const handleSync = async () => {
    setRefreshing(true);
    try {
      const result = await healthService.catchUpSync();
      if (result.samplesCount > 0) {
        Alert.alert(
          "Sync Complete",
          `Successfully stored ${result.storedCount}/${result.samplesCount} heart rate samples for recent workstation activity.`,
        );
      } else {
        Alert.alert(
          "No New Data",
          "No new heart rate samples found for your recent activity. Ensure your watch is syncing with your phone.",
        );
      }
    } catch (err) {
      Alert.alert("Sync Error", "Failed to catch-up on health data.");
    } finally {
      fetchBiometrics(0);
      setRefreshing(false);
    }
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
          {new Date(item.timestamp).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          })}
        </Text>
      </View>

      <View style={styles.contentRow}>
        <View style={styles.valueContainer}>
          <Text style={styles.valueText}>{item.value.toFixed(0)}</Text>
          <Text style={styles.unitText}>bpm</Text>
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
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            <Text style={styles.title}>Health Records</Text>
            <TouchableOpacity
              onPress={handleSync}
              style={styles.syncButton}
              disabled={refreshing}
            >
              <SymbolView
                name={{
                  ios: "arrow.triangle.2.circlepath",
                  android: "sync",
                  web: "refresh",
                }}
                size={16}
                tintColor={Colors.primary}
              />
              <Text style={styles.syncButtonText}>SYNC HR</Text>
            </TouchableOpacity>
          </View>
        }
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
    letterSpacing: -1,
    color: Colors.text,
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Layout.horizontalPadding,
    marginBottom: 24,
  },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(173, 198, 255, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(173, 198, 255, 0.2)",
  },
  syncButtonText: {
    fontSize: 10,
    fontFamily: "SpaceGroteskBold",
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 40,
    gap: 12,
  },
  itemCard: {
    marginHorizontal: Layout.horizontalPadding,
    padding: 16,
    borderRadius: Layout.borderRadius,
    backgroundColor: Colors.surface_container,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  typeLabel: {
    fontSize: 11,
    fontFamily: "SpaceGroteskBold",
    color: Colors.tertiary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  timeLabel: {
    fontSize: 12,
    fontFamily: "SpaceGrotesk",
    color: Colors.subText,
  },
  contentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 10,
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
    flex: 1,
    height: 400, // Large touch target for pull-to-refresh
    justifyContent: "center",
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
