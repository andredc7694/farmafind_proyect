import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { AccountMessage, AccountMessageDelivery } from '../application/account-messages.js';

export interface MailboxEntry {
  readonly id: string;
  readonly kind: AccountMessage['kind'];
  readonly to: string;
  readonly code: string;
  readonly expiresAt: string;
  readonly createdAt: string;
}

/**
 * Simulador local de correo (solo TEST). Escribe JSON-lines bajo un directorio `.cache` ignorado por Git;
 * no expone ninguna ruta HTTP. Se lee con `scripts/f01/mailbox.mjs`.
 */
export class FileMailboxSimulator implements AccountMessageDelivery {
  private readonly file: string;

  constructor(directory: string, private readonly now: () => Date = () => new Date()) {
    const resolved = path.resolve(directory);
    if (!resolved.split(path.sep).includes('.cache')) {
      throw new Error('Simulador de correo: el directorio debe estar bajo .cache (ignorado por Git)');
    }
    this.file = path.join(resolved, 'mailbox.jsonl');
  }

  async deliver(message: AccountMessage): Promise<void> {
    const entry: MailboxEntry = { id: randomUUID(), kind: message.kind, to: message.to, code: message.code,
      expiresAt: message.expiresAt.toISOString(), createdAt: this.now().toISOString() };
    await mkdir(path.dirname(this.file), { recursive: true });
    await appendFile(this.file, `${JSON.stringify(entry)}\n`, { encoding: 'utf8', mode: 0o600 });
  }

  async read(to?: string): Promise<readonly MailboxEntry[]> {
    let text: string;
    try { text = await readFile(this.file, 'utf8'); } catch { return []; }
    const entries = text.split('\n').filter(Boolean).map(line => JSON.parse(line) as MailboxEntry);
    return to ? entries.filter(entry => entry.to === to) : entries;
  }
}
