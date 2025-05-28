import playerHtml from "./player.html";
import { DurableObject } from "cloudflare:workers";

// Durable Object Class: BroadcastRoom
export class BroadcastRoom extends DurableObject {
  constructor(state, env) {
    super(state, env);

    this.state = state;
    this.env = env;
    this.publisher = null;
    this.subscribers = new Set(); // Stores WebSocket objects for subscribers
    this.channelId = null; // Will be set from the instance name

    // We need to ensure that operations like adding/removing WebSockets
    // and broadcasting messages are serialized for a given room instance.
    // `blockConcurrencyWhile` ensures that only one operation runs at a time
    // for this specific Durable Object instance.
    this.state.blockConcurrencyWhile(async () => {
      // Initialize channelId from the Durable Object's name if not already set.
      // The name is derived from the `idFromName(channelId)` call in the main worker.
      if (!this.channelId) {
        this.channelId = this.state.id.toString(); // Or use a custom naming scheme if preferred
      }
    });
  }

  // Helper to broadcast a message to all subscribers
  broadcast(message, excludeWs = null) {
    this.subscribers.forEach((sub) => {
      if (sub !== excludeWs) {
        try {
          sub.send(message);
        } catch (error) {
          // Error sending, likely client disconnected abruptly. Remove them.
          console.error(
            `Error sending to subscriber in room ${this.channelId}:`,
            error.message
          );
          this.subscribers.delete(sub);
          // No need to explicitly close `sub` here, its `close` event handler will do cleanup.
        }
      }
    });
  }

  // Handles new WebSocket connections routed to this Durable Object instance
  async fetch(request) {
    const url = new URL(request.url);
    const role = url.pathname.split("/")[3]; // e.g. /ws/<channel_id>/<role>

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();

    if (role === "publish") {
      await this.handlePublisher(server);
    } else if (role === "subscribe") {
      await this.handleSubscriber(server);
    } else {
      server.close(
        1008,
        "Invalid role specified. Use 'publish' or 'subscribe'."
      );
      return new Response("Invalid role", { status: 400 });
    }

    return new Response(null, {
      status: 101,
      webSocket: client, // Give the client-side socket back to Cloudflare's runtime
    });
  }

  async handlePublisher(ws) {
    // Only one publisher per room. If one exists, close the old one.
    if (this.publisher) {
      console.log(
        `Room ${this.channelId}: New publisher connected, closing old one.`
      );
      this.publisher.close(1012, "New publisher connected, replacing old one."); // 1012: Service Restart
    }
    this.publisher = ws;
    console.log(`Room ${this.channelId}: Publisher connected.`);

    ws.addEventListener("message", async (event) => {
      // Requirement 5: Do not send anything on the websocket other than what the publisher sent.
      // So, we directly forward event.data
      //   console.log(`Room ${this.channelId}: Publisher sent message, broadcasting to ${this.subscribers.size} subscribers.`);
      this.broadcast(event.data);
    });

    ws.addEventListener("close", async (event) => {
      console.log(
        `Room ${this.channelId}: Publisher disconnected. Code: ${event.code}, Reason: ${event.reason}`
      );
      if (this.publisher === ws) {
        // Ensure it's the current publisher
        this.publisher = null;
      }
      // Optionally notify subscribers publisher has left, but requirement 5 says only send what publisher sent.
      // So, we don't send any notification here.
    });

    ws.addEventListener("error", async (error) => {
      console.error(
        `Room ${this.channelId}: Publisher WebSocket error:`,
        error.message
      );
      if (this.publisher === ws) {
        this.publisher = null;
      }
    });
  }

  async handleSubscriber(ws) {
    this.subscribers.add(ws);
    console.log(
      `Room ${this.channelId}: Subscriber connected. Total subscribers: ${this.subscribers.size}`
    );

    // Requirement 4: Handle subscribers connecting before publisher.
    // This is inherently handled. They are just added to the set.
    // When the publisher eventually connects and sends a message, they will receive it.

    ws.addEventListener("message", async (event) => {
      // Subscribers are not supposed to send messages in this model.
      // We could close the connection or just ignore it.
      console.log(
        `Room ${this.channelId}: Received message from subscriber (ignoring):`,
        event.data
      );
      // ws.send("Subscribers are not allowed to send messages.");
      // ws.close(1008, "Subscribers cannot send messages.");
    });

    ws.addEventListener("close", async (event) => {
      this.subscribers.delete(ws);
      console.log(
        `Room ${this.channelId}: Subscriber disconnected. Code: ${event.code}, Reason: ${event.reason}. Remaining subscribers: ${this.subscribers.size}`
      );
    });

    ws.addEventListener("error", async (error) => {
      console.error(
        `Room ${this.channelId}: Subscriber WebSocket error:`,
        error.message
      );
      this.subscribers.delete(ws);
    });
  }
}

// Main Worker Fetch Handler
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathSegments = url.pathname.split("/").filter(Boolean); // e.g., ["ws", "channel123", "publish"]

    // Expected path: /ws/<channel-id>/<role>
    // <channel-id> can be any string, client should generate it (e.g., a UUID)
    // <role> is either "publish" or "subscribe"
    if (pathSegments.length === 3 && pathSegments[0] === "ws") {
      const channelId = pathSegments[1];
      const role = pathSegments[2];

      if (!channelId) {
        return new Response(
          "Channel ID is required in the URL: /ws/<channel-id>/<role>",
          { status: 400 }
        );
      }
      if (role !== "publish" && role !== "subscribe") {
        return new Response(
          "Role must be 'publish' or 'subscribe' in the URL: /ws/<channel-id>/<role>",
          { status: 400 }
        );
      }

      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket upgrade request", {
          status: 426,
        });
      }

      // Get (or create if not exists) the Durable Object instance for this channelId
      // `idFromName` ensures that the same channelId always maps to the same Durable Object instance.
      const doId = env.BROADCAST_ROOM.idFromName(channelId);
      const stub = env.BROADCAST_ROOM.get(doId);

      // Forward the request to the Durable Object.
      // The Durable Object's fetch handler will manage the WebSocket handshake.
      // We need to pass the original request URL so the DO can parse the role.
      return stub.fetch(request);
    } else if (url.pathname === "/player") {
      return new Response(playerHtml, {
        headers: {
          "Content-Type": "text/html;charset=UTF-8",
        },
      });
    } else if (url.pathname === "/") {
      return new Response(
        `Welcome to WebSocket Re-broadcaster!
Connect a publisher to:   wss://${url.hostname}/ws/<your-random-channel-id>/publish
Connect subscribers to: wss://${url.hostname}/ws/<your-random-channel-id>/subscribe

An example WebSocket player is available at /player

Replace <your-random-channel-id> with a unique ID for your broadcast room (e.g., a UUID).
All clients (publisher and subscribers) for the same room must use the same channel ID.`,
        { headers: { "Content-Type": "text/plain" } }
      );
    }

    return new Response(
      "Not found. Use /ws/<channel-id>/<role> for WebSocket connections.",
      { status: 404 }
    );
  },
};
