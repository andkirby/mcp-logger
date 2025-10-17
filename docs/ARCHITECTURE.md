# Browser Logger System Architecture

```mermaid
graph TD
    %% Define styles
    classDef frontend fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef backend fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef mcp fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
    classDef ai fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef protocol fill:#fce4ec,stroke:#880e4f,stroke-width:1px,stroke-dasharray: 5 5
    classDef storage fill:#f1f8e9,stroke:#33691e,stroke-width:1px

    %% Frontend Applications
    subgraph "Frontend Applications"
        F1[Web App<br/>localhost:3000]
        F2[Web App<br/>localhost:5173]
        F3[Other Web App<br/>example.com]

        class F1,F2,F3 frontend
    end

    %% Frontend Logger Components
    subgraph "Frontend Logger (mcp-logger.js)"
        FL1[Console Interception<br/>log, error, warn, info, debug]
        FL2[Application Logger<br/> logger.log - namespace, data ]
        FL3[Buffer & Retry Logic<br/>500 entries max]
        FL4[Duplicate Filtering<br/>5-second window]

        class FL1,FL2,FL3,FL4 frontend
    end

    %% Backend Server
    subgraph "Backend Server (logger-server.js:22345)"
        BE1[HTTP POST Receiver<br/>/api/logs/submit]
        BE2[Log Storage Engine<br/>In-memory, circular buffer]
        BE3[Multi-App Support<br/>app > host > namespace]
        BE4[SSE Stream Endpoint<br/>/api/logs/stream]
        BE5[Script Server<br/>/mcp-logger.js with auto-config]
        BE6[Rate Limiting<br/>200 req/10s localhost]

        class BE1,BE2,BE3,BE4,BE5,BE6 backend
        class BE2 storage
    end

    %% Storage Structure Detail
    subgraph "Log Storage Structure"
        S1[App: 'my-app']
        S2[Host: localhost:3000]
        S3[Namespaces]
        S4[browser logs]
        S5[user-actions]
        S6[api-calls]
        S7[performance]
        S8[500 entries per namespace]

        class S1,S2,S3,S4,S5,S6,S7,S8 storage
    end

    %% MCP Server
    subgraph "MCP Server (mcp-server.js)"
        MC1[SSE Client<br/>Real-time log streaming]
        MC2[get_logs Tool<br/>Intelligent host/namespace selection]
        MC3[HTTP Fallback<br/>When SSE unavailable]
        MC4[Log Formatter<br/>For Claude consumption]
        MC5[Auto-selection Logic<br/>Single/multiple host handling]

        class MC1,MC2,MC3,MC4,MC5 mcp
    end

    %% AI Assistant
    subgraph "AI Assistant"
        AI1[Claude Desktop<br/>STDIO transport]
        AI2[get_logs tool access]
        AI3[Real-time log analysis]

        class AI1,AI2,AI3 ai
    end

    %% Connections and Data Flow
    F1 --> FL1
    F2 --> FL1
    F3 --> FL1
    FL1 --> FL2
    FL2 --> FL3
    FL3 --> FL4

    %% HTTP POST to Backend
    FL4 -.->|HTTP POST<br/>/api/logs/submit| BE1
    BE1 --> BE2

    %% Storage Structure
    BE2 --> S1
    S1 --> S2
    S2 --> S3
    S3 --> S4
    S3 --> S5
    S3 --> S6
    S3 --> S7
    S4 --> S8
    S5 --> S8
    S6 --> S8
    S7 --> S8

    %% Backend Features
    BE2 --> BE4
    BE2 --> BE5
    BE1 --> BE6

    %% SSE Streaming to MCP
    BE4 -.->|SSE Stream<br/>/api/logs/stream| MC1
    MC1 --> MC2
    MC2 --> MC4
    MC4 --> AI1

    %% MCP Tool Access
    AI1 --> AI2
    AI2 -.->|get_logs query| MC2
    MC2 --> MC5
    MC5 -.->|HTTP GET<br/>/api/logs/:app/:host/:namespace| BE2

    %% Fallback Mechanism
    MC3 -.->|HTTP Polling| BE2

    %% Auto-configuration
    F1 -.->|GET /mcp-logger.js<br/>Auto-config injection| BE5
    F2 -.->|GET /mcp-logger.js<br/>Auto-config injection| BE5
    F3 -.->|GET /mcp-logger.js<br/>Auto-config injection| BE5

    %% Protocol Labels
    classDef protocolLabel fill:#fff9c4,stroke:#f57f17,stroke-width:1px

    subgraph "Protocols & Technologies"
        P1[HTTP/HTTPS]
        P2[Server-Sent Events]
        P3[JSON Data Format]
        P4[STDIO Transport]

        class P1,P2,P3,P4 protocolLabel
    end

    %% Add protocol indicators
    BE1 --> P1
    BE4 --> P2
    MC1 --> P2
    AI1 --> P4
    FL4 --> P3

    %% Styling for data flow
    linkStyle 0,1,2,3,4,5 stroke:#01579b,stroke-width:2px
    linkStyle 6 stroke:#4a148c,stroke-width:2px,stroke-dasharray: 5 5
    linkStyle 7,8,9,10,11,12,13,14,15,16 stroke:#33691e,stroke-width:1px
    linkStyle 17,18,19,20 stroke:#1b5e20,stroke-width:2px
    linkStyle 21 stroke:#1b5e20,stroke-width:2px,stroke-dasharray: 5 5
    linkStyle 22,23,24,25,26 stroke:#880e4f,stroke-width:1px
    linkStyle 27,28,29 stroke:#f57f17,stroke-width:1px,stroke-dasharray: 3 3
    linkStyle 30,31,32 stroke:#f57f17,stroke-width:1px,stroke-dasharray: 3 3
    linkStyle 33,34,35 stroke:#f57f17,stroke-width:1px,stroke-dasharray: 3 3
```

## Key Features

- **Multi-Application Support**: Separate log storage for each app
- **Multi-Host Support**: Different frontend hosts tracked separately
- **Namespace Organization**: Browser, user-actions, api-calls, performance logs
- **Real-time Streaming**: SSE-based log delivery to AI assistants
- **Fallback Mechanisms**: HTTP polling when SSE unavailable
- **Auto-Configuration**: Backend injects config when serving logger script
- **Buffer & Retry**: Frontend handles backend unavailability gracefully
- **Duplicate Filtering**: Prevents log spam at multiple levels
- **Rate Limiting**: Protects backend from abuse