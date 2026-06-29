// === DGCA LIVE CONFIG - SECURE VERSION ===
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR3UdKh-hOs6gr9ADPQyQH8oHYwK2lm3u0H-zqEbHQv6raUnrNk6TPMTiY4-S80ujxZlKStBJX7fdNd/pub?gid=0&single=true&output=csv";
const SHEET_VIEW_URL = "https://docs.google.com/spreadsheets/d/1JJCRGWs1HoI2wcAtEZU9HiDKxaFZmoA0Hx-Cu0JlU_E/edit";

// Your Cloudflare Worker URL - replace after you deploy
const WORKER_URL = "https://dgca-groq-proxy.shubhamkumarvinod.workers.dev";

const GROQ_MODEL = "llama-3.3-70b-versatile";
const REFRESH_INTERVAL_MS = 300000;
