import TcpSocket from "react-native-tcp-socket";

class SyncService {
  private server: TcpSocket.Server | null = null;
  private clientSocket: TcpSocket.Socket | null = null;

  startServer(onDataReceived: (data: string) => void, onDisconnect?: () => void) {
    if (this.server) {
      return;
    }
    this.server = TcpSocket.createServer((socket) => {
      console.log("CLI connected to Mobile Hub");
      this.clientSocket = socket;

      socket.on("data", (data) => {
        const message = data.toString();
        console.log("Received Telemetry:", message);
        onDataReceived(message);
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
