import { Request, Response } from "express";

export class NotificationController {
  /**
   * Server-Sent Events stream for real-time notifications
   */
  async streamNotifications(req: Request, res: Response) {
    const { walletAddress } = req.query;

    // Set headers for SSE
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    });

    // Send initial connection event
    res.write(
      `data: ${JSON.stringify({
        type: "connected",
        timestamp: Date.now(),
        walletAddress: walletAddress || "global",
      })}\n\n`,
    );

    // Store connection for broadcasting
    const clientId = Date.now() + Math.random();
    (global as any).sseClients = (global as any).sseClients || new Map();
    (global as any).sseClients.set(clientId, {
      res,
      walletAddress,
      connected: Date.now(),
    });

    // Handle client disconnect
    req.on("close", () => {
      (global as any).sseClients?.delete(clientId);
    });

    // Send periodic heartbeat
    const heartbeat = setInterval(() => {
      try {
        res.write(
          `data: ${JSON.stringify({
            type: "heartbeat",
            timestamp: Date.now(),
          })}\n\n`,
        );
      } catch (error) {
        clearInterval(heartbeat);
        (global as any).sseClients?.delete(clientId);
      }
    }, 30000); // 30 seconds

    // Cleanup on connection close
    req.on("close", () => {
      clearInterval(heartbeat);
      (global as any).sseClients?.delete(clientId);
    });
  }

  /**
   * Get list of connected SSE clients (debug endpoint)
   */
  async getConnectedClients(req: Request, res: Response) {
    const clients = (global as any).sseClients || new Map();
    const clientList = Array.from(clients.entries()).map((entry) => {
      const [id, client] = entry as [string, any];
      return {
        id,
        walletAddress: client.walletAddress,
        connected: new Date(client.connected).toISOString(),
        duration: Date.now() - client.connected,
      };
    });

    res.json({
      success: true,
      data: clientList,
      message: "Connected clients retrieved",
    });
  }

  /**
   * Send test notification to all clients
   */
  async sendTestNotification(req: Request, res: Response) {
    const { message, type = "info" } = req.body;

    const notification = {
      type,
      message,
      timestamp: Date.now(),
      id: Date.now(),
    };

    // Broadcast to all connected clients
    const clients = (global as any).sseClients || new Map();
    let sentCount = 0;

    for (const entry of clients.entries()) {
      const [clientId, client] = entry as [string, any];
      try {
        client.res.write(`data: ${JSON.stringify(notification)}\n\n`);
        sentCount++;
      } catch (error) {
        // Remove disconnected client
        clients.delete(clientId);
      }
    }

    res.json({
      success: true,
      data: {
        sent: sentCount,
        total: clients.size,
        notification,
      },
      message: "Test notification sent",
    });
  }

  /**
   * Get notification metrics
   */
  async getNotificationMetrics(req: Request, res: Response) {
    const clients = (global as any).sseClients || new Map();

    const metrics = {
      totalConnections: clients.size,
      activeConnections: Array.from(clients.values()).filter(
        (client: any) => Date.now() - client.connected < 300000, // Active in last 5 minutes
      ).length,
      averageConnectionTime:
        clients.size > 0
          ? Array.from(clients.values()).reduce(
              (sum: number, client: any) =>
                sum + (Date.now() - client.connected),
              0,
            ) / clients.size
          : 0,
      connectionsByHour: this.getConnectionsByHour(clients),
    };

    res.json({
      success: true,
      data: metrics,
      message: "Notification metrics retrieved",
    });
  }

  /**
   * Generic webhook receiver for external systems
   */
  async receiveWebhook(req: Request, res: Response) {
    const { source, event, data } = req.body;

    // Validate webhook payload
    if (!source || !event) {
      return res.status(400).json({
        success: false,
        error: "Faltan campos requeridos: source, event",
      });
    }

    // Process webhook data
    const notification = {
      type: "webhook",
      source,
      event,
      data,
      timestamp: Date.now(),
      id: Date.now(),
    };

    // Broadcast to relevant clients
    this.broadcastToClients(notification, source);

    res.json({
      success: true,
      data: {
        received: true,
        notification,
      },
      message: "Webhook received",
    });
  }

  /**
   * Broadcast notification to specific clients based on source
   */
  private broadcastToClients(notification: any, source?: string) {
    const clients = (global as any).sseClients || new Map();

    for (const entry of clients.entries()) {
      const [clientId, client] = entry as [string, any];
      try {
        // Filter clients based on source if specified
        if (
          source &&
          client.walletAddress &&
          !this.shouldSendToClient(client, source, notification)
        ) {
          continue;
        }

        client.res.write(`data: ${JSON.stringify(notification)}\n\n`);
      } catch (error) {
        // Remove disconnected client
        clients.delete(clientId);
      }
    }
  }

  /**
   * Determine if client should receive notification based on source and data
   */
  private shouldSendToClient(
    client: any,
    source: string,
    notification: any,
  ): boolean {
    // Implement filtering logic based on source and client data
    switch (source) {
      case "payment":
        // Send payment notifications to relevant wallet only
        return client.walletAddress === notification.data?.walletAddress;
      case "transaction":
        // Send transaction notifications to relevant wallet only
        return client.walletAddress === notification.data?.walletAddress;
      case "system":
        // Send system notifications to all clients
        return true;
      default:
        // Send to all clients for unknown sources
        return true;
    }
  }

  /**
   * Get connection statistics grouped by hour
   */
  private getConnectionsByHour(clients: Map<string, any>) {
    const now = new Date();
    const connectionsByHour: { [hour: string]: number } = {};

    // Initialize last 24 hours
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
      connectionsByHour[hour.getHours().toString()] = 0;
    }

    // Count connections by hour
    for (const client of clients.values()) {
      const connectTime = new Date(client.connected);
      const hour = connectTime.getHours().toString();
      if (connectionsByHour[hour] !== undefined) {
        connectionsByHour[hour]++;
      }
    }

    return connectionsByHour;
  }
}
