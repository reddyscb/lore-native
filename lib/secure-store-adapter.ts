import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
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
  private async getEncryptionKey(keyName: string): Promise<Uint8Array> {
    let key = await SecureStore.getItemAsync(keyName);
    if (!key) {
      key = aesjs.utils.hex.fromBytes(crypto.getRandomValues(new Uint8Array(32)));
      await SecureStore.setItemAsync(keyName, key);
    }
    return aesjs.utils.hex.toBytes(key);
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
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
    await AsyncStorage.setItem(key, `${ivHex}:${dataHex}`);
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(`${key}_key`);
  }
}

export const largeSecureStore = new LargeSecureStore();
