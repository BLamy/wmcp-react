import { bufferToBase64URLString, base64URLStringToBuffer } from '../webauthn/utils';
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combines multiple class names using clsx and merges Tailwind CSS classes with tailwind-merge
 * to handle conflicts and duplications properly.
 * 
 * @param inputs - Class values to be combined (strings, objects, arrays, etc.)
 * @returns A string of merged class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export { bufferToBase64URLString, base64URLStringToBuffer };

export async function deriveKey(input: ArrayBuffer): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    input,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode('passkey-demo-salt'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(key: CryptoKey, data: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(data);
  
  const encryptedData = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    encodedData
  );
  
  const combined = new Uint8Array(iv.length + encryptedData.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedData), iv.length);
  
  return bufferToBase64URLString(combined.buffer);
}

export async function decryptData(key: CryptoKey, encryptedData: string): Promise<string> {
  const data = base64URLStringToBuffer(encryptedData);
  const iv = data.slice(0, 12);
  const ciphertext = data.slice(12);
  
  const decryptedData = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    ciphertext
  );
  
  return new TextDecoder().decode(decryptedData);
} 