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

const PAGE_SIZE = 5;

export default function HistoryScreen() {
  const [history, setHistory] = useState<TelemetryData[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchHistory = useCallback(async (targetPage: number) => {
    setLoading(true);
    try {
      const offset = targetPage * PAGE_SIZE;
      const data = await databaseService.getTelemetryPaginated(
        offset,
        PAGE_SIZE,
      );
      setHistory(data);
      setPage(targetPage);
      setHasMore(data.length === PAGE_SIZE);
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

      <Text style={styles.pageNumber}>Page {page + 1}</Text>

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
            tintColor="#007AFF"
          />
        }
        ListHeaderComponent={<Text style={styles.title}>Data Explorer</Text>}
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
          <ActivityIndicator color="#007AFF" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    paddingHorizontal: 25,
    paddingTop: 20,
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  listContent: {
    paddingBottom: 40,
  },
  historyItem: {
    marginHorizontal: 20,
    marginBottom: 6,
    padding: 8,
    borderRadius: 18,
    borderWidth: 4,
    borderColor: "#15010108",
    borderStyle: "solid",
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 6,
  },
  appTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: "600",
    opacity: 0.4,
  },
  windowTitle: {
    fontSize: 13,
    opacity: 0.6,
    marginBottom: 12,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#ffffff05",
  },
  metric: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 8,
    fontWeight: "800",
    opacity: 0.3,
    marginBottom: 3,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: "600",
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 25,
    marginTop: 10,
  },
  pageButton: {
    backgroundColor: "#007AFF22",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  disabledButton: {
    opacity: 0.3,
  },
  pageButtonText: {
    color: "#007AFF",
    fontWeight: "600",
    fontSize: 14,
  },
  pageNumber: {
    fontSize: 14,
    fontWeight: "600",
    opacity: 0.5,
  },
  emptyState: {
    padding: 100,
    alignItems: "center",
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 16,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#ffffff88",
    justifyContent: "center",
    alignItems: "center",
  },
});
