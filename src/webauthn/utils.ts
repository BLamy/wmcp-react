export function bufferToBase64URLString(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let str = '';
    
    for (const charCode of bytes) {
      str += String.fromCharCode(charCode);
    }
    
    const base64String = btoa(str);
    
    return base64String
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
  
  export function base64URLStringToBuffer(base64URLString: string): ArrayBuffer {
    const base64 = base64URLString
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    const padLength = (4 - (base64.length % 4)) % 4;
    const padded = base64.padEnd(base64.length + padLength, '=');
    
    const binary = atob(padded);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    return buffer;
  }
  
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