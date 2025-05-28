import playerHtml from "./player.html";
import publisherHtml from "./publisher.html";
import { DurableObject } from "cloudflare:workers";

export class WebSocketBridge extends DurableObject {
  constructor(state, env) {
    super(state, env);

    this.state = state;
    this.env = env;
  }

  // Handles HTTP requests to the Durable Object, primarily for WebSocket upgrades.
  async fetch(request) {
    const url = new URL(request.url);
    // Path expected: /ws/:id/:role where :role is "publish" or "subscribe"
    // For example: /ws/session123/publish
    const pathParts = url.pathname.split("/");

    if (pathParts.length < 4 || pathParts[1] !== "ws") {
      return new Response("Malformed WebSocket URL. Expected /ws/:id/:role", {
        status: 400,
      });
    }
    const role = pathParts[3]; // "publish" or "subscribe"

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket upgrade request", {
        status: 426,
      }); // 426 Upgrade Required
    }

    // Create a new WebSocket pair
    const { 0: client, 1: server } = new WebSocketPair();

    if (role === "publish") {
      // Check if a publisher already exists for this Durable Object instance (room ID)
      const existingPublishers = this.state.getWebSockets("publisher");
      if (existingPublishers.length > 0) {
        // A publisher is already connected. Reject the new connection.
        // We don't use server.close() here; returning a non-101 response handles rejection.
        return new Response("Publisher already exists for this ID.", {
          status: 409,
        }); // Conflict
      }
      // Accept the WebSocket and tag it as "publisher". This enables hibernation.
      await this.state.acceptWebSocket(server, ["publisher"]);
    } else if (role === "subscribe") {
      // Accept the WebSocket and tag it as "subscriber".
      await this.state.acceptWebSocket(server, ["subscriber"]);
    } else {
      // Invalid role in the URL
      return new Response("Invalid role. Must be 'publish' or 'subscribe'.", {
        status: 400,
      });
    }

    // Return the client's end of the WebSocket to the runtime, completing the upgrade.
    return new Response(null, { status: 101, webSocket: client });
  }

  // Called when a WebSocket connected to this Durable Object instance receives a message.
  async webSocketMessage(ws, message) {
    // Identify if the message is from the publisher using its tag.
    const tags = this.state.getTags(ws);

    if (tags.includes("publisher")) {
      // This message is from the publisher. Broadcast it to all subscribers.
      const subscribers = this.state.getWebSockets("subscriber");
      if (subscribers.length > 0) {
        // console.log(`Broadcasting message from publisher in room ${this.state.id.toString()} to ${subscribers.length} subscribers.`);
        subscribers.forEach((subscriber) => {
          try {
            // Per requirement: "Do not send anything on the websocket other than what the publisher sent"
            subscriber.send(message);
          } catch (e) {
            // Handle potential errors if a subscriber has disconnected abruptly.
            // The runtime will eventually call webSocketClose/webSocketError for this subscriber.
            console.error(
              `Failed to send message to subscriber in room ${this.state.id.toString()}: ${
                e.message
              }`
            );
            // Optionally attempt to close the problematic socket if an error indicates it's dead
            if (
              subscriber.readyState === WebSocket.OPEN ||
              subscriber.readyState === WebSocket.CONNECTING
            ) {
              subscriber.close(1011, "Error during broadcast.");
            }
          }
        });
      }
    }
    // Messages from subscribers are ignored as per the one-way (publisher to subscribers) model.
  }

  // Called when a WebSocket connected to this DO closes.
  async webSocketClose(ws, code, reason, wasClean) {
    console.log(
      `WebSocket closed in room ${this.state.id.toString()}: code ${code}, reason "${reason}", wasClean ${wasClean}`
    );
    // The WebSocket is automatically removed from `state.getWebSockets()`.
    // If it was the publisher, `getWebSockets("publisher")` will now be empty, allowing a new publisher.
  }

  // Called when an error occurs on a WebSocket connected to this DO.
  async webSocketError(ws, error) {
    console.error(
      `WebSocket error in room ${this.state.id.toString()}: ${error.message}`
    );
    // The WebSocket is automatically closed by the runtime after this handler, then webSocketClose is called.
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
      const doId = env.WEBSOCKET_BRIDGE.idFromName(channelId);
      const stub = env.WEBSOCKET_BRIDGE.get(doId);

      // Forward the request to the Durable Object.
      // The Durable Object's fetch handler will manage the WebSocket handshake.
      // We need to pass the original request URL so the DO can parse the role.
      return stub.fetch(request);
    } else if (url.pathname === "/publisher") {
      return new Response(publisherHtml, {
        headers: {
          "Content-Type": "text/html;charset=UTF-8",
        },
      });
    } else if (url.pathname === "/player") {
      return new Response(playerHtml, {
        headers: {
          "Content-Type": "text/html;charset=UTF-8",
        },
      });
    } else if (url.pathname === "/") {
      const protocol = url.protocol === "https:" ? "wss:" : "ws:";
      return new Response(
        `Welcome to WebSocket Bridge!
Connect a publisher to: ${protocol}//${url.host}/ws/<your-random-channel-id>/publish
Connect subscribers to: ${protocol}//${url.host}/ws/<your-random-channel-id>/subscribe

A publisher can be the endpoint parameter for Cloudflare Realtime API's WebRTC to WebSocket bridge at /tracks/subscribe
A subscriber can be an example WebSocket player available at /player, or your audio processor that will speak WebSocket
A demo WebRTC client is available at /publisher that publishes your microphone as an audio track

Replace <your-random-channel-id> with a unique ID for your broadcast room (e.g., a UUID).
All clients (publisher and subscribers) for the same room must use the same channel ID.

NOTE: This page is provided strictly for demo purposes with no support nor warranty. If you are a Cloudflare Realtime customer,
please talk to your point of contact about supporting your use case.`,
        { headers: { "Content-Type": "text/plain" } }
      );
    }

    return new Response(
      "Not found. Use /ws/<channel-id>/<role> for WebSocket connections.",
      { status: 404 }
    );
  },
};
