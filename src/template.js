export function getHelpMessageText(dynamicWebsocketBaseUrl) {
  const REALTIME_API_ENDPOINT_BASE = "https://rtc.live.cloudflare.com/v1/apps/{appId}"; // {appId} needs to be replaced by user

  return `Cloudflare Realtime WebRTC <-> WebSocket Bridge - Technical Demo

This demo shows a WebSocket Relay (on this Worker) and its use with the Cloudflare Realtime API
for WebRTC <-> WebSocket bridging. Replace {appId} below with your Cloudflare Realtime App ID.

-------------------------------------------------------
Part 1: The WebSocket Relay (This Worker)
-------------------------------------------------------

This Worker relays WebSocket messages: receives on \`/publish\` for a channel,
and broadcasts to all \`/subscribe\` clients on the same channel.

Use this Relay:
1. Pick a unique \`your-random-channel-id\`.
2. Source sends to:   ${dynamicWebsocketBaseUrl}/ws/<your-random-channel-id>/publish
3. Receivers get from: ${dynamicWebsocketBaseUrl}/ws/<your-random-channel-id>/subscribe

This relay is unaware of WebRTC or the Cloudflare Realtime API.

-------------------------------------------------------
Part 2: Bridging with Cloudflare Realtime API
-------------------------------------------------------

The Cloudflare Realtime API (a separate production service) can bridge WebRTC and WebSockets
via its endpoint: \`${REALTIME_API_ENDPOINT_BASE}/adapters/websocket/new\`

API Request Body to \`/adapters/websocket/new\`:
{
    "tracks": [{
        "location":    "'local' or 'remote'", // Direction relative to the WebSocket endpoint
        "sessionId":   "your_session_id",   // Realtime session ID
        "trackName":   "your_track_name",   // Realtime WebRTC track name
        "endpoint":    "target_websocket_url",// WebSocket URL for bridging
        "outputCodec": "pcm"                 // Example codec
    }]
}

\`location\` parameter (user's perspective for WebSocket interaction):
- \`remote\`: Sends audio FROM an existing WebRTC track in your Realtime session
            TO a "remote" WebSocket \`endpoint\` (e.g., this demo relay's \`/publish\` URL).
- \`local\`:  Ingests audio FROM a "local" WebSocket \`endpoint\` (e.g., this demo relay's
            \`/subscribe\` URL) TO CREATE a new WebRTC track in your Realtime session.

SCENARIO A: Send Existing WebRTC Track Audio TO a "Remote" WebSocket Endpoint
****************************************************************************************
(Realtime API: WebRTC Track -> "Remote" WebSocket)

1. A WebRTC source (e.g., /publisher app) publishes \`mic-track\` to your Realtime session.
2. To send \`mic-track\`'s audio out, POST to \`${REALTIME_API_ENDPOINT_BASE}/adapters/websocket/new\` with:
   { "tracks": [{ "location": "remote", "sessionId": "...", "trackName": "mic-track",
                   "endpoint": "${dynamicWebsocketBaseUrl}/ws/<channel>/publish", "outputCodec": "pcm" }] }
3. This demo relay (acting as the "remote" WebSocket endpoint) receives audio on its \`/publish\` URL
   and broadcasts it to its \`/subscribe\` URL.
4. WebSocket clients (e.g., /player app) connect to the relay's \`/subscribe\` URL to get the audio.

ASCII Diagram for SCENARIO A:

  [WebRTC Source] ---WebRTC---> [Cloudflare Realtime API Session]
    (e.g., Mic,                      (Has existing 'mic-track')
     /publisher app)                          |
                                              | API Call: POST to \`${REALTIME_API_ENDPOINT_BASE}/adapters/websocket/new\`
                                              |  - location: 'remote' (Send 'mic-track' audio TO remote WS)
                                              |  - trackName: 'mic-track'
                                              |  - endpoint: Demo Relay's /publish URL
                                              V
  [Demo Relay (This Worker): ${dynamicWebsocketBaseUrl}/ws/<channel>/publish] <---(WebSocket: audio data from Realtime)---
   (Acts as "Remote" WebSocket Endpoint for Realtime)   |
                                                        | (WebSocket: audio data broadcast by Relay)
                                                        V
          [Demo Relay (This Worker): ${dynamicWebsocketBaseUrl}/ws/<channel>/subscribe]
                                                        |
                                                        | (WebSocket: audio data)
                                                        V
                                             [WebSocket Listeners]
                                               (e.g., /player app,
                                                audio backend)


SCENARIO B: Create WebRTC Track FROM Audio at a "Local" WebSocket Endpoint
************************************************************************************
(Realtime API: "Local" WebSocket -> New WebRTC Track)

1. An audio source sends audio to this demo relay's \`/publish\` URL.
2. The demo relay broadcasts this audio to its \`/subscribe\` URL. This \`/subscribe\` URL will
   act as the "local" WebSocket endpoint for Realtime.
3. To create a WebRTC track from this audio, POST to \`${REALTIME_API_ENDPOINT_BASE}/adapters/websocket/new\` with:
   { "tracks": [{ "location": "local", "sessionId": "...", "trackName": "new-track-from-ws",
                   "endpoint": "${dynamicWebsocketBaseUrl}/ws/<channel>/subscribe", "outputCodec": "pcm" }] }
4. Realtime connects to the \`endpoint\`, ingests audio, and creates \`new-track-from-ws\`.
5. WebRTC clients (e.g., /pull app) subscribe to \`new-track-from-ws\` in Realtime.

ASCII Diagram for SCENARIO B:

  [WebSocket Audio Source] --WebSocket--> [Demo Relay (This Worker): ${dynamicWebsocketBaseUrl}/ws/<channel>/publish]
   (e.g., backend script,                    (Receives audio)
    audio file streamer)                               |
                                                       | (WebSocket: audio data broadcast by Relay)
                                                       V
  [Demo Relay (This Worker): ${dynamicWebsocketBaseUrl}/ws/<channel>/subscribe]
   (Acts as "Local" WebSocket Endpoint for Realtime)     |
                                                         | (WebSocket: audio data for Realtime to ingest)
                                                         |
                                                         | API Call: POST to \`${REALTIME_API_ENDPOINT_BASE}/adapters/websocket/new\`
                                                         |  - location: 'local' (Ingest FROM this "local" WS)
                                                         |  - trackName: 'new-track-from-ws' (To be created)
                                                         |  - endpoint: This Relay's /subscribe URL
                                                         V
                                          [Cloudflare Realtime API Session]
                                                         |
                                                         | (Creates 'new-track-from-ws' internally from WS audio)
                                                         |
                                                         | (WebRTC: audio from 'new-track-from-ws')
                                                         V
                                              [WebRTC Listeners]
                                                (e.g., /pull app,
                                                 browsers)

-------------------------------------------------------
Demo Web Apps (on This Worker)
-------------------------------------------------------
* /publisher: Publishes mic to Realtime (for Scenario A).
* /player:    Plays audio from a WebSocket URL (e.g., demo relay's /subscribe in Scenario A).
* /pull:      Pulls & plays a WebRTC track from Realtime (e.g., \`new-track-from-ws\` in Scenario B).

-------------------------------------------------------
NOTE: Demo only, no warranty. Cloudflare Realtime customers: consult your account team for production use.
`;
}