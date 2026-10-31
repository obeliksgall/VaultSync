import { execSync } from 'child_process';
import { checkToolAvailability } from './executor.js';

export interface SystemFlagHelp {
  flag: string;
  flagBase: string;
  short?: string;
  paramPlaceholder?: string;
  description: string;
  isDangerous?: boolean;
}

export interface FlagsHelpResult {
  available: boolean;
  engine: 'rclone' | 'rsync';
  version?: string;
  flags: SystemFlagHelp[];
}

// In-memory cache to prevent spawning subshell on every request
const helpCache = new Map<'rclone' | 'rsync', FlagsHelpResult>();

const DANGEROUS_FLAGS_RSYNC = new Set(['--rsh', '-e', '--exec', '--rsync-path', '--log-file', '--daemon']);
const DANGEROUS_FLAGS_RCLONE = new Set(['--password-command', '--ask-password', '--rc-addr', '--rc-web-gui', '--sftp-ssh', '--config', '--log-file']);

export function getSystemFlagsHelp(engine: 'rclone' | 'rsync'): FlagsHelpResult {
  if (helpCache.has(engine)) {
    return helpCache.get(engine)!;
  }

  const tools = checkToolAvailability();

  if (engine === 'rclone') {
    if (!tools.rclone) {
      const emptyRes: FlagsHelpResult = { available: false, engine: 'rclone', flags: [] };
      return emptyRes;
    }

    try {
      let rawHelp = '';
      try {
        rawHelp = execSync('rclone help flags', {
          timeout: 4000,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
        });
      } catch {
        rawHelp = execSync('rclone --help', {
          timeout: 4000,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
        });
      }

      const flags = parseRcloneHelpFlags(rawHelp);
      const result: FlagsHelpResult = {
        available: true,
        engine: 'rclone',
        version: tools.rcloneVer,
        flags,
      };
      helpCache.set(engine, result);
      return result;
    } catch (e) {
      console.error('[SyncVault] Error executing rclone help flags:', e);
      return { available: false, engine: 'rclone', flags: [] };
    }
  } else {
    // rsync
    if (!tools.rsync) {
      const emptyRes: FlagsHelpResult = { available: false, engine: 'rsync', flags: [] };
      return emptyRes;
    }

    try {
      const rawHelp = execSync('rsync --help', {
        timeout: 4000,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });

      const flags = parseRsyncHelpFlags(rawHelp);
      const result: FlagsHelpResult = {
        available: true,
        engine: 'rsync',
        version: tools.rsyncVer,
        flags,
      };
      helpCache.set(engine, result);
      return result;
    } catch (e) {
      console.error('[SyncVault] Error executing rsync --help:', e);
      return { available: false, engine: 'rsync', flags: [] };
    }
  }
}

/**
 * Parses rclone help flags output.
 * Format examples:
 *       --transfers int                        Number of file transfers to run concurrently (default 4)
 *   -c, --checksum                             Check for changes with checksum & size, not modtime & size
 */
export function parseRcloneHelpFlags(output: string): SystemFlagHelp[] {
  const lines = output.split('\n');
  const results: SystemFlagHelp[] = [];
  const seenBases = new Set<string>();

  for (const line of lines) {
    if (!line.includes('--')) continue;

    // Regex matching: optional short "-c, ", long "--transfers", optional param "int", description
    const match = line.match(
      /^\s*(?:(-[a-zA-Z0-9]),\s+)?(--[a-zA-Z0-9][-a-zA-Z0-9_]*)(?:\s+([a-zA-Z0-9_]+))?\s{2,}(.+)$/
    );

    if (match) {
      const short = match[1] || undefined;
      const flagBase = match[2];
      const paramPlaceholder = match[3] || undefined;
      const description = (match[4] || '').trim();

      if (seenBases.has(flagBase)) continue;
      seenBases.add(flagBase);

      const flag = paramPlaceholder ? `${flagBase} ${paramPlaceholder}` : flagBase;
      const isDangerous =
        DANGEROUS_FLAGS_RCLONE.has(flagBase) ||
        flagBase.startsWith('--rc-') ||
        flagBase.endsWith('-command');

      results.push({
        flag,
        flagBase,
        short,
        paramPlaceholder,
        description,
        isDangerous,
      });
    }
  }

  return results;
}

/**
 * Parses rsync --help output.
 * Format examples:
 *  -v, --verbose               increase verbosity
 *  -q, --quiet                 suppress non-error messages
 *      --bwlimit=RATE          limit socket I/O bandwidth
 *      --exclude=PATTERN       exclude files matching PATTERN
 */
export function parseRsyncHelpFlags(output: string): SystemFlagHelp[] {
  const lines = output.split('\n');
  const results: SystemFlagHelp[] = [];
  const seenBases = new Set<string>();

  for (const line of lines) {
    if (!line.includes('--')) continue;

    const match = line.match(
      /^\s*(?:(-[a-zA-Z0-9]),\s+)?(--[a-zA-Z0-9][-a-zA-Z0-9_]*)(?:=(\S+))?\s{2,}(.+)$/
    );

    if (match) {
      const short = match[1] || undefined;
      const flagBase = match[2];
      const paramPlaceholder = match[3] || undefined;
      const description = (match[4] || '').trim();

      if (seenBases.has(flagBase)) continue;
      seenBases.add(flagBase);

      const flag = paramPlaceholder ? `${flagBase}=${paramPlaceholder}` : flagBase;
      const isDangerous =
        DANGEROUS_FLAGS_RSYNC.has(flagBase) ||
        flagBase.startsWith('--rsh') ||
        flagBase.startsWith('--exec') ||
        flagBase.startsWith('--rsync-path');

      results.push({
        flag,
        flagBase,
        short,
        paramPlaceholder,
        description,
        isDangerous,
      });
    }
  }

  return results;
}
