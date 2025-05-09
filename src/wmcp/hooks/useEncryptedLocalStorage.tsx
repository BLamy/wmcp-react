import { useState, useEffect } from 'react';
import { useWebauthn } from '../providers/WebauthnProvider';
import { encryptData, decryptData } from '@/webauthn';

// Cache for storing promises and resolved values
const cache = new Map<string, {
  promise: Promise<any> | null;
  value: any;
  timestamp: number;
}>();

/**
 * Hook to use encrypted localStorage with Suspense support
 * @param key The storage key to use
 * @param initialValue The initial value (used if no value exists in storage)
 */
export function useEncryptedLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => Promise<void>] {
  const { encryptionKey, isAuthenticated } = useWebauthn<any>();
  const storageKey = `encrypted.${key}`;
  
  // Function to load the value from localStorage
  const loadValue = async (): Promise<T> => {
    if (!encryptionKey) return initialValue;
    
    const item = localStorage.getItem(storageKey);
    if (item) {
      try {
        const decrypted = await decryptData(encryptionKey, item);
        return JSON.parse(decrypted);
      } catch (error) {
        console.error(`Failed to decrypt ${key}:`, error);
        // Return initial value on decryption failure
        return initialValue;
      }
    }
    return initialValue;
  };
  
  // Check if we have a cached value or need to create one
  if (!cache.has(storageKey) && encryptionKey) {
    // Create a cache entry with a promise
    const promise = loadValue();
    cache.set(storageKey, {
      promise,
      value: null,
      timestamp: Date.now()
    });
    
    // When promise resolves, update the cache
    promise.then(value => {
      cache.set(storageKey, {
        promise: null,
        value,
        timestamp: Date.now()
      });
    });
  }
  
  // Get the current cache entry
  const entry = cache.get(storageKey);
  
  // If we have a promise and no value, throw the promise to trigger Suspense
  if (entry?.promise && !entry.value) {
    throw entry.promise;
  }
  
  // Use the cached value or initial value
  const currentValue = entry?.value ?? initialValue;
  
  // Function to update the value in state and localStorage
  const setValue = async (valueOrFn: T | ((prev: T) => T)) => {
    if (!encryptionKey) {
      throw new Error('Cannot save encrypted data - not authenticated');
    }
    
    // Calculate the new value
    const prevValue = entry?.value ?? initialValue;
    const newValue = valueOrFn instanceof Function 
      ? valueOrFn(prevValue) 
      : valueOrFn;
    
    // Update cache immediately for optimistic UI
    cache.set(storageKey, {
      promise: null,
      value: newValue,
      timestamp: Date.now()
    });
    
    // Encrypt and save to localStorage
    try {
      const encrypted = await encryptData(encryptionKey, JSON.stringify(newValue));
      localStorage.setItem(storageKey, encrypted);
    } catch (error) {
      // Revert cache on error
      cache.set(storageKey, {
        promise: null,
        value: prevValue,
        timestamp: Date.now()
      });
      console.error(`Error saving encrypted value for ${key}:`, error);
      throw error;
    }
  };
  
  return [currentValue, setValue];
}

export default useEncryptedLocalStorage; 