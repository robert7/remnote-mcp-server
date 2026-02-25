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
 * Sent by the bridge plugin on connect to identify its version.
 */
export interface HelloMessage {
  type: 'hello';
  version: string;
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

export type BridgeMessage =
  | BridgeRequest
  | BridgeResponse
  | HelloMessage
  | HeartbeatPing
  | HeartbeatPong;
