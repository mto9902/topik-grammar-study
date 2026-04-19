import { Preferences } from '@capacitor/preferences'

const PREFIX = 'topik_';

export async function getItem<T>(key: string): Promise<T | null> {
  const { value } = await Preferences.get({ key: PREFIX + key });
  return value ? JSON.parse(value) : null;
}

export async function setItem<T>(key: string, value: T): Promise<void> {
  await Preferences.set({ key: PREFIX + key, value: JSON.stringify(value) });
}

export async function removeItem(key: string): Promise<void> {
  await Preferences.remove({ key: PREFIX + key });
}
