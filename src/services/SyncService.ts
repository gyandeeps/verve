import TcpSocket from "react-native-tcp-socket";
import { databaseService, TelemetryData } from "@/db/DatabaseService";

class SyncService {
  private client: TcpSocket.Socket | null = null;

  async connectToWorkstation(
    host: string,
    port: number,
    authSecret: string, // pairing code or session token
    deviceName: string,
    onDataReceived: (
      telemetry: TelemetryData[],
      batchRange: { minTs: number; maxTs: number },
    ) => void,
    onAuthSuccess: (newToken?: string) => void,
    onAuthFailure?: (reason: string) => void,
    onDisconnect?: () => void,
  ) {
    if (this.client) {
      return;
    }

    let isAuthenticated = false;

    this.client = TcpSocket.createConnection({ host, port }, () => {
      console.log("Sync [TCP]: Connected to Workstation Handshake...");
      this.client?.write(`AUTH ${authSecret} ${deviceName}\n`);
    });

    this.client.on("data", async (data) => {
      const rawChunk = data.toString();

      if (!isAuthenticated) {
        // Handle Handshake Response
        const firstLine = rawChunk.split("\n")[0].trim();
        if (firstLine.startsWith("AUTH_OK")) {
          isAuthenticated = true;
          console.log("Sync [AUTH]: Handshake successful");

          const parts = firstLine.split(" ");
          const newToken = parts.length > 1 ? parts[1] : undefined;
          onAuthSuccess(newToken);

          this.client?.setKeepAlive(true, 30000);

          // Process naming remaining lines if any
          const remaining = rawChunk
            .split("\n")
            .slice(1)
            .filter((l) => l.trim() !== "");
          if (remaining.length > 0) {
            await this.processTelemetryLines(remaining, onDataReceived);
          }
        } else if (firstLine.startsWith("AUTH_FAILED")) {
          console.error("Sync [AUTH]: Handshake failed:", firstLine);
          this.disconnect();
          if (onAuthFailure) {
            onAuthFailure(firstLine);
          }
        }
        return;
      }

      // Handle Telemetry Data
      const lines = rawChunk.split("\n").filter((line) => line.trim() !== "");
      await this.processTelemetryLines(lines, onDataReceived);
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

  private async processTelemetryLines(
    lines: string[],
    onDataReceived: (
      telemetry: TelemetryData[],
      batchRange: { minTs: number; maxTs: number },
    ) => void,
  ) {
    const batch: TelemetryData[] = [];
    let minTs = Infinity;
    let maxTs = -Infinity;

    for (const line of lines) {
      try {
        const telemetry: TelemetryData = JSON.parse(line);
        console.log(
          "Sync [DB Record]: Telemetry at",
          telemetry.start_timestamp,
        );
        await databaseService.recordTelemetry(telemetry);

        if (telemetry.start_timestamp < minTs)
          minTs = telemetry.start_timestamp;
        if (telemetry.end_timestamp > maxTs) maxTs = telemetry.end_timestamp;

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
  }

  disconnect() {
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
  }
}

export const syncService = new SyncService();
