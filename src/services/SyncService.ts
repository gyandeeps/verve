import TcpSocket from "react-native-tcp-socket";
import { databaseService, TelemetryData } from "../db/DatabaseService";

class SyncService {
  private client: TcpSocket.Socket | null = null;

  connectToWorkstation(
    host: string,
    port: number,
    onDataReceived: (
      telemetry: TelemetryData[],
      batchRange: { minTs: number; maxTs: number },
    ) => void,
    onDisconnect?: () => void,
  ) {
    if (this.client) {
      return;
    }

    this.client = TcpSocket.createConnection({ host, port }, () => {
      console.log("Sync [TCP]: Connected to Workstation at", host, port);
    });

    this.client.on("data", async (data) => {
      const rawChunk = data.toString();
      // Split by newline and parse each line to handle streaming JSON
      const lines = rawChunk.split("\n").filter((line) => line.trim() !== "");

      const batch: TelemetryData[] = [];
      let minTs = Infinity;
      let maxTs = -Infinity;

      for (const line of lines) {
        try {
          const telemetry: TelemetryData = JSON.parse(line);
          console.log("Sync [DB Record]: Telemetry at", telemetry.timestamp);
          await databaseService.recordTelemetry(telemetry);

          if (telemetry.timestamp < minTs) minTs = telemetry.timestamp;
          if (telemetry.timestamp > maxTs) maxTs = telemetry.timestamp;

          batch.push(telemetry);
        } catch (err) {
          console.warn(
            "Sync [JSON Parse Error]: Incoming payload invalid:",
            line,
          );
        }
      }

      if (batch.length > 0 && onDataReceived) {
        onDataReceived(batch, { minTs, maxTs });
      }
    });

    this.client.on("error", (error) => {
      console.error("Sync [TCP Error]:", error);
    });

    this.client.on("close", () => {
      console.log("Sync [TCP]: Disconnected from CLI");
      this.client = null;
      if (onDisconnect) {
        onDisconnect();
      }
    });
  }

  disconnect() {
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
  }
}

export const syncService = new SyncService();
