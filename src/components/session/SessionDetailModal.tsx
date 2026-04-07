import { SymbolView } from "expo-symbols";
import React, { useEffect, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import Colors from "@/constants/Colors";
import { Text, View } from "@/src/components/Themed";
import { SessionInsight } from "@/src/services/InsightsService";
import { formatDateTime } from "@/src/utils/format";
import { HRSparkline } from "./HRSparkline";

const { width } = Dimensions.get("window");

interface SessionDetailModalProps {
  session: SessionInsight | null;
  onClose: () => void;
}

export function SessionDetailModal({
  session,
  onClose,
}: SessionDetailModalProps) {
  const [internalSession, setInternalSession] = useState<SessionInsight | null>(
    null,
  );
  const [isVisible, setIsVisible] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(600)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (session) {
      setInternalSession(session);
      setIsVisible(true);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (isVisible) {
      // Prop was set to null, trigger exit animation
      handleClose();
    }
  }, [session]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 600,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsVisible(false);
      setInternalSession(null);
      if (session) onClose(); // Only call parent if we were open
    });
  };

  if (!internalSession && !isVisible) return null;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.modalOverlay, { opacity: opacityAnim }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          activeOpacity={1}
        />
        <Animated.View
          style={[
            styles.modalContent,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Session Insights</Text>
              <Text style={styles.modalSubtitle}>
                {formatDateTime(internalSession?.start_timestamp || 0)}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <SymbolView
                name="xmark.circle.fill"
                tintColor={Colors.subText}
                size={24}
              />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll}>
            {internalSession && (
              <>
                <View style={styles.detailSection}>
                  <Text style={styles.sectionLabel}>
                    CHRONOLOGICAL ACTIVITY
                  </Text>
                  {internalSession.sessions_data.map((s, i) => (
                    <View key={i} style={styles.detailRow}>
                      <View style={styles.rowLead}>
                        <Text style={styles.detailApp}>{s.app}</Text>
                        <Text style={styles.detailTitle}>{s.title}</Text>
                      </View>
                      <Text style={styles.detailDuration}>
                        {s.duration_sec}s
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.sectionLabel}>PHYSIOLOGICAL WINDOW</Text>
                  <View style={styles.statsGrid}>
                    <View style={styles.statBox}>
                      <Text style={styles.statVal}>
                        {internalSession.avg_bpm}
                      </Text>
                      <Text style={styles.statLab}>AVG BPM</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statVal}>
                        {internalSession.churn_rate.toFixed(1)}
                      </Text>
                      <Text style={styles.statLab}>CHURN</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statVal}>
                        {Math.round(internalSession.idle_timer / 1000)}s
                      </Text>
                      <Text style={styles.statLab}>IDLE</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.sectionLabel}>CARDIAC FIDELITY</Text>
                  {internalSession.samples &&
                  internalSession.samples.length > 0 ? (
                    <>
                      {internalSession.samples.length >= 2 && (
                        <View style={styles.detailSparklineContainer}>
                          <HRSparkline
                            samples={internalSession.samples}
                            width={width - 40}
                            height={80}
                            strokeWidth={2}
                          />
                        </View>
                      )}

                      <View style={styles.sampleGrid}>
                        <View style={styles.sampleHeader}>
                          <Text style={styles.sampleHeaderLabel}>
                            TIMESTAMP
                          </Text>
                          <Text style={styles.sampleHeaderLabel}>
                            MAGNITUDE (BPM)
                          </Text>
                        </View>
                        {internalSession.samples.map((s, i) => (
                          <View key={i} style={styles.sampleRow}>
                            <Text style={styles.sampleTs}>
                              {new Date(s.ts).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                                hour12: true,
                              })}
                            </Text>
                            <Text style={styles.sampleBpm}>{s.bpm}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  ) : (
                    <View style={styles.noDataContainer}>
                      <Text style={styles.noDataText}>
                        NO HR DATA AVAILABLE
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
  },
  modalContent: {
    height: "80%",
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "InterBold",
    color: Colors.text,
  },
  modalSubtitle: {
    fontSize: 11,
    fontFamily: "SpaceGroteskBold",
    color: Colors.primary,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  modalScroll: {
    flex: 1,
  },
  detailSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "SpaceGroteskBold",
    color: Colors.primary,
    marginBottom: 12,
    letterSpacing: 1,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  rowLead: {
    flex: 1,
    marginRight: 10,
  },
  detailApp: {
    fontSize: 14,
    fontFamily: "InterBold",
    color: Colors.text,
  },
  detailTitle: {
    fontSize: 12,
    color: Colors.subText,
    marginTop: 2,
  },
  detailDuration: {
    fontSize: 14,
    fontFamily: "SpaceGroteskBold",
    color: Colors.text,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statBox: {
    backgroundColor: Colors.surface,
    padding: 15,
    borderRadius: 8,
    width: "31%",
    alignItems: "center",
  },
  statVal: {
    fontSize: 20,
    fontFamily: "SpaceGroteskBold",
    color: Colors.text,
  },
  statLab: {
    fontSize: 8,
    fontFamily: "SpaceGroteskBold",
    color: Colors.subText,
    marginTop: 4,
  },
  detailSparklineContainer: {
    backgroundColor: Colors.surface_container_lowest,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
  },
  sampleGrid: {
    backgroundColor: Colors.surface_container_lowest,
    borderRadius: 8,
    overflow: "hidden",
  },
  sampleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  sampleHeaderLabel: {
    fontSize: 9,
    fontFamily: "SpaceGroteskBold",
    color: Colors.subText,
    letterSpacing: 1,
  },
  sampleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  sampleTs: {
    fontSize: 10,
    fontFamily: "SpaceGrotesk",
    color: Colors.subText,
  },
  sampleBpm: {
    fontSize: 11,
    fontFamily: "SpaceGroteskBold",
    color: Colors.text,
  },
  noDataContainer: {
    backgroundColor: Colors.surface_container_lowest,
    padding: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
  },
  noDataText: {
    fontSize: 10,
    fontFamily: "SpaceGroteskBold",
    color: Colors.subText,
    letterSpacing: 2,
  },
});
