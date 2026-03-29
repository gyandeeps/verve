import TcpSocket from "react-native-tcp-socket";
import { databaseService, TelemetryData } from "../db/DatabaseService";

class SyncService {
  private server: TcpSocket.Server | null = null;
  private clientSocket: TcpSocket.Socket | null = null;

  startServer(
    onDataReceived: (data: string) => void,
    onDisconnect?: () => void,
  ) {
    if (this.server) {
      return;
    }
    this.server = TcpSocket.createServer((socket) => {
      console.log("CLI connected to Mobile Hub");
      this.clientSocket = socket;

      socket.on("data", async (data) => {
        const rawChunk = data.toString();
        // Split by newline and parse each line to handle streaming JSON
        const lines = rawChunk.split("\n").filter((line) => line.trim() !== "");

        for (const line of lines) {
          try {
            const telemetry: TelemetryData = JSON.parse(line);
            console.log("Sync [DB Record]: Telemetry at", telemetry.timestamp);
            await databaseService.recordTelemetry(telemetry);

            if (onDataReceived) {
              onDataReceived(line);
            }
          } catch (err) {
            console.warn(
              "Sync [JSON Parse Error]: Incoming payload invalid:",
              line,
            );
          }
        }
      });

      socket.on("error", (error) => {
        console.error("Socket Error:", error);
      });

      socket.on("close", () => {
        console.log("CLI disconnected");
        this.clientSocket = null;
        if (onDisconnect) {
          onDisconnect();
        }
      });
    }).listen({ port: 8082, host: "0.0.0.0" });

    this.server.on("error", (error) => {
      console.error("Server Error:", error);
    });
  }

  stopServer() {
    if (this.clientSocket) {
      this.clientSocket.destroy();
      this.clientSocket = null;
    }
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

export const syncService = new SyncService();
