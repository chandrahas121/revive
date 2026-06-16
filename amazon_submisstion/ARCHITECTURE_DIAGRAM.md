# System Architecture Diagram

> **Instructions for the PRD:** You can copy this code block into any Mermaid-supported Markdown editor (like Notion, GitHub, or Obsidian) to instantly render the diagram. There are also free tools like [Mermaid Live Editor](https://mermaid.live/) where you can paste this code, customize the colors, and download it as a high-quality PNG/SVG for your Word document.

```mermaid
flowchart TB
    %% Pastel Styling (matching the PRD theme)
    classDef frontend fill:#e6f6eb,stroke:#8ebc9c,color:#1e1e1e,stroke-width:1px;
    classDef backend fill:#f4f1ea,stroke:#b0a89d,color:#1e1e1e,stroke-width:1px;
    classDef db fill:#faebd7,stroke:#dcb588,color:#1e1e1e,stroke-width:1px;
    classDef aws fill:#faebd7,stroke:#dcb588,color:#1e1e1e,stroke-width:1px;
    classDef ml fill:#e9e5fc,stroke:#a49aec,color:#1e1e1e,stroke-width:1px;
    classDef cache fill:#fdeced,stroke:#dfa2a3,color:#1e1e1e,stroke-width:1px;
    classDef external fill:#e9e5fc,stroke:#a49aec,color:#1e1e1e,stroke-width:2px,stroke-dasharray: 5 5;

    %% Client Layer
    subgraph ClientLayer ["Client & Edge Delivery"]
        User("User Browser / App"):::frontend
        Vercel["Vercel Edge CDN<br/>(React / Vite SPA)"]:::frontend
        CF["AWS CloudFront<br/>(Image CDN)"]:::aws
    end

    %% API Layer
    subgraph APILayer ["API & Load Balancing (Render)"]
        LB{"Load Balancer"}:::backend
        Django1["Django Instance 1<br/>(Gunicorn + WhiteNoise)"]:::backend
        Django2["Django Instance N<br/>(Stateless JWT Auth)"]:::backend
    end

    %% Data & Cache Layer
    subgraph DataLayer ["Data Persistence & Caching"]
        PG[("Supabase PostgreSQL<br/>(ACID Persistence)")]:::db
        Redis[("Upstash Redis<br/>(Cache & Demand Index)")]:::cache
        S3[("AWS S3<br/>(Media Blob Storage)")]:::aws
        FitTwin[("FitTwin FAISS Index<br/>(Vector Sizing Match)")]:::db
    end

    %% External Services
    subgraph External ["External Generative AI"]
        HF["HuggingFace Spaces API<br/>(Virtual Try-On Diffusion)"]:::external
    end

    %% Async & ML Worker Layer
    subgraph MLWorkerLayer ["Decoupled AI Processing Queue"]
        Queue[["Celery Task Queue<br/>(Backed by Redis)"]]:::cache
        WorkerFleet["ML Worker Fleet<br/>(Celery Concurrency)"]:::ml
        
        subgraph Models ["Fusion Grading Pipeline"]
            GDino["Grounding DINO<br/>(Defect Detection)"]:::ml
            Claude["Claude Haiku<br/>(Severity Inference)"]:::ml
            DINOv2["DINOv2<br/>(Catalog Verification)"]:::ml
        end
        EVRouter["EV Routing Optimizer<br/>(Stateless O(1) Math)"]:::ml
    end

    %% Connections
    User -- "Loads App" --> Vercel
    User -- "Requests Images" --> CF
    CF -. "Fetches Origin" .-> S3

    User -- "REST API Calls<br/>(JSON/JWT)" --> LB
    LB --> Django1
    LB --> Django2

    Django1 <--> Redis
    Django2 <--> Redis

    Django1 <--> PG
    Django2 <--> PG

    Django1 -- "Uploads Images" --> S3
    Django2 -- "Uploads Images" --> S3

    Django1 <--> FitTwin
    Django1 -- "Generates Image" --> HF

    Django1 -- "Dispatches Async Job" --> Queue
    Django2 -- "Dispatches Async Job" --> Queue

    Queue --> WorkerFleet
    WorkerFleet --> GDino & Claude & DINOv2
    WorkerFleet -- "Writes Grade Result" --> Redis
    WorkerFleet -- "Saves Final Data" --> PG

    %% Annotations for scalability
    note1["1000x Scalability: Stateless APIs<br/>allow infinite horizontal scaling"]
    LB -.-> note1

    note2["Microsecond Latency:<br/>Storefronts & Health Cards cached<br/>with 60s TTL"]
    Redis -.-> note2

    note3["Non-Blocking ML:<br/>Heavy GPU workloads isolated<br/>from main web threads"]
    WorkerFleet -.-> note3
```
