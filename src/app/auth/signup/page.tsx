'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, Loader2, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui';
import {
  validateEmail,
  quickSyntaxCheck,
  type EmailValidationResult,
  type EmailSeverity,
} from '@/lib/emailValidation';

export default function SignUpPage() {
  const router = useRouter();
  const { login, loginWithGoogle, isAuthenticated } = useAuth();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);

  // Smart email validation state
  const [emailValidation, setEmailValidation] = useState<EmailValidationResult | null>(null);
  const [isValidatingEmail, setIsValidatingEmail] = useState(false);
  const emailValidationTimer = useRef<NodeJS.Timeout | null>(null);
  const latestEmailRef = useRef(email);

  // Derived email state
  const isEmailValid = emailValidation?.isValid === true && emailValidation.severity !== 'warning';
  const isEmailAcceptable = emailValidation?.isValid === true; // valid, possibly with warning
  const emailHasError = emailTouched && emailValidation?.severity === 'error' && email.length > 0;
  const emailHasWarning = emailValidation?.severity === 'warning' && email.length > 0;
  const emailIsGood = emailTouched && emailValidation?.severity === 'success' && email.length > 0;

  // Password strength indicators
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  // Debounced smart email validation
  useEffect(() => {
    latestEmailRef.current = email;

    // Clear previous timer
    if (emailValidationTimer.current) {
      clearTimeout(emailValidationTimer.current);
    }

    // Empty email — reset
    if (!email.trim()) {
      setEmailValidation(null);
      setIsValidatingEmail(false);
      return;
    }

    // Instant syntax feedback while typing
    const syntaxError = quickSyntaxCheck(email);
    if (syntaxError && emailTouched) {
      setEmailValidation({ isValid: false, severity: 'error', message: syntaxError });
      setIsValidatingEmail(false);
      return;
    }

    // If email looks incomplete, don't run full validation yet
    if (!email.includes('@') || !email.split('@')[1]?.includes('.')) {
      if (emailTouched) {
        setEmailValidation(null);
      }
      return;
    }

    // Debounce the full async validation (400ms after stop typing)
    setIsValidatingEmail(true);
    emailValidationTimer.current = setTimeout(async () => {
      const result = await validateEmail(email);
      // Only update if email hasn't changed during async validation
      if (latestEmailRef.current === email) {
        setEmailValidation(result);
        setIsValidatingEmail(false);
      }
    }, 400);

    return () => {
      if (emailValidationTimer.current) {
        clearTimeout(emailValidationTimer.current);
      }
    };
  }, [email, emailTouched]);

  // Accept a typo suggestion
  const acceptEmailSuggestion = useCallback(() => {
    if (emailValidation?.suggestedEmail) {
      setEmail(emailValidation.suggestedEmail);
    }
  }, [emailValidation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Validate email
    if (!isEmailAcceptable) {
      setError(emailValidation?.message || 'Please enter a valid email address');
      setIsLoading(false);
      return;
    }

    // Validate password
    if (!hasMinLength) {
      setError('Password must be at least 8 characters');
      setIsLoading(false);
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      // Register user
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setIsLoading(false);
        return;
      }

      // Auto sign in after registration using tab auth
      const signInResult = await login(email, password);

      if (!signInResult) {
        // Registration succeeded but sign in failed, redirect to login
        router.push('/auth/login');
      } else {
        router.push('/');
        router.refresh();
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    await loginWithGoogle('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8"
      >
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-block">
            <h1 className="text-4xl font-display font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
              BingeBuddy
            </h1>
          </Link>
          <h2 className="mt-6 text-3xl font-bold text-white">
            Create your account
          </h2>
          <p className="mt-2 text-gray-400">
            Join BingeBuddy to save your watchlist and get personalized recommendations
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400 text-center"
          >
            {error}
          </motion.div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
              Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                placeholder="Your name"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
              Email address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                aria-describedby="email-feedback"
                aria-invalid={emailHasError ? true : undefined}
                className={`w-full pl-10 pr-10 py-3 bg-dark-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                  emailHasError
                    ? 'border-red-500 focus:ring-red-500'
                    : emailHasWarning
                    ? 'border-yellow-500 focus:ring-yellow-500'
                    : emailIsGood
                    ? 'border-green-500 focus:ring-green-500'
                    : 'border-dark-600 focus:ring-primary-500'
                }`}
                placeholder="you@example.com"
              />
              {/* Status icon */}
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {isValidatingEmail ? (
                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                ) : emailIsGood ? (
                  <Check className="w-5 h-5 text-green-400" />
                ) : emailHasWarning ? (
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                ) : emailHasError ? (
                  <span className="text-red-400 text-sm font-bold">✕</span>
                ) : null}
              </span>
            </div>

            {/* Inline feedback messages */}
            <AnimatePresence mode="wait">
              {emailHasError && emailValidation?.message && (
                <motion.p
                  key="email-error"
                  id="email-feedback"
                  role="alert"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="mt-1.5 text-xs text-red-400"
                >
                  {emailValidation.message}
                </motion.p>
              )}

              {emailHasWarning && emailValidation?.message && (
                <motion.div
                  key="email-warning"
                  id="email-feedback"
                  role="status"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="mt-1.5 flex items-center gap-1.5 text-xs text-yellow-400"
                >
                  <span>{emailValidation.message}</span>
                  {emailValidation.suggestedEmail && (
                    <button
                      type="button"
                      onClick={acceptEmailSuggestion}
                      className="underline font-medium hover:text-yellow-300 transition-colors focus:outline-none focus:ring-1 focus:ring-yellow-400 rounded px-0.5"
                    >
                      Fix it
                    </button>
                  )}
                </motion.div>
              )}

              {emailIsGood && (
                <motion.p
                  key="email-success"
                  id="email-feedback"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="mt-1.5 text-xs text-green-400"
                >
                  {emailValidation?.message}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            
            {/* Password Requirements */}
            {password.length > 0 && (
              <div className="mt-2 space-y-1">
                <PasswordRequirement met={hasMinLength} text="At least 8 characters" />
                <PasswordRequirement met={hasUppercase} text="One uppercase letter" />
                <PasswordRequirement met={hasNumber} text="One number" />
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                placeholder="••••••••"
              />
              {confirmPassword && (
                <span className={`absolute right-3 top-1/2 -translate-y-1/2 ${passwordsMatch ? 'text-green-400' : 'text-red-400'}`}>
                  {passwordsMatch ? <Check className="w-5 h-5" /> : '✕'}
                </span>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading || !hasMinLength || !passwordsMatch || !isEmailAcceptable || isValidatingEmail}
            className="w-full py-3 text-lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Creating account...
              </>
            ) : (
              'Create account'
            )}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-dark-600" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-dark-950 text-gray-400">Or continue with</span>
          </div>
        </div>

        {/* Google Sign Up */}
        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full py-3 gap-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </Button>

        {/* Sign In Link */}
        <p className="text-center text-gray-400">
          Already have an account?{' '}
          <Link
            href="/auth/login"
            className="text-primary-400 hover:text-primary-300 font-medium transition-colors"
          >
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-2 text-xs ${met ? 'text-green-400' : 'text-gray-500'}`}>
      {met ? <Check className="w-3 h-3" /> : <span className="w-3 h-3 rounded-full border border-current" />}
      {text}
    </div>
  );
}
