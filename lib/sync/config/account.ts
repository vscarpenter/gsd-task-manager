/**
 * Sync account registration and login
 */

import { getApiClient } from "../api-client";
import type { RegisterRequest, LoginRequest } from "../types";
import { getSyncConfig, updateSyncConfig } from "./get-set";
import { enableSync } from "./enable";

/**
 * Register new sync account
 */
export async function registerSyncAccount(
  email: string,
  password: string,
  deviceName?: string
): Promise<void> {
  const config = await getSyncConfig();
  if (!config) {
    throw new Error("Sync config not initialized");
  }

  const api = getApiClient(config.serverUrl);

  const request: RegisterRequest = {
    email,
    password: password,
    deviceName: deviceName || config.deviceName,
  };

  const response = await api.register(request);

  // Enable sync with the new credentials
  await enableSync(
    response.userId,
    email,
    response.token,
    response.expiresAt,
    response.salt,
    password
  );

  // Update device ID
  await updateSyncConfig({
    deviceId: response.deviceId,
  });
}

/**
 * Login to existing sync account
 */
export async function loginSyncAccount(
  email: string,
  password: string
): Promise<void> {
  const config = await getSyncConfig();
  if (!config) {
    throw new Error("Sync config not initialized");
  }

  const api = getApiClient(config.serverUrl);

  const request: LoginRequest = {
    email,
    passwordHash: password,
    deviceId: config.deviceId,
    deviceName: config.deviceName,
  };

  const response = await api.login(request);

  // Enable sync with the login credentials
  await enableSync(
    response.userId,
    email,
    response.token,
    response.expiresAt,
    response.salt,
    password
  );

  // Update device ID if changed
  if (response.deviceId !== config.deviceId) {
    await updateSyncConfig({
      deviceId: response.deviceId,
    });
  }
}
