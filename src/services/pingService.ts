import { API_CONFIG } from "../config/api.config";

export interface PingResponse {
  status: string;
  database: string;
}

export async function fetchPing(): Promise<PingResponse> {
  const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PING}`);

  if (!response.ok) {
    throw new Error(`ping request failed with status ${response.status}`);
  }

  return response.json();
}
