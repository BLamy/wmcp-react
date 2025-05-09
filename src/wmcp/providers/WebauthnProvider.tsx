import React, {
  createContext, useContext, useState, useCallback, ReactNode, useEffect
} from 'react';
import {
  startRegistration,
  startAuthentication,
  WebAuthnError,
  deriveKey,
  base64URLStringToBuffer
} from '@/webauthn';
import { encryptData, decryptData } from '@/webauthn';

interface WebauthnContextType<T = any> {
  isAuthenticated: boolean;
  encryptionKey: CryptoKey | null;
  userIdentifier: string | null;
  values: T | null;
  error: string | null;
  isLoading: boolean;
  login: () => Promise<CryptoKey>;
  logout: () => void;
  register: (email: string) => Promise<CryptoKey>; 
  setValues: (v: T) => Promise<T>; 
  destroyData: () => Promise<boolean>; 
  verifyDataDestruction: (keyName: string) => Promise<boolean>;
}

const WebauthnContext = createContext<WebauthnContextType | undefined>(undefined);

type FallbackRender<T> = (props: {
  submit: (values: T) => Promise<void>;
  login: () => Promise<CryptoKey>;
  error?: string;
  isLoading?: boolean;
}) => ReactNode;

interface WebauthnProviderProps<T> {
  storageKey: string;
  fallback: FallbackRender<T>;
  children: ReactNode | ((ctx: WebauthnContextType<T>) => ReactNode);
  strictMode?: boolean;
  initialValues?: T;
  forceShowFallback?: boolean;
}

export function WebauthnProvider<T extends Record<string, any>>({
  storageKey,
  fallback,
  children,
  strictMode = false,
  initialValues,
  forceShowFallback = false
}: WebauthnProviderProps<T>) {
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [userIdentifier, setUserIdentifier] = useState<string | null>(() => localStorage.getItem('userIdentifier'));
  const [values, setValuesState] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const decryptFromStorage = useCallback(async (key: CryptoKey) => {
    const cipher = localStorage.getItem(`${storageKey}.data`);
    if (!cipher) return null;
    try {
      const json = await decryptData(key, cipher);
      return JSON.parse(json) as T;
    } catch (err) {
      console.error("Decryption failed - likely wrong passkey:", err);
      setError("Failed to decrypt data. You may be using the wrong passkey.");
      return null;
    }
  }, [storageKey, setError]);

  const encryptAndStore = useCallback(async (key: CryptoKey, data: T) => {
    const cipher = await encryptData(key, JSON.stringify(data));
    localStorage.setItem(`${storageKey}.data`, cipher);
    return data;
  }, [storageKey]);

  const login = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const assertion = await startAuthentication();
      const keyBasisBuffer = base64URLStringToBuffer(assertion.rawId);
      const key = await deriveKey(keyBasisBuffer);

      const hasData = !!localStorage.getItem(`${storageKey}.data`);
      if (hasData) {
        const decryptedValues = await decryptFromStorage(key);
        if (!decryptedValues) {
          throw new Error("Failed to decrypt data with this passkey. Please select a different key or destroy data.");
        }
        setValuesState(decryptedValues);
      }

      setEncryptionKey(key);
      setUserIdentifier(assertion.rawId);
      localStorage.setItem('userIdentifier', assertion.rawId);
      return key;
    } catch (e: any) {
      let specificErrorMessage = 'Authentication failed. Please try again.';
      // Check for common cancellation error names
      if (e.name === 'AbortError' || e.name === 'NotAllowedError') {
        specificErrorMessage = 'Login attempt was cancelled by the user.';
      } else if (e instanceof Error) { // Catches WebAuthnError too as it extends Error
        specificErrorMessage = e.message;
      }
      // If it's not an Error instance but has a message property (less common)
      else if (e && typeof e.message === 'string') {
        specificErrorMessage = e.message;
      }
      
      setError(specificErrorMessage);
      setEncryptionKey(null);
      throw e; 
    } finally {
      setIsLoading(false);
    }
  }, [decryptFromStorage, storageKey, setIsLoading, setError, setEncryptionKey, setUserIdentifier, setValuesState]);

  const register = useCallback(async (email: string): Promise<CryptoKey> => {
    setIsLoading(true);
    setError(null);
    try {
      const credential = await startRegistration(email);
      const keyBasisBuffer = base64URLStringToBuffer(credential.rawId);
      const key = await deriveKey(keyBasisBuffer);

      setEncryptionKey(key);
      setUserIdentifier(credential.rawId);
      localStorage.setItem('userIdentifier', credential.rawId);

      if (initialValues) {
        await encryptAndStore(key, initialValues);
        setValuesState(initialValues);
      }
      return key;
    } catch (e: any) {
      const errorMessage = e instanceof WebAuthnError || e instanceof Error
        ? e.message
        : 'Registration failed. Please try again.';
      setError(errorMessage);
      setEncryptionKey(null);
      setUserIdentifier(null);
      localStorage.removeItem('userIdentifier');
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [encryptAndStore, initialValues, setIsLoading, setError, setEncryptionKey, setUserIdentifier, setValuesState]);

  const logout = useCallback(() => {
    setEncryptionKey(null);
    setValuesState(null); 
    setError(null);
    // Keep userIdentifier for potential re-login, or clear if full anonymous state is desired.
  }, [setEncryptionKey, setValuesState, setError]);

  const setValuesHandler = useCallback(async (v: T): Promise<T> => {
    if (!encryptionKey) throw new Error('Not authenticated');
    const savedValues = await encryptAndStore(encryptionKey, v);
    setValuesState(savedValues);
    return savedValues;
  }, [encryptionKey, encryptAndStore, setValuesState]);

  const destroyData = useCallback(async (): Promise<boolean> => {
    localStorage.removeItem(`${storageKey}.data`);
    setValuesState(null);
    // Optionally call logout() here if destroying data should also log the user out.
    return true;
  }, [storageKey, setValuesState /*, logout*/]);

  const verifyDataDestruction = useCallback(async (keyName: string): Promise<boolean> => {
    if (keyName === storageKey) {
      await destroyData();
      return true;
    }
    return false;
  }, [destroyData, storageKey]);

  useEffect(() => {
    // Auto-login in strict mode only if no key, not loading, a user identifier exists, AND no current error.
    if (userIdentifier && !encryptionKey && !isLoading && strictMode && !error) {
      console.log("[SecureForm] Attempting auto-login (Strict Mode due to userIdentifier and no key/error)...");
      setIsLoading(true);
      login().catch((err) => {
        // Error is already set by the login() function itself.
        // Log for clarity of auto-login failure specific to this effect.
        console.error("[SecureForm] Auto-login attempt failed (Strict Mode Effect):", err.message || err);
      }).finally(() => {
        setIsLoading(false);
      });
    }
  }, [userIdentifier, encryptionKey, isLoading, strictMode, error, login, setIsLoading]); // Added error to dependency array and condition

  const handleSubmit = useCallback(async (formVals: T) => {
    setIsLoading(true);
    setError(null);
    try {
      let key = encryptionKey;
      if (!key) {
        const email = typeof formVals === 'object' && formVals !== null && 'email' in formVals
          ? String((formVals as any).email)
          : storageKey;
        
        // Assuming register will set the key upon success
        key = await register(email);
      }
      // Key should be available now either from existing state or after registration
      if (!key) throw new Error("Encryption key not available after registration attempt.");
      
      await encryptAndStore(key, formVals);
      setValuesState(formVals);
    } catch (e: any) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to save';
      setError(errorMessage);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [encryptionKey, register, encryptAndStore, storageKey, setIsLoading, setError, setValuesState]);

  const contextValue: WebauthnContextType<T> = {
    isAuthenticated: encryptionKey !== null,
    encryptionKey,
    userIdentifier,
    values,
    error,
    isLoading,
    login,
    logout,
    register,
    setValues: setValuesHandler,
    destroyData,
    verifyDataDestruction
  };

  const shouldShowFallback = () => {
    if (forceShowFallback) return true;
    if (strictMode && !encryptionKey) return true;
    // In lazy mode, we generally don't want to show the main fallback unless specifically triggered
    // by an error that `forceShowFallback` would be set for.
    // Child components handle their own states.
    return false; 
  };

  return (
    <WebauthnContext.Provider value={contextValue}>
      {shouldShowFallback()
        ? fallback({ submit: handleSubmit, login, error: error || undefined, isLoading })
        : typeof children === 'function'
          ? (children as (ctx: WebauthnContextType<T>) => ReactNode)(contextValue)
          : children}
    </WebauthnContext.Provider>
  );
}

export const useWebauthn = <T,>() => {
  const context = useContext(WebauthnContext);
  if (!context) throw new Error('useWebauthn must be used within WebauthnProvider');
  return context as WebauthnContextType<T>;
}; 