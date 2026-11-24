import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface SealedSecret {
  readonly ciphertext: Buffer; // texto cifrado + etiqueta de autenticación de 16 bytes
  readonly nonce: Buffer;      // 12 bytes, único por cifrado
}

/** AES-256-GCM. `context` (p. ej. el id de usuario) se autentica para que el secreto no sirva en otra fila. */
export class SecretBox {
  constructor(private readonly key: Buffer, private readonly random: (size: number) => Buffer = randomBytes) {
    if (key.length !== 32) throw new Error('SecretBox: la clave debe tener 32 bytes');
  }

  seal(plain: Buffer, context: string): SealedSecret {
    const nonce = this.random(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, nonce);
    cipher.setAAD(Buffer.from(context, 'utf8'));
    const body = Buffer.concat([cipher.update(plain), cipher.final()]);
    return { ciphertext: Buffer.concat([body, cipher.getAuthTag()]), nonce };
  }

  open(sealed: SealedSecret, context: string): Buffer {
    if (sealed.nonce.length !== 12 || sealed.ciphertext.length < 17) throw new Error('Secreto inválido');
    const decipher = createDecipheriv('aes-256-gcm', this.key, sealed.nonce);
    decipher.setAAD(Buffer.from(context, 'utf8'));
    decipher.setAuthTag(sealed.ciphertext.subarray(sealed.ciphertext.length - 16));
    try {
      return Buffer.concat([decipher.update(sealed.ciphertext.subarray(0, sealed.ciphertext.length - 16)), decipher.final()]);
    } catch { throw new Error('Secreto inválido'); }
  }
}
