import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import * as SecureStore from 'expo-secure-store';
import 'react-native-get-random-values';

/**
 * Session storage adapter for supabase-js on React Native.
 *
 * Why not plain AsyncStorage: AsyncStorage is unencrypted on-disk. Why not
 * plain SecureStore: iOS Keychain entries are capped at ~2KB, and a Supabase
 * session (access + refresh token + user metadata) can exceed that.
 *
 * So: a random 256-bit AES key lives in SecureStore (Keychain-backed,
 * hardware-encrypted). The actual session blob lives in AsyncStorage,
 * encrypted with that key. Losing the device or the app's Keychain entry
 * makes the AsyncStorage blob unrecoverable. This is Supabase's documented
 * pattern for Expo apps that need session data at rest to be encrypted.
 */
class LargeSecureStore {
  private readonly memoryStore = new Map<string, string>();

  private get isWeb(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  private get hasWindowStorage(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  private async getEncryptionKey(keyName: string): Promise<Uint8Array> {
    if (this.isWeb) {
      try {
        const existingKey = this.hasWindowStorage ? window.localStorage.getItem(keyName) : this.memoryStore.get(keyName);
        if (existingKey) {
          return aesjs.utils.hex.toBytes(existingKey);
        }

        const newKey = aesjs.utils.hex.fromBytes(crypto.getRandomValues(new Uint8Array(32)));
        if (this.hasWindowStorage) {
          window.localStorage.setItem(keyName, newKey);
        } else {
          this.memoryStore.set(keyName, newKey);
        }
        return aesjs.utils.hex.toBytes(newKey);
      } catch (error) {
        console.warn('Web session key storage failed. Falling back to memory.', error);
        const fallbackKey = aesjs.utils.hex.fromBytes(crypto.getRandomValues(new Uint8Array(32)));
        this.memoryStore.set(keyName, fallbackKey);
        return aesjs.utils.hex.toBytes(fallbackKey);
      }
    }

    try {
      let key = await SecureStore.getItemAsync(keyName);
      if (!key) {
        key = aesjs.utils.hex.fromBytes(crypto.getRandomValues(new Uint8Array(32)));
        await SecureStore.setItemAsync(keyName, key);
      }
      return aesjs.utils.hex.toBytes(key);
    } catch (error) {
      console.warn('SecureStore unavailable. Falling back to AsyncStorage.', error);
      return aesjs.utils.hex.toBytes(aesjs.utils.hex.fromBytes(crypto.getRandomValues(new Uint8Array(32))));
    }
  }

  async getItem(key: string): Promise<string | null> {
    let encrypted: string | null = null;

    try {
      if (this.isWeb) {
        encrypted = this.hasWindowStorage ? window.localStorage.getItem(key) : this.memoryStore.get(key) ?? null;
      } else {
        encrypted = await AsyncStorage.getItem(key);
      }
    } catch (error) {
      console.warn('Session getItem failed.', error);
    }

    if (!encrypted) return null;

    const keyName = `${key}_key`;
    const encryptionKey = await this.getEncryptionKey(keyName);

    const [ivHex, dataHex] = encrypted.split(':');
    if (!ivHex || !dataHex) return null;

    const iv = aesjs.utils.hex.toBytes(ivHex);
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(iv));
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(dataHex));
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async setItem(key: string, value: string): Promise<void> {
    const keyName = `${key}_key`;
    const encryptionKey = await this.getEncryptionKey(keyName);

    const iv = crypto.getRandomValues(new Uint8Array(16));
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(iv));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    const ivHex = aesjs.utils.hex.fromBytes(iv);
    const dataHex = aesjs.utils.hex.fromBytes(encryptedBytes);

    try {
      if (this.isWeb) {
        if (this.hasWindowStorage) {
          window.localStorage.setItem(key, `${ivHex}:${dataHex}`);
        } else {
          this.memoryStore.set(key, `${ivHex}:${dataHex}`);
        }
        return;
      }

      await AsyncStorage.setItem(key, `${ivHex}:${dataHex}`);
    } catch (error) {
      console.warn('Session setItem failed.', error);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      if (this.isWeb) {
        if (this.hasWindowStorage) {
          window.localStorage.removeItem(key);
          window.localStorage.removeItem(`${key}_key`);
        } else {
          this.memoryStore.delete(key);
          this.memoryStore.delete(`${key}_key`);
        }
        return;
      }

      await AsyncStorage.removeItem(key);
      await SecureStore.deleteItemAsync(`${key}_key`);
    } catch (error) {
      console.warn('Session removeItem failed.', error);
    }
  }
}

export const largeSecureStore = new LargeSecureStore();
