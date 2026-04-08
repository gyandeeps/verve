import { SymbolView } from "expo-symbols";
import { GradientButton } from "@/src/components/common/GradientButton";
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
import { Text, View } from "@/src/components/Themed";
import { SessionDetailModal } from "@/src/components/session/SessionDetailModal";
import { SessionItem } from "@/src/components/session/SessionItem";
import { SessionPagination } from "@/src/components/session/SessionPagination";
import {
  insightsService,
  SessionInsight,
} from "@/src/services/InsightsService";
import { healthService } from "@/src/services/health-service";

const PAGE_SIZE = 5;

export default function SessionsScreen() {
  const [sessions, setSessions] = useState<SessionInsight[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionInsight | null>(
    null,
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync ref to prevent duplicate/race-condition fetches
  const isLoadingRef = React.useRef(false);

  const loadPage = useCallback(async (page: number, isRefresh = false) => {
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      if (isRefresh) {
        await healthService.syncHealthData();
      }

      const offset = (page - 1) * PAGE_SIZE;
      const data = await insightsService.getInsightsData(offset, PAGE_SIZE);

      setSessions(data.sessions);
      setTotalCount(data.totalCount);
      setCurrentPage(page);
      setError(null);
    } catch (err) {
      console.error("[Sessions] Load Failure:", err);
      setError("Failed to load session timeline.");
    } finally {
      setIsRefreshing(false);
      setIsLoadingMore(false);
      isLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadPage(1, true);
  }, []);

  const onRefresh = () => {
    loadPage(1, true);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      loadPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      loadPage(currentPage - 1);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sessions</Text>
        <View style={styles.syncBadge}>
          <View style={styles.syncIndicator} />
          <Text style={styles.syncLabel}>HISTORIC DATA LOCAL-ONLY</Text>
        </View>
      </View>

      {error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <GradientButton
            title="Retry Connection"
            onPress={() => loadPage(currentPage)}
            variant="console"
            style={{ marginTop: 10, width: 200 }}
          />
        </View>
      ) : (
        <>
          <FlatList
            data={sessions}
            renderItem={({ item }) => (
              <SessionItem item={item} onPress={setSelectedSession} />
            )}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                tintColor={Colors.primary}
              />
            }
            ListHeaderComponent={
              isLoadingMore ? (
                <View style={styles.headerLoader}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.loaderText}>FETCHING DATA...</Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <SymbolView
                  name="clock.arrow.2.circlepath"
                  tintColor={Colors.subText}
                  size={40}
                />
                <Text style={styles.emptyText}>
                  No workstation sessions found.
                </Text>
                <Text style={styles.emptySubText}>
                  Ensure the CLI is running on your Mac.
                </Text>
              </View>
            }
          />

          <SessionPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            onNext={handleNextPage}
            onPrev={handlePrevPage}
            isLoading={isLoadingMore}
          />
        </>
      )}

      <SessionDetailModal
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    paddingHorizontal: Layout.horizontalPadding,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: "InterExtraBold",
    color: Colors.text,
    letterSpacing: -1,
  },
  syncBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  syncIndicator: {
    width: 6,
    height: 6,
    borderRadius: Layout.borderRadius,
    backgroundColor: Colors.tertiary,
  },
  syncLabel: {
    fontSize: 9,
    fontFamily: "SpaceGroteskBold",
    color: Colors.tertiary,
    letterSpacing: 1,
  },
  listContent: {
    padding: 12,
    paddingTop: 16,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  error: {
    color: "#FF3B30",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  retryText: {
    color: Colors.background,
    fontFamily: "InterBold",
  },
  empty: {
    alignItems: "center",
    marginTop: 100,
  },
  emptyText: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "InterBold",
    marginTop: 16,
  },
  emptySubText: {
    color: Colors.subText,
    fontSize: 12,
    marginTop: 4,
  },
  headerLoader: {
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  loaderText: {
    fontSize: 10,
    fontFamily: "SpaceGroteskBold",
    color: Colors.subText,
    letterSpacing: 1,
  },
});
