const isProd = import.meta.env.PROD;
const BASE = isProd ? "https://mossy.dayfit.pl" : "http://localhost";

export const API_BASE = {
  auth: isProd ? `${BASE}` : "http://localhost:8083",
  password: isProd ? `${BASE}` : "http://localhost:8082",
  device: isProd ? `${BASE}` : "http://localhost:8081",
};

export const KEYSYNC_WS = isProd
  ? "wss://mossy.dayfit.pl/api/v1/ws/key-sync"
  : "ws://localhost:8081/api/v1/ws/key-sync";
