import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  timeout: 60000,
});

// Overview
export const getOverview = () => api.get("/overview").then((r) => r.data);

// Targets
export const getTargets = () => api.get("/targets").then((r) => r.data);
export const getTarget = (id) => api.get(`/targets/${id}`).then((r) => r.data);
export const getTargetRuns = (id, params) =>
  api.get(`/targets/${id}/runs`, { params }).then((r) => r.data);

// Runs
export const getRun = (id) => api.get(`/runs/${id}`).then((r) => r.data);

// Alerts
export const getAlerts = (params) =>
  api.get("/alerts", { params }).then((r) => r.data);
export const getActiveAlerts = () =>
  api.get("/alerts/active").then((r) => r.data);

// Config
export const getConfig = () => api.get("/config").then((r) => r.data);
export const reloadConfig = () => api.post("/config/reload").then((r) => r.data);

// Monitor
export const triggerRunAll = () =>
  api.post("/monitor/run-all").then((r) => r.data);
export const triggerRunTarget = (id) =>
  api.post(`/monitor/run/${id}`).then((r) => r.data);

// Scheduler
export const getScheduler = () => api.get("/scheduler").then((r) => r.data);

// Screenshots
export const getScreenshotUrl = (filename) =>
  `${API}/screenshots/${filename}`;

export default api;
