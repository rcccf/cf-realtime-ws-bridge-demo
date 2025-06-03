export function getHelpHtmlPage(
  dynamicWebsocketBaseUrl,
  appIdPlaceholder = "{appId}"
) {
  const REALTIME_API_ENDPOINT_BASE_PLACEHOLDER = `https://rtc.live.cloudflare.com/v1/apps/${appIdPlaceholder}`;

  var tagsToReplace = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
  };

  function replaceTag(tag) {
    return tagsToReplace[tag] || tag;
  }

  const escapeHtml = (unsafe) => {
    if (typeof unsafe !== "string") return unsafe;
    return unsafe.replace(/[&<>]/g, replaceTag);
  };

  // JSON content for API examples
  const apiRequestBodyExampleJson = `{
    "tracks": [{
        "location":    "'local' or 'remote'",
        "sessionId":   "your_session_id",
        "trackName":   "your_track_name",
        "endpoint":    "target_websocket_url",
        "outputCodec": "pcm"
    }]
}`;

  const scenarioARequestJson = `{ "tracks": [{ "location": "remote",
                   "sessionId": "session-abc",
                   "trackName": "mic-track",
                   "endpoint": "${dynamicWebsocketBaseUrl}/ws/<channel>/publish",
                   "outputCodec": "pcm" }] }`;

  const scenarioBRequestJson = `{ "tracks": [{ "location": "local",
                   // "sessionId": "any_value_is_ignored",
                   "trackName": "new-track-from-ws",
                   "endpoint": "${dynamicWebsocketBaseUrl}/ws/<channel>/subscribe",
                   "outputCodec": "pcm" }] }`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloudflare Realtime Bridge - Technical Demo</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f4f7f9;
            color: #333;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-height: 100vh;
            line-height: 1.6;
        }

        .container {
            background-color: #fff;
            padding: 25px 40px; /* Increased horizontal padding */
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            width: 100%;
            max-width: 800px; /* Slightly wider for better readability of pre */
            margin-bottom: 30px; /* Space for footer if any */
        }

        h1, h2, h3 {
            color: #2c3e50;
            margin-top: 1.5em;
            margin-bottom: 0.8em;
        }

        h1 {
            text-align: center;
            margin-top: 0;
            margin-bottom: 25px;
            font-size: 1.8em;
        }
        h2 {
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 0.3em;
            font-size: 1.5em;
        }
        h3 {
            font-size: 1.25em;
            color: #34495e;
        }

        p {
            margin-bottom: 1em;
        }

        ul, ol {
            margin-bottom: 1em;
            padding-left: 20px;
        }
        li {
            margin-bottom: 0.5em;
        }

        code.inline-code {
            background-color: #e9ecef;
            padding: 0.2em 0.4em;
            margin: 0 0.1em;
            font-size: 0.85em;
            border-radius: 3px;
            font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
        }

        pre.help-content {
            background-color: #2d2d2d; /* Darker background for code blocks */
            color: #f8f8f2; /* Light text for contrast */
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
            font-size: 0.9em;
            line-height: 1.45;
            white-space: pre; /* Keep whitespace as is from text */
        }
        
        .api-endpoint {
            font-weight: bold;
            color: #c0392b; /* A distinct color for API endpoints */
        }

        .note {
            font-style: italic;
            background-color: #fffde7; /* Light yellow for notes */
            border-left: 3px solid #fbc02d; /* Yellow border */
            padding: 10px 15px;
            margin-top: 1.5em;
            border-radius: 4px;
        }

        strong {
            color: #555;
        }
        /* Styles from the original prompt - some may not be used by static help page */
        input[type="text"] {
            width: calc(100% - 22px); padding: 10px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;
        }
        button {
            padding: 10px 18px; margin-right: 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 1em; transition: background-color 0.2s ease;
        }
        /* Unused styles can be removed if this page is purely informational */
    </style>
</head>
<body>
    <div class="container">
        <h1>Cloudflare Realtime WebRTC <-> WebSocket Bridge - Technical Demo</h1>

        <p>This demo shows a WebSocket Relay (on this Worker) and its use with the Cloudflare Realtime API
        for WebRTC <-> WebSocket bridging. Replace <code class="inline-code">${appIdPlaceholder}</code> below with your Cloudflare Realtime App ID.</p>

        <h2>Part 1: The WebSocket Relay (This Worker)</h2>
        <p>This Worker relays WebSocket messages: receives on <code class="inline-code">/publish</code> for a channel,
        and broadcasts to all <code class="inline-code">/subscribe</code> clients on the same channel.</p>

        <p><strong>Use this Relay:</strong></p>
        <ul>
            <li>Pick a unique <code class="inline-code">your-random-channel-id</code>.</li>
            <li>Source sends to:   <code class="inline-code">${dynamicWebsocketBaseUrl}/ws/&lt;your-random-channel-id>/publish</code></li>
            <li>Receivers get from: <code class="inline-code">${dynamicWebsocketBaseUrl}/ws/&lt;your-random-channel-id>/subscribe</code></li>
        </ul>
        <p>This relay is unaware of WebRTC or the Cloudflare Realtime API.</p>

        <h2>Part 2: Bridging with Cloudflare Realtime API</h2>
        <p>The Cloudflare Realtime API (a separate production service) can bridge WebRTC and WebSockets
        via its endpoint: <code class="inline-code api-endpoint">${REALTIME_API_ENDPOINT_BASE_PLACEHOLDER}/adapters/websocket/new</code></p>

        <p><strong>API Request Body to <code class="inline-code">/adapters/websocket/new</code>:</strong></p>
        <pre class="help-content">${escapeHtml(apiRequestBodyExampleJson)}</pre>

        <p><strong><code class="inline-code">location</code> parameter & <code class="inline-code">sessionId</code> behavior (user's perspective):</strong></p>
        <ul>
            <li>
                <strong><code class="inline-code">remote</code></strong>: (Send Realtime track audio TO a "remote" WS)
                <p>You are sending audio FROM an existing WebRTC track (local to your Realtime session)
                TO a "remote" WebSocket <code class="inline-code">endpoint</code>.</p>
                <p><code class="inline-code">sessionId</code>: <strong>REQUIRED</strong>. Must be the ID of the Realtime session containing <code class="inline-code">trackName</code>.</p>
            </li>
            <li>
                <strong><code class="inline-code">local</code></strong>: (Create Realtime track FROM a "local" WS)
                <p>You are ingesting audio FROM a "local" WebSocket <code class="inline-code">endpoint</code> TO CREATE a new
                WebRTC track in Cloudflare Realtime.</p>
                <p><code class="inline-code">sessionId</code>: <strong>IGNORED</strong>. The API will <strong>ALWAYS</strong> generate a new, unique <code class="inline-code">sessionId</code> for the
                session associated with the newly created track for each API request.
                Any <code class="inline-code">sessionId</code> value you provide in the request will be disregarded.
                The generated <code class="inline-code">sessionId</code> will be returned in the API response.</p>
            </li>
        </ul>

        <h3>SCENARIO A: Send Existing WebRTC Track Audio TO a "Remote" WebSocket Endpoint</h3>
        <p><em>(Realtime API: WebRTC Track → "Remote" WebSocket)</em></p>
        <ol>
            <li>A WebRTC source (e.g., <code class="inline-code">/publisher</code> app) publishes <code class="inline-code">mic-track</code> to your Realtime session (e.g., <code class="inline-code">session-abc</code>).</li>
            <li>To send <code class="inline-code">mic-track</code>'s audio out, POST to <code class="inline-code api-endpoint">${REALTIME_API_ENDPOINT_BASE_PLACEHOLDER}/adapters/websocket/new</code> with:
                <pre class="help-content">${escapeHtml(
                  scenarioARequestJson
                )}</pre>
            </li>
            <li>This demo relay (acting as the "remote" WebSocket endpoint) receives audio on its <code class="inline-code">/publish</code> URL
            and broadcasts it to its <code class="inline-code">/subscribe</code> URL.</li>
            <li>WebSocket clients (e.g., <code class="inline-code">/player</code> app) connect to the relay's <code class="inline-code">/subscribe</code> URL to get the audio.</li>
        </ol>

        <p><strong>ASCII Diagram for SCENARIO A:</strong></p>
        <pre class="help-content">
  [WebRTC Source] ---WebRTC---> [Cloudflare Realtime API Session (ID: session-abc)]
    (e.g., Mic,                      (Has existing 'mic-track')
     /publisher app)                          |
                                              | API Call: POST to \`${REALTIME_API_ENDPOINT_BASE_PLACEHOLDER}/adapters/websocket/new\`
                                              |  - location: 'remote'
                                              |  - sessionId: 'session-abc' (REQUIRED)
                                              |  - trackName: 'mic-track'
                                              |  - endpoint: Demo Relay's /publish URL
                                              V
  [Demo Relay (This Worker): ${dynamicWebsocketBaseUrl}/ws/&lt;channel>/publish] <---(WebSocket: audio data from Realtime)---
   (Acts as "Remote" WebSocket Endpoint for Realtime)   |
                                                        | (WebSocket: audio data broadcast by Relay)
                                                        V
          [Demo Relay (This Worker): ${dynamicWebsocketBaseUrl}/ws/&lt;channel>/subscribe]
                                                        |
                                                        | (WebSocket: audio data)
                                                        V
                                             [WebSocket Listeners]
                                               (e.g., /player app)
        </pre>

        <h3>SCENARIO B: Create WebRTC Track FROM Audio at a "Local" WebSocket Endpoint</h3>
        <p><em>(Realtime API: "Local" WebSocket → New WebRTC Track with New Session)</em></p>
        <ol>
            <li>An audio source sends audio to this demo relay's <code class="inline-code">/publish</code> URL.</li>
            <li>The demo relay broadcasts this audio to its <code class="inline-code">/subscribe</code> URL. This <code class="inline-code">/subscribe</code> URL will
            act as the "local" WebSocket endpoint for Realtime.</li>
            <li>To create a WebRTC track from this audio, POST to <code class="inline-code api-endpoint">${REALTIME_API_ENDPOINT_BASE_PLACEHOLDER}/adapters/websocket/new</code> with:
                <pre class="help-content">${escapeHtml(
                  scenarioBRequestJson
                )}</pre>
                (The API will generate a NEW <code class="inline-code">sessionId</code> for this track, returned in the response.)
            </li>
            <li>Realtime connects to the <code class="inline-code">endpoint</code>, ingests audio, creates <code class="inline-code">new-track-from-ws</code>,
            and associates it with a NEWLY GENERATED <code class="inline-code">sessionId</code>.</li>
            <li>WebRTC clients (e.g., <code class="inline-code">/pull</code> app) use the <code class="inline-code">sessionId</code> returned in the API response from step 3
            to subscribe to <code class="inline-code">new-track-from-ws</code> in Realtime.</li>
        </ol>
        <p><strong>ASCII Diagram for SCENARIO B:</strong></p>
        <pre class="help-content">
  [WebSocket Audio Source] --WebSocket--> [Demo Relay (This Worker): ${dynamicWebsocketBaseUrl}/ws/&lt;channel>/publish]
   (e.g., backend script)                    (Receives audio)
                                                       |
                                                       | (WebSocket: audio data broadcast by Relay)
                                                       V
  [Demo Relay (This Worker): ${dynamicWebsocketBaseUrl}/ws/&lt;channel>/subscribe]
   (Acts as "Local" WebSocket Endpoint for Realtime)     |
                                                         | (WebSocket: audio data for Realtime to ingest)
                                                         |
                                                         | API Call: POST to \`${REALTIME_API_ENDPOINT_BASE_PLACEHOLDER}/adapters/websocket/new\`
                                                         |  - location: 'local'
                                                         |  - sessionId: (IGNORED - API generates NEW one)
                                                         |  - trackName: 'new-track-from-ws'
                                                         |  - endpoint: This Relay's /subscribe URL
                                                         V
                                          [Cloudflare Realtime API (Generates NEW Session)]
                                                         |  (API Response includes the new sessionId)
                                                         |
                                                         | (Creates 'new-track-from-ws'; associates with NEW sessionId)
                                                         |
                                                         | (WebRTC: audio from 'new-track-from-ws')
                                                         V
                                              [WebRTC Listeners (use new sessionId from API response)]
                                                (e.g., /pull app)
        </pre>

        <h2>Demo Web Apps (on This Worker)</h2>
        <ul>
            <li><strong><code class="inline-code">/publisher</code></strong>: Publishes mic to Realtime (for Scenario A).</li>
            <li><strong><code class="inline-code">/player</code></strong>: Plays audio from a WebSocket URL (e.g., demo relay's <code class="inline-code">/subscribe</code> in Scenario A).</li>
            <li><strong><code class="inline-code">/pull</code></strong>: Pulls & plays a WebRTC track from Realtime (e.g., <code class="inline-code">new-track-from-ws</code> in Scenario B,
            using the <code class="inline-code">sessionId</code> returned by the API when the track was created).</li>
        </ul>

        <p class="note">This page is provided strictly for demo purposes with no support nor warranty.
        If you are a Cloudflare Realtime customer, please talk to your Cloudflare account
        team or point of contact about supporting your use case with the production
        Cloudflare Realtime service.</p>

    </div>
</body>
</html>`;
}
