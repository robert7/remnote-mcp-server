/**
 * Request sent TO RemNote plugin
 */
export interface BridgeRequest {
  id: string;
  action: string;
  payload: Record<string, unknown>;
}

/**
 * Response received FROM RemNote plugin
 */
export interface BridgeResponse {
  id: string;
  result?: unknown;
  error?: string;
}

/**
 * Heartbeat messages
 */
export interface HeartbeatPing {
  type: 'ping';
}

export interface HeartbeatPong {
  type: 'pong';
}

export type BridgeMessage = BridgeRequest | BridgeResponse | HeartbeatPing | HeartbeatPong;
