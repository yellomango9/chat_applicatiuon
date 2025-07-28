import httpServer from "./app";
import { port } from "./config";
import { TimestampValidationService } from "./services/timestampValidationService";

// Convert port to number to ensure proper typing
const portNumber = typeof port === "string" ? parseInt(port, 10) : port;

// Run timestamp validation on startup
async function startServer() {
  try {
    // Validate timestamps before starting the server
    await TimestampValidationService.runStartupValidation();

    // Listen on all network interfaces
    httpServer.listen(portNumber, "0.0.0.0", () => {
      console.log("⚙️  server running on port " + portNumber);
      console.log(
        "📡 Server accessible locally at http://localhost:" + portNumber
      );
      console.log(
        "📡 Server accessible on LAN at http://10.1.0.211:" + portNumber
      );
      console.log("🌐 Other devices can connect using your PC's IP address");
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
startServer();
