/** Public GitHub Releases feed; reject foreign APKs and mismatched package IDs. */
export const ASCEND_PACKAGE = 'com.ascendrpg.personal';
export const RELEASE_API = 'https://api.github.com/repos/kumarPint00/ascend/releases/latest';
export const APK_ASSET_NAME = 'ascend-android.apk';
export interface AvailableUpdate {
  version: string;
  versionCode: number;
  downloadUrl: string;
  releasePage: string;
  sizeBytes: number;
  notes: string;
}
type Data = Record<string, unknown>;
const record = (v: unknown): v is Data => !!v && typeof v === 'object' && !Array.isArray(v);
export function parseRelease(
  payload: unknown, installedVersionCode: number, installedPackage: string | null,
): AvailableUpdate | null {
  if (!record(payload) || payload.draft !== false || payload.prerelease !== false) return null;
  if (installedPackage !== ASCEND_PACKAGE || !Number.isInteger(installedVersionCode) || installedVersionCode < 1) return null;
  if (typeof payload.tag_name !== 'string' || !/^v\d+\.\d+\.\d+$/.test(payload.tag_name)) return null;
  if (typeof payload.body !== 'string') return null;
  const match = payload.body.match(/<!-- ASCEND_ANDROID_RELEASE (\{[^\n]*\}) -->/);
  if (!match) return null;
  let manifest: unknown;
  try { manifest = JSON.parse(match[1]); } catch { return null; }
  if (!record(manifest) || manifest.packageName !== ASCEND_PACKAGE ||
      !Number.isSafeInteger(manifest.versionCode) ||
      (manifest.versionCode as number) <= installedVersionCode) return null;
  if (!Array.isArray(payload.assets)) return null;
  const asset = payload.assets.find((v: unknown) => record(v) && v.name === APK_ASSET_NAME);
  if (!record(asset) || typeof asset.browser_download_url !== 'string' ||
      asset.browser_download_url !== 'https://github.com/kumarPint00/ascend/releases/download/' + payload.tag_name + '/' + APK_ASSET_NAME ||
      !Number.isSafeInteger(asset.size) || (asset.size as number) < 1_000_000 ||
      (asset.size as number) > 300_000_000) return null;
  if (typeof payload.html_url !== 'string' ||
      payload.html_url !== 'https://github.com/kumarPint00/ascend/releases/tag/' + payload.tag_name) return null;
  return {
    version: payload.tag_name.slice(1),
    versionCode: manifest.versionCode as number,
    downloadUrl: asset.browser_download_url,
    releasePage: payload.html_url,
    sizeBytes: asset.size as number,
    notes: payload.body.replace(match[0], '').trim().slice(0, 500),
  };
}
