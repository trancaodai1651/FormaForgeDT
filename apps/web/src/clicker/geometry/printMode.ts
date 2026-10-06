import type { BuildParams } from '../types';

/** Both UI controls select the same plate mode; block tools keep their own bodies. */
export function isFlatKeychainMode(settings: Pick<BuildParams, 'mergeTopFrame' | 'isFlatKeychain'> & { importMode?: string }): boolean {
  return settings.importMode !== 'blocks' && settings.importMode !== 'hybrid'
    && (settings.mergeTopFrame || settings.isFlatKeychain === true);
}
