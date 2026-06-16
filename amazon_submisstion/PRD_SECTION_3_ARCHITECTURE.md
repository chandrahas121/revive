### 3. Tech Architecture & Scaling

#### Tech Stack

| Layer | Technology | Why |
| :--- | :--- | :--- |
| **Frontend** | React (Vite), Tailwind CSS | High-performance Single Page App with fast state management. Required for the rich, interactive UI of the Health Cards and Virtual Try-On features. |
| **Backend** | Django + Django REST Framework | Provides a robust ORM and rapid API development. Configured with stateless JWT authentication, making horizontal scaling effortless. |
| **Data / ML** | Supabase (PostgreSQL), Upstash (Redis), PyTorch, Grounding DINO, Claude Haiku | PostgreSQL ensures ACID compliance for orders/payments. Redis provides microsecond-latency caching and stores our Demand Index. PyTorch/DINO handle complex defect detection via Computer Vision. |
| **Infra** | Docker, Render (Web + Celery), Gunicorn, WhiteNoise, AWS S3, Vercel | Docker ensures identical environments across edge nodes. Gunicorn provides parallel multi-worker processing. AWS S3 handles infinitely scalable image storage. WhiteNoise compresses and serves static files. |

#### Key Algorithms & Complexity

**1. Automated Defect Grading Pipeline (CV + LLM Fusion)**
*   **Approach:** Grounding DINO detects defect bounding boxes → Claude Haiku infers severity from cropped defects → DINOv2 verifies the product matches the catalog → A Fusion Classifier outputs the final A/B/C/D grade.
*   **Complexity & Architecture:** Because this pipeline is GPU/CPU intensive, it is fully decoupled using an **Asynchronous Celery Queue**. The API operates in $O(1)$ time by instantly pushing a job ticket to Redis and returning a `job_id`. Background ML workers pick up the heavy computation. This ensures the main web server never blocks, even under massive upload spikes.

**2. Expected Value (EV) Routing Optimizer**
*   **Approach:** Calculates the most profitable destination for a returned item: `EV = (Resale Value * Prob_sell) - (Processing + Shipping + Holding Costs)`. 
*   **Complexity & Architecture:** $O(1)$ time complexity. This is designed as a "pure mathematical function" that requires zero database reads. Because it is completely stateless, it can evaluate thousands of routes simultaneously and is optimized to run on AWS Lambda for infinite horizontal scaling.

**3. Geospatial Demand Indexing**
*   **Approach:** Matches buyer proximity to seller items using Geohash-5 prefixes against a pre-computed Redis hash map.
*   **Complexity & Architecture:** $O(1)$ cache lookup time. Instead of running heavy SQL `GROUP BY` queries on the fly for every search, a background cron job pre-computes local demand every 6 hours and stores it in Redis (`demand:{geohash}`). The recommendation engine pulls this data in <1ms.

#### Scaling Strategy

REVIVE handles 100x–1000x growth through four independent, decoupled scaling layers:

1.  **Stateless Horizontal API Scaling:** The Django backend stores zero session state (utilizing encrypted JWT cookies). If user traffic spikes 100x, we simply spin up more identical Docker containers behind our Load Balancer, utilizing **Gunicorn** to run multiple concurrent worker processes on each container.
2.  **Decoupled ML Worker Fleet (Queueing):** AI grading is decoupled via Celery and Redis SQS. When 100,000 users upload photos during a sale event, the Django API does not crash; it instantly drops 100,000 job tickets into the Upstash Redis queue. We can dynamically scale our background ML Workers from 1 to 500 to process the queue without ever disrupting the frontend browsing experience.
3.  **Aggressive Read Caching & Edge Storage (Read/Write Split):** In e-commerce, 99% of traffic is browsing (Reads), not buying (Writes). We cache the storefront listings and Health Cards in Redis with a 60-second TTL, serving thousands of identical queries instantly with exactly *zero* hits to the PostgreSQL database. Furthermore, all user-uploaded images are offloaded entirely to AWS S3 and served via CloudFront (CDN).
4.  **Optimized Database Indexing:** To prevent the PostgreSQL database from slowing down as the table grows to millions of items, we implemented 4 composite B-Tree indexes on the most queried filter combinations (e.g., `status` + `geohash5` for localized storefront browsing). This drops query time from $O(N)$ full-table scans to $O(\log N)$ targeted index lookups.
