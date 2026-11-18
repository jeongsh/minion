import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRandomValues, randomUUID } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CHUNK_SIZE = 1800;
const INSTALLATION_ID_KEY = 'minion.installation-id';
const AUTH_RETURN_TO_KEY = 'minion.auth.return-to';
const isSsr = Platform.OS === 'web' && typeof window === 'undefined';

export const secureSessionStorage = {
  async getItem(key: string) {
    if (isSsr) return null;
    if (Platform.OS === 'web') return AsyncStorage.getItem(key);
    const count = Number(await SecureStore.getItemAsync(`${key}.count`) ?? 0);
    if (!Number.isInteger(count) || count < 1) return null;
    const chunks = await Promise.all(Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(`${key}.${index}`)));
    return chunks.every((chunk): chunk is string => chunk !== null) ? chunks.join('') : null;
  },
  async setItem(key: string, value: string) {
    if (isSsr) return;
    if (Platform.OS === 'web') return AsyncStorage.setItem(key, value);
    const previousCount = Number(await SecureStore.getItemAsync(`${key}.count`) ?? 0);
    const chunks = Array.from({ length: Math.ceil(value.length / CHUNK_SIZE) }, (_, index) => value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE));
    await Promise.all(chunks.map((chunk, index) => SecureStore.setItemAsync(`${key}.${index}`, chunk)));
    await SecureStore.setItemAsync(`${key}.count`, String(chunks.length));
    if (previousCount > chunks.length) {
      await Promise.all(Array.from({ length: previousCount - chunks.length }, (_, index) => SecureStore.deleteItemAsync(`${key}.${chunks.length + index}`)));
    }
  },
  async removeItem(key: string) {
    if (isSsr) return;
    if (Platform.OS === 'web') return AsyncStorage.removeItem(key);
    const count = Number(await SecureStore.getItemAsync(`${key}.count`) ?? 0);
    await Promise.all(Array.from({ length: Number.isInteger(count) ? count : 0 }, (_, index) => SecureStore.deleteItemAsync(`${key}.${index}`)));
    await SecureStore.deleteItemAsync(`${key}.count`);
  },
};

let installationIdPromise: Promise<string> | undefined;

function createInstallationId() {
  if (Platform.OS !== 'web' || typeof globalThis.crypto?.randomUUID === 'function') return randomUUID();

  // LAN HTTP supports getRandomValues, but randomUUID requires HTTPS/localhost.
  const bytes = getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getInstallationId(): Promise<string> {
  installationIdPromise ??= readOrCreateInstallationId().catch((error) => {
    installationIdPromise = undefined;
    throw error;
  });
  return installationIdPromise;
}

async function readOrCreateInstallationId() {
  if (isSsr) return 'server-render';
  const existing = Platform.OS === 'web'
    ? await AsyncStorage.getItem(INSTALLATION_ID_KEY)
    : await SecureStore.getItemAsync(INSTALLATION_ID_KEY);
  if (existing) return existing;
  const created = createInstallationId();
  if (Platform.OS === 'web') await AsyncStorage.setItem(INSTALLATION_ID_KEY, created);
  else await SecureStore.setItemAsync(INSTALLATION_ID_KEY, created);
  return created;
}

export async function setAuthReturnTo(path: string) {
  if (isSsr) return;
  const safePath = path.startsWith('/') && !path.startsWith('//') ? path : '/';
  if (Platform.OS === 'web') await AsyncStorage.setItem(AUTH_RETURN_TO_KEY, safePath);
  else await SecureStore.setItemAsync(AUTH_RETURN_TO_KEY, safePath);
}

export async function takeAuthReturnTo() {
  if (isSsr) return '/';
  const value = Platform.OS === 'web'
    ? await AsyncStorage.getItem(AUTH_RETURN_TO_KEY)
    : await SecureStore.getItemAsync(AUTH_RETURN_TO_KEY);
  if (Platform.OS === 'web') await AsyncStorage.removeItem(AUTH_RETURN_TO_KEY);
  else await SecureStore.deleteItemAsync(AUTH_RETURN_TO_KEY);
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/';
}
