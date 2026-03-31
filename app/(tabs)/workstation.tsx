import { Text, View } from "@/components/Themed";
import { databaseService, TelemetryData } from "@/db/DatabaseService";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import Colors from "@/constants/Colors";
import Layout from "@/constants/Layout";

const PAGE_SIZE = 5;

export default function WorkstationScreen() {
  const [history, setHistory] = useState<TelemetryData[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const fetchHistory = useCallback(async (targetPage: number) => {
    setLoading(true);
    try {
      const offset = targetPage * PAGE_SIZE;
      const data = await databaseService.getTelemetryPaginated(
        offset,
        PAGE_SIZE,
      );
      const count = await databaseService.getTelemetryCount();
      setHistory(data);
      setPage(targetPage);
      setTotalCount(count);
      setHasMore(offset + data.length < count);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory(0);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory(0);
  };

  const handleNext = () => {
    if (hasMore && !loading) {
      fetchHistory(page + 1);
    }
  };

  const handlePrev = () => {
    if (page > 0 && !loading) {
      fetchHistory(page - 1);
    }
  };

  const renderItem = ({ item }: { item: TelemetryData }) => (
    <View style={styles.historyItem}>
      <View style={styles.itemHeader}>
        <Text style={styles.appTitle}>{item.active_app}</Text>
        <Text style={styles.timeLabel}>
          {new Date(item.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </Text>
      </View>
      <Text style={styles.windowTitle} numberOfLines={1}>
        {item.window_title}
      </Text>

      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>CHURN</Text>
          <Text style={styles.metricValue}>
            {item.churn_rate.toFixed(1)}/min
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>IDLE</Text>
          <Text style={styles.metricValue}>{item.idle_timer}s</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>DATE</Text>
          <Text style={styles.metricValue}>
            {new Date(item.timestamp).toLocaleDateString([], {
              month: "short",
              day: "numeric",
            })}
          </Text>
        </View>
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
        data={history}
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
        ListHeaderComponent={<Text style={styles.title}>Workstation Logs</Text>}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No records found.</Text>
            </View>
          ) : null
        }
        ListFooterComponent={history.length > 0 ? <PaginationFooter /> : null}
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
    fontSize: 32, // Display-LG adapted
    fontFamily: "InterExtraBold",
    paddingHorizontal: Layout.horizontalPadding,
    marginBottom: 20,
    letterSpacing: -1,
    color: Colors.text,
  },
  listContent: {
    paddingBottom: 40,
    gap: 12,
  },
  historyItem: {
    marginHorizontal: Layout.horizontalPadding,
    padding: 16,
    borderRadius: Layout.borderRadius, // md
    backgroundColor: Colors.surface_container,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 8,
  },
  appTitle: {
    fontSize: 16,
    fontFamily: "InterBold",
    color: Colors.text, // Not on_primary since it's normal text
  },
  timeLabel: {
    fontSize: 11, // label-sm
    fontFamily: "SpaceGrotesk",
    color: Colors.subText,
  },
  windowTitle: {
    fontSize: 13,
    fontFamily: "Inter",
    color: Colors.subText,
    marginBottom: 16,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.outline_variant, // Ghost
  },
  metric: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 9,
    fontFamily: "SpaceGroteskBold",
    color: Colors.subText,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  metricValue: {
    fontSize: 12, // slightly larger for readability
    fontFamily: "InterSemi",
    color: Colors.text,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Layout.horizontalPadding,
    marginTop: 16,
  },
  pageButton: {
    backgroundColor: "transparent", // Tertiary (Ghost)
    borderWidth: 1,
    borderColor: Colors.outline_variant,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Layout.borderRadius, // md corners
  },
  disabledButton: {
    opacity: 0.3,
  },
  pageButtonText: {
    color: Colors.text,
    fontFamily: "SpaceGroteskBold", // Technical actions use Space Grotesk
    fontSize: 12,
    textTransform: "uppercase",
  },
  pageNumber: {
    fontSize: 12,
    fontFamily: "SpaceGrotesk",
    color: Colors.subText,
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11, 19, 38, 0.7)", // surface with opacity
    justifyContent: "center",
    alignItems: "center",
  },
});
