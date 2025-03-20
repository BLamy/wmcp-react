import { base64URLStringToBuffer, bufferToBase64URLString } from './utils';

export class WebAuthnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebAuthnError';
  }
}

export async function startRegistration(email: string) {
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
      name: 'Passkey Demo',
      id: window.location.hostname,
    },
    user: {
      id: userId,
      name: email,
      displayName: email,
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
  } catch (error) {
    throw new WebAuthnError(`Failed to create credential: ${error}`);
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
  } catch (error) {
    throw new WebAuthnError(`Failed to authenticate: ${error}`);
  }
}