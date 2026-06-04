/**
 * Vault-aware I/O. We talk to Obsidian's Vault API rather than Node fs so
 * writes are picked up by Obsidian's indexer immediately and follow the
 * user's vault-relative path conventions.
 */
import type { Vault } from 'obsidian';

export async function ensureFolder(vault: Vault, folder: string): Promise<void> {
  if (folder === '' || folder === '/' || folder === '.') return;
  const adapter = vault.adapter;
  if (await adapter.exists(folder)) return;
  // Recursively create parents.
  const parts = folder.split('/').filter(Boolean);
  let current = '';
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!(await adapter.exists(current))) {
      await vault.createFolder(current);
    }
  }
}

export async function writeIfChanged(
  vault: Vault,
  filePath: string,
  content: string
): Promise<{ written: boolean; created: boolean }> {
  const folder = filePath.split('/').slice(0, -1).join('/');
  if (folder) await ensureFolder(vault, folder);
  const existing = vault.getFileByPath(filePath);
  if (existing) {
    const prev = await vault.read(existing);
    if (prev === content) return { written: false, created: false };
    await vault.modify(existing, content);
    return { written: true, created: false };
  }
  await vault.create(filePath, content);
  return { written: true, created: true };
}

export async function fileExistsInVault(vault: Vault, filePath: string): Promise<boolean> {
  return Boolean(vault.getFileByPath(filePath));
}

export async function readCreatedAt(vault: Vault, filePath: string): Promise<string | null> {
  const file = vault.getFileByPath(filePath);
  if (!file) return null;
  try {
    const content = await vault.read(file);
    const m = content.match(/created_at:\s*['"]?([^'"\n]+)['"]?/);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}
