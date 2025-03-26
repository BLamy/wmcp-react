export class WebAuthnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebAuthnError';
  }
}

// Convert ArrayBuffer to Base64 URL string
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

// Convert Base64 URL string to ArrayBuffer
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

export async function startRegistration(username: string = 'api-key-user') {
  if (!window.PublicKeyCredential) {
    throw new WebAuthnError('WebAuthn is not supported in this browser');
  }

  // Generate random user ID
  const userId = crypto.getRandomValues(new Uint8Array(16));
  
  // Generate challenge
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      name: 'MCP Chat',
      id: window.location.hostname,
    },
    user: {
      id: userId,
      name: username,
      displayName: username,
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 }, // ES256
      { type: 'public-key', alg: -257 }, // RS256
    ],
    timeout: 60000,
    attestation: 'none',
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required',
      residentKey: 'required',
    },
  };

  try {
    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    }) as PublicKeyCredential;

    const response = credential.response as AuthenticatorAttestationResponse;
    
    return {
      id: credential.id,
      rawId: bufferToBase64URLString(credential.rawId),
      response: {
        clientDataJSON: bufferToBase64URLString(response.clientDataJSON),
        attestationObject: bufferToBase64URLString(response.attestationObject),
      },
      type: credential.type,
    };
  } catch (error: any) {
    throw new WebAuthnError(`Failed to create credential: ${error?.message || error}`);
  }
}

export async function startAuthentication() {
  if (!window.PublicKeyCredential) {
    throw new WebAuthnError('WebAuthn is not supported in this browser');
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
    challenge,
    timeout: 60000,
    userVerification: 'required',
    rpId: window.location.hostname,
  };

  try {
    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    }) as PublicKeyCredential;

    const response = assertion.response as AuthenticatorAssertionResponse;

    return {
      id: assertion.id,
      rawId: bufferToBase64URLString(assertion.rawId),
      response: {
        authenticatorData: bufferToBase64URLString(response.authenticatorData),
        clientDataJSON: bufferToBase64URLString(response.clientDataJSON),
        signature: bufferToBase64URLString(response.signature),
        userHandle: response.userHandle ? bufferToBase64URLString(response.userHandle) : null,
      },
      type: assertion.type,
    };
  } catch (error: any) {
    throw new WebAuthnError(`Failed to authenticate: ${error?.message || error}`);
  }
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
      salt: new TextEncoder().encode('mcp-api-key-salt'),
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