import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { type AvailableUpdate, parseRelease, RELEASE_API } from './release';

type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'installing';
export function useAppUpdates() {
  const [available, setAvailable] = useState<AvailableUpdate | null>(null);
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const check = useCallback(async (manual = false) => {
    if (Platform.OS !== 'android') return;
    setStatus('checking');
    setError(null);
    try {
      const response = await fetch(RELEASE_API, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ascend-android-updater' },
      });
      if (response.status === 404) {
        setAvailable(null);
        if (manual) Alert.alert('ASCEND updates', 'No published Android update is available yet.');
        return;
      }
      if (!response.ok) throw new Error('Update service returned ' + response.status);
      const payload: unknown = await response.json();
      const buildCode = Number(Application.nativeBuildVersion ?? '0');
      const next = parseRelease(payload, buildCode, Application.applicationId);
      setAvailable(next);
      if (!next && manual) Alert.alert('ASCEND updates', 'You are up to date, or no compatible release is available.');
    } catch(e) {
      const message = e instanceof Error ? e.message : 'Update check unavailable';
      setError(message);
      if (manual) Alert.alert('Update check failed', message + '. Try again when online.');
    } finally { setStatus('idle'); }
  }, []);
  useEffect(() => { void check(false); }, [check]);
  const install = useCallback(async () => {
    if (Platform.OS !== 'android' || !available) return;
    setStatus('downloading');
    setError(null);
    try {
      if (!FileSystem.cacheDirectory) throw new Error('App cache is unavailable');
      const destination = FileSystem.cacheDirectory + 'ascend-update-' + available.versionCode + '.apk';
      const result = await FileSystem.downloadAsync(available.downloadUrl, destination);
      if (result.status !== 200) throw new Error('APK download failed (HTTP ' + result.status + ')');
      const info = await FileSystem.getInfoAsync(result.uri);
      if (!info.exists || info.isDirectory || info.size !== available.sizeBytes) {
        await FileSystem.deleteAsync(result.uri, { idempotent: true });
        throw new Error('Downloaded APK did not match published file size');
      }
      const contentUri = await FileSystem.getContentUriAsync(result.uri);
      setStatus('installing');
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        type: 'application/vnd.android.package-archive',
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION; Android requires confirmation.
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Installation unavailable';
      setError(message);
      Alert.alert('Could not install update', message + '\n\nYou can install the signed APK from GitHub Releases instead. Existing app data should remain intact when the signing key matches.');
    } finally { setStatus('idle'); }
  }, [available]);
  return { available, status, error, check, install };
}
