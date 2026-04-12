import Colors from "@/constants/Colors";
import Layout from "@/constants/Layout";
import { SymbolView } from "expo-symbols";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { GradientButton } from "../common/GradientButton";
import { Text, View } from "../Themed";

interface WorkstationDiscoveryModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (device: any, pairingCode?: string) => void;
  discoveredDevices: any[];
  isScanning: boolean;
  isConnecting?: boolean;
  error?: string | null;
}

export function WorkstationDiscoveryModal({
  visible,
  onClose,
  onSelect,
  discoveredDevices,
  isScanning,
  isConnecting = false,
  error = null,
}: WorkstationDiscoveryModalProps) {
  const [selectedDevice, setSelectedDevice] = useState<any | null>(null);
  const [pairingCode, setPairingCode] = useState("");
  const inputRef = React.useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) {
      setSelectedDevice(null);
      setPairingCode("");
    }
  }, [visible]);

  useEffect(() => {
    if (error) {
      setPairingCode("");
      // Re-focus after clearing to allow immediate re-entry
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [error]);

  useEffect(() => {
    if (selectedDevice && !isConnecting) {
      // Focus when transitioning to the pairing input screen
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [selectedDevice, isConnecting]);

  const handleConnect = () => {
    if (selectedDevice && pairingCode.length === 6) {
      onSelect(selectedDevice, pairingCode);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {selectedDevice ? "AUTHENTICATE" : "DISCOVERY"}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              disabled={isConnecting}
            >
              <SymbolView
                name={{ ios: "xmark", android: "close", web: "close" }}
                size={20}
                tintColor={Colors.subText}
              />
            </TouchableOpacity>
          </View>

          {!selectedDevice ? (
            <View style={styles.body}>
              <Text style={styles.subtitle}>AVAILABLE WORKSTATIONS</Text>
              <ScrollView style={styles.deviceList}>
                {discoveredDevices.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    {isScanning ? (
                      <ActivityIndicator color={Colors.primary} />
                    ) : (
                      <SymbolView
                        name={{
                          ios: "antenna.radiowaves.left.and.right.slash",
                          android: "wifi_off",
                          web: "wifi_off",
                        }}
                        size={32}
                        tintColor={Colors.subText}
                      />
                    )}
                    <Text style={styles.emptyText}>
                      {isScanning
                        ? "Searching for Verve nodes..."
                        : "No workstations found on this network."}
                    </Text>
                  </View>
                ) : (
                  discoveredDevices.map((device, index) => (
                    <TouchableOpacity
                      key={device.name + index}
                      style={styles.deviceItem}
                      onPress={() => setSelectedDevice(device)}
                    >
                      <View style={styles.deviceIcon}>
                        <SymbolView
                          name={{
                            ios: "desktopcomputer",
                            android: "computer",
                            web: "computer",
                          }}
                          size={20}
                          tintColor={Colors.primary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.deviceName}>{device.name}</Text>
                        <Text style={styles.deviceHost}>
                          {device.addresses?.[0] || "No IP"}
                        </Text>
                      </View>
                      <SymbolView
                        name={{
                          ios: "chevron.right",
                          android: "chevron_right",
                          web: "chevron_right",
                        }}
                        size={14}
                        tintColor={Colors.outline}
                      />
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.body}>
              <Text style={styles.subtitle}>PAIRING REQUIRED</Text>
              <Text style={styles.pairingInstructions}>
                Enter the 6-digit code displayed in the terminal hosting{" "}
                <Text style={{ fontFamily: "SpaceGroteskBold" }}>
                  {selectedDevice.name}
                </Text>
              </Text>

              <TextInput
                ref={inputRef}
                style={[
                  styles.pairingInput,
                  error ? { borderColor: Colors.error } : undefined,
                ]}
                value={pairingCode}
                onChangeText={(text) => {
                  setPairingCode(text);
                }}
                placeholder="000000"
                placeholderTextColor={Colors.outline}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                editable={!isConnecting}
              />

              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.buttonRow}>
                <GradientButton
                  title="BACK"
                  variant="secondary"
                  onPress={() => setSelectedDevice(null)}
                  style={{ flex: 1 }}
                />
                <GradientButton
                  title="CONNECT"
                  variant="console"
                  onPress={handleConnect}
                  disabled={pairingCode.length !== 6 || isConnecting}
                  loading={isConnecting}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.surface_container_low,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingTop: 12,
    paddingBottom: Layout.isTablet ? 40 : 30,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outline_variant,
  },
  title: {
    fontSize: 12,
    fontFamily: "SpaceGroteskBold",
    letterSpacing: 2,
    color: Colors.primary,
  },
  closeButton: {
    padding: 4,
  },
  body: {
    padding: 20,
  },
  subtitle: {
    fontSize: 10,
    fontFamily: "SpaceGroteskBold",
    color: Colors.subText,
    letterSpacing: 1,
    marginBottom: 16,
  },
  deviceList: {
    maxHeight: 300,
  },
  deviceItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: Colors.surface_container,
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.outline_variant,
  },
  deviceIcon: {
    width: 36,
    height: 36,
    borderRadius: 4,
    backgroundColor: "rgba(173, 198, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  deviceName: {
    fontSize: 15,
    fontFamily: "InterBold",
    color: Colors.text,
  },
  deviceHost: {
    fontSize: 12,
    fontFamily: "SpaceGrotesk",
    color: Colors.subText,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter",
    color: Colors.subText,
    textAlign: "center",
  },
  pairingInstructions: {
    fontSize: 14,
    fontFamily: "Inter",
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 24,
  },
  pairingInput: {
    backgroundColor: Colors.surface_container_highest,
    height: 70,
    borderRadius: 8,
    textAlign: "center",
    fontSize: 32,
    fontFamily: "SpaceGroteskBold",
    color: Colors.text,
    letterSpacing: 10,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  errorContainer: {
    backgroundColor: "rgba(255, 82, 82, 0.1)",
    padding: 12,
    borderRadius: 6,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 82, 82, 0.5)",
  },
  errorText: {
    color: "#FF5252",
    fontSize: 12,
    fontFamily: "InterBold",
    textAlign: "center",
  },
});
