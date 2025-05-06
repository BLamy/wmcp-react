import React, {
  createContext, useContext, useEffect, useState, useCallback, ReactNode
} from 'react';
import {
  startRegistration,
  startAuthentication,
  deriveKey,
  base64URLStringToBuffer,
} from '@/webauthn';
import { encryptData, decryptData } from '@/webauthn';

type SecureContext<T> = {
  isAuthenticated : boolean;
  encryptionKey   : CryptoKey | null;
  values          : T | null;
  login           : () => Promise<void>;
  logout          : () => void;
  setValues       : (v:T) => Promise<void>;
};

const Ctx = createContext<SecureContext<any> | undefined>(undefined);

type FallbackRender<T> = (props: {
  submit     : (values:T)=>Promise<void>;
  error?     : string;
  isLoading? : boolean;
}) => ReactNode;

interface Props<T> {
  storageKey        : string;
  fallback          : FallbackRender<T>;
  children          : (ctx: SecureContext<T>) => ReactNode;
}

export function SecureFormProvider<T extends Record<string, any>>(
  { storageKey, fallback, children }: Props<T>
){
  const [encryptionKey, setKey] = useState<CryptoKey|null>(null);
  const [values,        setVals] = useState<T|null>(null);
  const [error,         setErr]  = useState<string|null>(null);
  const [isLoading,     setLoad] = useState(false);

  /* ──────────────────────────────────────────────── */
  /*  Helpers                                         */
  /* ──────────────────────────────────────────────── */

  const decryptFromStorage = useCallback(async (key:CryptoKey) => {
    const cipher = localStorage.getItem(`${storageKey}.data`);
    if (!cipher) return null;
    const json   = await decryptData(key, cipher);
    return JSON.parse(json) as T;
  }, [storageKey]);

  const encryptAndStore = useCallback(async (key:CryptoKey, v:T) => {
    const cipher = await encryptData(key, JSON.stringify(v));
    localStorage.setItem(`${storageKey}.data`, cipher);
  }, [storageKey]);

  const deriveAndSetKey = useCallback(async (rawIdBase64:string) => {
    const buf = base64URLStringToBuffer(rawIdBase64);
    const key = await deriveKey(buf);
    setKey(key);
    return key;
  }, []);

  /* ──────────────────────────────────────────────── */
  /*  Auto‑login on mount                             */
  /* ──────────────────────────────────────────────── */

  useEffect(() => {
    const auto = async () => {
      const id = localStorage.getItem('userIdentifier');
      const hasBlob = !!localStorage.getItem(`${storageKey}.data`);
      if (!id || !hasBlob) return;

      setLoad(true);
      try {
        const assertion = await startAuthentication();
        const key = await deriveAndSetKey(assertion.rawId);
        const v = await decryptFromStorage(key);
        setVals(v);
      } catch (e){ console.error('[SecureForm] auto‑login failed', e); }
      finally     { setLoad(false); }
    };
    auto();
  }, [storageKey, decryptFromStorage, deriveAndSetKey]);

  /* ──────────────────────────────────────────────── */
  /*  Public API                                      */
  /* ──────────────────────────────────────────────── */

  const login = useCallback(async () => {
    setLoad(true); setErr(null);
    try {
      const assertion = await startAuthentication();
      const key = await deriveAndSetKey(assertion.rawId);
      const v   = await decryptFromStorage(key);
      setVals(v);
    } catch(e:any){ setErr(e.message || 'Login failed'); throw e; }
    finally      { setLoad(false); }
  }, [decryptFromStorage, deriveAndSetKey]);

  const logout = useCallback(() => {
    setKey(null);
    setVals(null);
    setErr(null);
  }, []);

  const setValues = useCallback(async (v:T) => {
    if (!encryptionKey) throw new Error('Not authenticated');
    await encryptAndStore(encryptionKey, v);
    setVals(v);
  }, [encryptAndStore, encryptionKey]);

  /* ──────────────────────────────────────────────── */
  /*  Fallback submit handler                         */
  /* ──────────────────────────────────────────────── */

  const submit = useCallback(async (formVals:T) => {
    setLoad(true); setErr(null);
    try {
      let key = encryptionKey;
      if (!key){
        // first‑time user? → register
        const cred = await startRegistration(storageKey);
        key = await deriveAndSetKey(cred.rawId);
        localStorage.setItem('userIdentifier', cred.rawId);
      }
      await encryptAndStore(key!, formVals);
      setVals(formVals);
    } catch(e:any){ setErr(e.message || 'Failed to save'); throw e; }
    finally      { setLoad(false); }
  }, [encryptionKey, deriveAndSetKey, encryptAndStore]);

  const ctxValue: SecureContext<T> = {
    isAuthenticated : !!encryptionKey,
    encryptionKey,
    values,
    login,
    logout,
    setValues,
  };

  /* ──────────────────────────────────────────────── */
  /*  Render                                          */
  /* ──────────────────────────────────────────────── */

  const needFallback = !encryptionKey || values === null;

  return (
    <Ctx.Provider value={ctxValue}>
      {needFallback
        ? fallback({ submit, error: error || undefined, isLoading })
        : children(ctxValue)}
    </Ctx.Provider>
  );
}

/* Hook for consumers */
export const useSecureForm = <T,>() => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSecureForm must be inside SecureFormProvider');
  return c as SecureContext<T>;
}; 