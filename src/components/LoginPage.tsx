import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Fingerprint, AlertCircle, Loader2, X, UserPlus } from 'lucide-react';

export function LoginPage() {
  const { login, register, error: authError, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [savedEmails, setSavedEmails] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Load saved emails from local storage
    const loadSavedEmails = () => {
      const emails = localStorage.getItem("webauthn_emails")
      if (emails) {
        setSavedEmails(JSON.parse(emails))
      }
    }
    loadSavedEmails()
  }, []);

  const saveEmailToLocalStorage = (email: string) => {
    const updatedEmails = [...savedEmails];
    const existingIndex = updatedEmails.indexOf(email);
    if (existingIndex !== -1) {
      updatedEmails.splice(existingIndex, 1);
    }
    updatedEmails.unshift(email);
    const limitedEmails = updatedEmails.slice(0, 5);
    setSavedEmails(limitedEmails);
    localStorage.setItem("webauthn_emails", JSON.stringify(limitedEmails));
  };

  const removeEmailFromLocalStorage = (email: string) => {
    const updatedEmails = savedEmails.filter((e) => e !== email);
    setSavedEmails(updatedEmails);
    localStorage.setItem("webauthn_emails", JSON.stringify(updatedEmails));
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleRegister = async () => {
    if (!email) {
      setError('Email is required');
      return;
    }
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    try {
      await register(email);
      saveEmailToLocalStorage(email);
      setSuccess('Registration successful! You can now log in with your passkey.');
      setEmail('');
    } catch (err) {
      console.error('Registration failed:', err);
    }
  };

  const handleLogin = async (emailToUse?: string) => {
    try {
      await login();
      if (emailToUse) {
        saveEmailToLocalStorage(emailToUse);
      }
      setSuccess('Authentication successful!');
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-center">Welcome to Kitchen Sink</h1>
          <p className="text-center text-gray-600 dark:text-gray-400 mt-2">
            Sign in or register using passkeys
          </p>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registering...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Register New Passkey
                </>
              )}
            </Button>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
              <span className="flex-shrink mx-3 text-gray-500 dark:text-gray-400 text-sm">or</span>
              <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleLogin()}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Fingerprint className="mr-2 h-4 w-4" />
                  Login with Passkey
                </>
              )}
            </Button>

            {savedEmails.length > 0 && (
              <div className="space-y-2 mt-4">
                <h3 className="text-sm font-medium">Previously used accounts</h3>
                <div className="space-y-2">
                  {savedEmails.map((savedEmail) => (
                    <div key={savedEmail} className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded-md">
                      <span className="text-sm truncate max-w-[200px]">{savedEmail}</span>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleLogin(savedEmail)}
                          disabled={isLoading}
                        >
                          <Fingerprint className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEmailFromLocalStorage(savedEmail)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs text-gray-500 dark:text-gray-400 mt-4">
              <p>
                Passkeys allow you to sign in without passwords using biometrics (fingerprint, face recognition) or
                security keys.
              </p>
            </div>
          </div>

          {(error || authError || success) && (
            <div className="mt-4">
              {(error || authError) && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error || authError}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert>
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
} 