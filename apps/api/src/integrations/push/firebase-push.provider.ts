import { Injectable } from "@nestjs/common";
import type { PushMessage, PushProvider } from "./push-provider.interface";

/**
 * Real Firebase Cloud Messaging integration — documented stub. Wire up the
 * firebase-admin SDK once FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL /
 * FIREBASE_PRIVATE_KEY are real values (see docs/ENVIRONMENT.md).
 */
@Injectable()
export class FirebasePushProvider implements PushProvider {
  async send(_message: PushMessage): Promise<void> {
    throw new Error(
      "FirebasePushProvider is a documented stub — implement with firebase-admin once real " +
        "Firebase credentials exist. Keep PUSH_PROVIDER=mock until then.",
    );
  }
}
