// src/contexts/AuthContext.tsx
import React, { createContext, useState, useContext, useCallback, ReactNode, useEffect } from 'react';
// Ensure these imports point to your consolidated webauthn utilities
import {
  startRegistration,
  startAuthentication,
  WebAuthnError,
  deriveKey,
  base64URLStringToBuffer // Needed if you use rawId directly for key derivation
} from '.'; // Adjust the import path as needed
import { LoginPage } from '../components/LoginPage';

interface AuthContextType {
  /** Indicates if the user is currently authenticated */
  isAuthenticated: boolean;
  /** The derived cryptographic key for encryption/decryption, null if not authenticated */
  encryptionKey: CryptoKey | null;
  /** A unique identifier derived from the user's passkey, null if not authenticated */
  userIdentifier: string | null;
  /** Any error message related to authentication */
  error: string | null;
  /** Indicates if an authentication operation (login/register) is in progress */
  isLoading: boolean;
  /** Function to initiate the login process */
  login: () => Promise<CryptoKey>;
  /** Function to log the user out */
  logout: () => void;
  /** Function to initiate the registration process */
  register: (email: string) => Promise<void>;
}

// Create the context with an undefined initial value to enforce provider usage
const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode | ((context: AuthContextType) => ReactNode);
  fallback?: (login: () => Promise<CryptoKey>) => ReactNode 
}

/**
 * Provides authentication state and functions to its children.
 * Manages user login, logout, registration, and the derived encryption key.
 */
export const AuthProvider = ({ children, fallback }: AuthProviderProps) => {
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [userIdentifier, setUserIdentifier] = useState<string | null>(() => localStorage.getItem('userIdentifier'));
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Effect for Auto-Login
  useEffect(() => {
    if (userIdentifier && !encryptionKey && !isLoading) {
      console.log("[Auth] Found user identifier, attempting auto-login...");
      setIsLoading(true);
      login().catch((err) => {
        console.error("[Auth] Auto-login failed:", err);
      }).finally(() => {
        if (!encryptionKey) {
          setIsLoading(false);
        }
      });
    } else if (!userIdentifier) {
      setEncryptionKey(null);
    }
  }, [userIdentifier]);

  const login = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    console.log("[Auth] Initiating login...");
    try {
      const assertion = await startAuthentication();
      console.log('[Auth] Authentication assertion received:', assertion);

      const keyBasisBuffer = base64URLStringToBuffer(assertion.rawId);
      const key = await deriveKey(keyBasisBuffer);
      console.log('[Auth] Encryption key derived.');

      const identifier = assertion.rawId;

      setEncryptionKey(key);
      setUserIdentifier(identifier);
      localStorage.setItem('userIdentifier', identifier);
      setError(null);
      console.log('[Auth] Login successful. Identifier:', identifier);
      return key
    } catch (err) {
      console.error("[Auth] Login failed:", err);
      const errorMessage = err instanceof WebAuthnError ? err.message : 'Authentication failed. Please try again.';
      setError(errorMessage);
      setEncryptionKey(null);
      throw err;
    } finally {
      setIsLoading(false);
      console.log("[Auth] Login process finished.");
    }
  }, []);

  const register = useCallback(async (email: string) => {
    setError(null);
    setIsLoading(true);
    console.log("[Auth] Initiating registration for:", email);
    try {
      if (encryptionKey) {
        console.warn("[Auth] User already authenticated. Logout first to register again.");
        setError("Already logged in. Please logout first.");
        return;
      }

      const credential = await startRegistration(email);
      console.log('[Auth] Registration credential created:', credential);
      await login();

    } catch (err) {
      console.error("[Auth] Registration failed:", err);
      const errorMessage = err instanceof WebAuthnError ? err.message : 'Registration failed. Please try again.';
      setError(errorMessage);
      setEncryptionKey(null);
      setUserIdentifier(null);
      localStorage.removeItem('userIdentifier');
    } finally {
      setIsLoading(false);
      console.log("[Auth] Registration process finished.");
    }
  }, [login, encryptionKey]);

  const logout = useCallback(() => {
    console.log("[Auth] Logging out...");
    setEncryptionKey(null);
    setUserIdentifier(null);
    localStorage.removeItem('userIdentifier');
    setError(null);
    setIsLoading(false);
    console.log("[Auth] User logged out.");
  }, []);

  const contextValue: AuthContextType = {
    isAuthenticated: encryptionKey !== null,
    encryptionKey,
    userIdentifier,
    error,
    isLoading,
    login,
    logout,
    register
  };
  if (!fallback) {
    fallback = () => <LoginPage />
  }
  // Render children with context
  return (
    <AuthContext.Provider value={contextValue}>
      {!encryptionKey ? fallback(login)
        : typeof children === 'function' ? children(contextValue) 
        : children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to easily consume authentication context.
 * Throws an error if used outside of an AuthProvider.
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};