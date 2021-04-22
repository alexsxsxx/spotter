import AsyncStorage from '@react-native-async-storage/async-storage';
import { SpotterStorage } from '..';

export class StorageNative implements SpotterStorage {

  async setItem<T>(key: string, value: T): Promise<void> {
    return await AsyncStorage.setItem(key, JSON.stringify(value));
  }

  async getItem<T>(key: string): Promise<T | null> {
    const value = await AsyncStorage.getItem(key);
    if (value === undefined || value === null) {
      return null;
    }

    return JSON.parse(value);
  }

}
