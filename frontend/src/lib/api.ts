const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface FetchOptions extends RequestInit {
  token?: string;
}

export async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutMs = 25000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Backend not responding after ${timeoutMs / 1000}s. The server may be starting up. Please try again.`);
    }
    throw err;
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: string;
  user_id: number;
  name: string;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

// ── Hives ─────────────────────────────────────────────────────────────────

export interface Hive {
  id: number;
  hive_code: string;
  cluster_id: number | null;
  farmer_id: number;
  status: string;
  created_at: string;
}

export interface HiveDetail extends Hive {
  latest_temperature: number | null;
  latest_humidity: number | null;
  latest_weight: number | null;
  latest_sound_level: number | null;
  anomaly_status: string | null;
  last_updated: string | null;
}

export interface SensorReading {
  id: number;
  hive_id: number;
  temperature: number | null;
  humidity: number | null;
  weight: number | null;
  sound_level: number | null;
  timestamp: string;
  anomaly: boolean;
  anomaly_score: number | null;
}
export async function getHives(token: string): Promise<Hive[]> {
  return apiFetch<Hive[]>('/api/hives', { token });
}

export async function getHive(token: string, id: number): Promise<HiveDetail> {
  return apiFetch<HiveDetail>(`/api/hives/${id}`, { token });
}

// ── Batches ───────────────────────────────────────────────────────────────

export interface Batch {
  id: number;
  batch_code: string;
  hive_id: number;
  farmer_id: number;
  honey_type: string | null;
  quantity: number;
  harvest_date: string;
  status: string;
  created_at: string;
}

export interface TraceabilityEvent {
  id: number;
  batch_id: number;
  stage: string;
  actor_id: number;
  event_data: string | null;
  timestamp: string;
  previous_hash: string;
  current_hash: string;
}

export interface BatchDetail extends Batch {
  events: TraceabilityEvent[];
}

export interface VerifyResult {
  valid: boolean;
  batch_id: string;
  message: string;
}

export interface HarvestInput {
  hive_id: number;
  honey_type: string;
  harvest_date: string;
  quantity: number;
  location?: string;
  notes?: string;
}

export async function getBatches(token: string): Promise<Batch[]> {
  return apiFetch<Batch[]>('/api/batches', { token });
}

export async function getBatch(token: string, id: number): Promise<BatchDetail> {
  return apiFetch<BatchDetail>(`/api/batches/${id}`, { token });
}

export async function createHarvest(token: string, data: HarvestInput): Promise<Batch> {
  return apiFetch<Batch>('/api/batches/harvest', {
    method: 'POST', token, body: JSON.stringify(data),
  });
}

export async function addEvent(token: string, batchId: number, stage: string, eventData?: string): Promise<TraceabilityEvent> {
  return apiFetch<TraceabilityEvent>(`/api/batches/${batchId}/events`, {
    method: 'POST', token, body: JSON.stringify({ stage, event_data: eventData }),
  });
}

export async function getTimeline(batchId: number): Promise<TraceabilityEvent[]> {
  return apiFetch<TraceabilityEvent[]>(`/api/batches/${batchId}/timeline`);
}

export async function verifyChain(batchId: number): Promise<VerifyResult> {
  return apiFetch<VerifyResult>(`/api/batches/${batchId}/verify`);
}

export async function getBatchQR(batchId: number): Promise<{ qr_code: string; batch_code: string }> {
  return apiFetch<{ qr_code: string; batch_code: string }>(`/api/batches/${batchId}/qr`);
}

// ── Consumer (public) ─────────────────────────────────────────────────────

export interface ConsumerBatchInfo {
  valid: boolean;
  batch_code: string;
  honey_type: string | null;
  quantity: number;
  harvest_date: string;
  hive_code: string | null;
  status: string;
  timeline: Array<{
    stage: string;
    timestamp: string;
    hash: string;
    event_data: string | null;
  }>;
}

export async function consumerVerify(batchCode: string): Promise<ConsumerBatchInfo> {
  return apiFetch<ConsumerBatchInfo>(`/api/batches/verify/consumer/${batchCode}`);
}

// ── Alerts ────────────────────────────────────────────────────────────────

export interface Alert {
  id: number;
  hive_id: number;
  type: string;
  message: string;
  severity: string;
  created_at: string;
  resolved: boolean;
}

export async function getAlerts(token: string, hiveId?: number): Promise<Alert[]> {
  const params = hiveId ? `?hive_id=${hiveId}` : '';
  return apiFetch<Alert[]>(`/api/alerts${params}`, { token });
}

// ── Admin ─────────────────────────────────────────────────────────────────

export interface AdminDashboard {
  total_clusters: number;
  total_beekeepers: number;
  active_hives: number;
  honey_produced_kg: number;
  recent_alerts: Alert[];
}

export interface ClusterStats {
  id: number;
  name: string;
  location: string;
  hive_count: number;
  beekeeper_count: number;
  honey_produced_kg: number;
}

export async function getAdminDashboard(token: string): Promise<AdminDashboard> {
  return apiFetch<AdminDashboard>('/api/admin/dashboard', { token });
}

export async function getAdminClusters(token: string): Promise<ClusterStats[]> {
  return apiFetch<ClusterStats[]>('/api/admin/clusters', { token });
}

export async function getAdminBatches(token: string): Promise<any[]> {
  return apiFetch<any[]>('/api/admin/batches', { token });
}

export async function getHiveTelemetry(token: string, id: number, limit = 50): Promise<SensorReading[]> {
  return apiFetch<SensorReading[]>(`/api/hives/${id}/telemetry?limit=${limit}`, { token });
}
