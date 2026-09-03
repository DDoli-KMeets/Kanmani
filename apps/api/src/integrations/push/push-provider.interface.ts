export const PUSH_PROVIDER = "PUSH_PROVIDER";

export interface PushMessage {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushProvider {
  send(message: PushMessage): Promise<void>;
}
