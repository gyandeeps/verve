import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import Layout from "@/constants/Layout";
import { BiometricData, databaseService } from "@/db/DatabaseService";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
} from "react-native";

const PAGE_SIZE = 10;

export default function BiometricsScreen() {
  const [data, setData] = useState<BiometricData[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchBiometrics = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      try {
        const offset = targetPage * PAGE_SIZE;
        const result = await databaseService.getBiometricsPaginated(
          offset,
          PAGE_SIZE,
        );
        setData(targetPage === 0 ? result : [...data, ...result]);
        setPage(targetPage);
        setHasMore(result.length === PAGE_SIZE);
      } catch (err) {
        console.error("Failed to fetch biometrics:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [data],
  );

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
        onEndReached={handleNext}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loading && !refreshing ? (
            <ActivityIndicator
              style={{ paddingVertical: 20 }}
              color={Colors.primary}
            />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  title: {
    fontSize: 32,
    fontFamily: "InterExtraBold",
    paddingHorizontal: 20,
    marginBottom: 24,
    letterSpacing: -1,
    color: Colors.text,
  },
  listContent: {
    paddingBottom: 40,
  },
  itemCard: {
    marginHorizontal: 20,
    marginBottom: 12,
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
});
