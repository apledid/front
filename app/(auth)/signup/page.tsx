'use client'

import type { ComponentType } from 'react'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import {
  IconLoader2,
  IconMail,
  IconLock,
  IconUser,
  IconCheck,
  IconX,
  IconEye,
  IconEyeOff,
  type IconProps,
} from '@tabler/icons-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { AuthShell } from '@/components/marketing/auth-shell'
import { cn } from '@/lib/utils'

declare global {
  interface Window {
    turnstile: {
      render: (container: string | HTMLElement, options: {
        sitekey: string
        callback: (token: string) => void
        'error-callback'?: () => void
        'expired-callback'?: () => void
        theme?: 'light' | 'dark' | 'auto'
      }) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
    onTurnstileLoad?: () => void
  }
}

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'
type Step = 'details' | 'verify'

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAAC1PANoH5URbVGJe'

const fieldLabel = 'mb-1.5 block text-sm font-medium text-foreground-secondary'

const codeInputClass =
  'h-14 w-full rounded-lg border border-border bg-surface-2 text-center text-2xl tracking-[0.5em] text-foreground outline-none transition-colors placeholder:text-muted-foreground/40 focus-visible:border-[color:var(--accent)]'

const linkBtn =
  'mx-auto flex items-center justify-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground-secondary disabled:cursor-not-allowed disabled:opacity-50'

function IconField({
  icon: Icon,
  className,
  ...props
}: { icon: ComponentType<IconProps> } & React.ComponentProps<'input'>) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" />
      <input
        {...props}
        className={cn(
          'h-11 w-full rounded-lg border border-border bg-surface-2 pl-10 pr-3.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-[color:var(--accent)]',
          className,
        )}
      />
    </div>
  )
}

export default function SignupPage() {
  // Step tracking
  const [step, setStep] = useState<Step>('details')

  // Form fields
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')

  // UI states
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const [usernameMessage, setUsernameMessage] = useState('')

  // Turnstile
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileReady, setTurnstileReady] = useState(false)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  // Resend cooldown - progressive (60s, 120s, 240s, ...)
  const [resendCount, setResendCount] = useState(0)
  const [resendCooldown, setResendCooldown] = useState(0)
  const cooldownIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Terms of Service
  const [tosAccepted, setTosAccepted] = useState(false)

  // Verification step Turnstile
  const verifyTurnstileRef = useRef<HTMLDivElement>(null)
  const verifyWidgetIdRef = useRef<string | null>(null)
  const [verifyTurnstileToken, setVerifyTurnstileToken] = useState('')

  // Prefill the username field when arriving from /halo.rip/<unclaimed>.
  // The Unclaimed-username page links here with ?username=<name> so the
  // user can claim in one tap without retyping. We also prefill from the
  // landing page's "claim" CTA which uses the same query param.
  //
  // Reads window.location.search directly instead of useSearchParams()
  // so the page can stay statically-prerendered. Next.js requires every
  // useSearchParams() to sit under a <Suspense> boundary on prerendered
  // pages or the build fails with `missing-suspense-with-csr-bailout`.
  // Sanitised to the same regex the signup API uses so URL noise can't
  // inject anything weird into form state.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const fromQuery = params.get('username')
    if (!fromQuery) return
    const sanitised = fromQuery.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30)
    if (sanitised) setUsername(sanitised)
    // Only run on mount - the param is a one-shot prefill, we don't want
    // to overwrite what the user has typed if they navigate around.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Surface error redirects (e.g. Discord signup blocked by the per-IP account
  // cap). Read from the query string once on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const err = new URLSearchParams(window.location.search).get('error')
    if (!err) return
    const messages: Record<string, string> = {
      account_limit: "You've reached the maximum number of accounts allowed. Contact support if you need help.",
      discord_signup_failed: 'Discord signup failed. Please try again.',
    }
    toast.error(messages[err] || 'Something went wrong. Please try again.')
  }, [])

  // Initialize Turnstile with explicit callback
  useEffect(() => {
    window.onTurnstileLoad = () => {
      setTurnstileReady(true)
    }

    // Check if already loaded
    if (window.turnstile) {
      setTurnstileReady(true)
    }

    return () => {
      window.onTurnstileLoad = undefined
    }
  }, [])

  // Render Turnstile when ready and ref is available
  useEffect(() => {
    if (turnstileReady && turnstileRef.current && !widgetIdRef.current) {
      try {
        widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => {
            setTurnstileToken(token)
          },
          'error-callback': () => {
            setTurnstileToken('')
            toast.error('Verification failed. Please refresh and try again.')
          },
          'expired-callback': () => {
            setTurnstileToken('')
          },
          theme: 'dark',
        })
      } catch (e) {
        console.error('[signup] Turnstile render error:', e)
      }
    }

    return () => {
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {
          // ignore
        }
        widgetIdRef.current = null
      }
    }
  }, [turnstileReady])

  // Render Turnstile on verification step
  useEffect(() => {
    if (step !== 'verify' || !turnstileReady || !verifyTurnstileRef.current || verifyWidgetIdRef.current) return

    try {
      verifyWidgetIdRef.current = window.turnstile.render(verifyTurnstileRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token: string) => {
          setVerifyTurnstileToken(token)
        },
        'error-callback': () => {
          setVerifyTurnstileToken('')
          toast.error('Verification failed. Please refresh and try again.')
        },
        'expired-callback': () => {
          setVerifyTurnstileToken('')
        },
        theme: 'dark',
      })
    } catch (e) {
      console.error('[signup] Verify Turnstile render error:', e)
    }

    return () => {
      if (verifyWidgetIdRef.current) {
        try {
          window.turnstile.remove(verifyWidgetIdRef.current)
        } catch {
          // ignore
        }
        verifyWidgetIdRef.current = null
      }
    }
  }, [step, turnstileReady])

  // Cleanup cooldown interval
  useEffect(() => {
    return () => {
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current)
      }
    }
  }, [])

  // Start cooldown timer
  function startCooldown(seconds: number) {
    setResendCooldown(seconds)
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current)
    }
    cooldownIntervalRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          if (cooldownIntervalRef.current) {
            clearInterval(cooldownIntervalRef.current)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // Password strength checks
  const hasMinLength = password.length >= 8
  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const passwordsMatch = password === confirmPassword && password.length > 0
  const isStrongPassword = hasMinLength && hasUppercase && hasLowercase && hasNumber
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  // Username validation
  const validateUsername = useCallback((value: string) => {
    if (!value) {
      setUsernameStatus('idle')
      setUsernameMessage('')
      return false
    }
    if (value.length < 3) {
      setUsernameStatus('invalid')
      setUsernameMessage('Must be at least 3 characters')
      return false
    }
    if (value.length > 20) {
      setUsernameStatus('invalid')
      setUsernameMessage('Must be 20 characters or less')
      return false
    }
    if (!/^[a-z0-9_]+$/.test(value.toLowerCase())) {
      setUsernameStatus('invalid')
      setUsernameMessage('Only letters, numbers, and underscores')
      return false
    }
    return true
  }, [])

  // Check username availability
  useEffect(() => {
    if (!validateUsername(username)) return

    const timeoutId = setTimeout(async () => {
      setUsernameStatus('checking')
      setUsernameMessage('Checking availability...')
      try {
        const response = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username.toLowerCase())}`)
        const data = await response.json()
        if (data.available) {
          setUsernameStatus('available')
          setUsernameMessage('Username is available')
        } else {
          setUsernameStatus('taken')
          setUsernameMessage('Username is already taken')
        }
      } catch {
        setUsernameStatus('idle')
        setUsernameMessage('')
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [username, validateUsername])

  // Step 1: Send verification code
  async function handleSendCode(e?: React.FormEvent) {
    e?.preventDefault()

    if (usernameStatus !== 'available') {
      toast.error('Please choose an available username')
      return
    }
    if (!isValidEmail) {
      toast.error('Please enter a valid email')
      return
    }
    if (!isStrongPassword) {
      toast.error('Please use a stronger password')
      return
    }
    if (!passwordsMatch) {
      toast.error('Passwords do not match')
      return
    }
    if (!turnstileToken && !process.env.NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION) {
      toast.error('Please complete the verification checkbox')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/signup/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.toLowerCase(),
          email: email.toLowerCase(),
          password,
          turnstileToken,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // If rate limited, start cooldown with server-provided time
        if (response.status === 429 && data.cooldown) {
          startCooldown(data.cooldown)
          setStep('verify') // Still go to verify if they've sent at least once
        }
        throw new Error(data.error || 'Failed to send verification code')
      }

      // Dev mode: auto-fill code and skip to verify
      if (data.devCode) {
        toast.success('Dev mode: code auto-filled')
        setVerificationCode(data.devCode)
        setStep('verify')
        // Auto-submit after a tick
        setTimeout(async () => {
          try {
            const verifyRes = await fetch('/api/auth/signup/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: email.toLowerCase(),
                code: data.devCode,
                turnstileToken: 'dev-bypass',
              }),
            })
            const verifyData = await verifyRes.json()
            if (verifyRes.ok && verifyData.success) {
              toast.success('Account created!')
              window.location.href = '/onboarding'
              return
            }
            toast.error(verifyData.error || 'Verification failed')
          } catch {
            toast.error('Auto-verify failed')
          }
        }, 500)
        return
      }

      toast.success('Verification code sent to your email!')
      setStep('verify')
      // Start cooldown: 60s first time, doubles each time
      const cooldownTime = 60 * Math.pow(2, resendCount)
      setResendCount(prev => prev + 1)
      startCooldown(cooldownTime)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send code')
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Verify code and create account
  async function handleVerifyAndCreate(e?: React.FormEvent) {
    e?.preventDefault()

    if (verificationCode.length !== 6) {
      toast.error('Please enter the 6-digit code')
      return
    }

    setLoading(true)
    try {
    const response = await fetch('/api/auth/signup/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
  email: email.toLowerCase(),
  code: verificationCode,
  turnstileToken: verifyTurnstileToken,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed')
      }

      toast.success('Account created successfully!')
      window.location.href = '/onboarding'
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  // Resend code with progressive cooldown
  async function handleResendCode() {
    if (resendCooldown > 0) return

    setLoading(true)
    try {
      const response = await fetch('/api/auth/signup/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.toLowerCase(),
          email: email.toLowerCase(),
          password,
          turnstileToken,
          resend: true,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // If rate limited, start cooldown with server-provided time
        if (response.status === 429 && data.cooldown) {
          startCooldown(data.cooldown)
        }
        throw new Error(data.error || 'Failed to resend code')
      }

      toast.success('New verification code sent!')
      // Progressive cooldown: doubles each time
      const cooldownTime = 60 * Math.pow(2, resendCount)
      setResendCount(prev => prev + 1)
      startCooldown(cooldownTime)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resend code')
    } finally {
      setLoading(false)
    }
  }

  function PasswordRequirement({ met, label }: { met: boolean; label: string }) {
    return (
      <div className={cn('flex items-center gap-2 text-xs transition-colors', met ? 'text-primary' : 'text-muted-foreground')}>
        {met ? <IconCheck className="size-3.5" /> : <IconX className="size-3.5" />}
        {label}
      </div>
    )
  }

  return (
    <AuthShell
      title={step === 'details' ? 'Create account' : 'Verify your email'}
      subtitle={
        step === 'details'
          ? 'Join and create your profile'
          : `Enter the code sent to ${email}`
      }
      footer={
        step === 'details' ? (
          <>
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </>
        ) : undefined
      }
    >
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad"
        strategy="afterInteractive"
      />

      {step === 'details' ? (
        <form onSubmit={handleSendCode} className="space-y-4">
          {/* Username field */}
          <div>
            <label className={fieldLabel}>Username</label>
            <div className="relative">
              <IconUser className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="your_username"
                className={cn(
                  'h-11 w-full rounded-lg border border-border bg-surface-2 pl-10 pr-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-[color:var(--accent)]',
                  usernameStatus === 'available' && 'border-primary/60',
                  (usernameStatus === 'taken' || usernameStatus === 'invalid') && 'border-destructive/60',
                )}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {usernameStatus === 'checking' && <IconLoader2 className="size-4 animate-spin text-muted-foreground" />}
                {usernameStatus === 'available' && <IconCheck className="size-4 text-primary" />}
                {usernameStatus === 'taken' && <IconX className="size-4 text-destructive" />}
                {usernameStatus === 'invalid' && <IconX className="size-4 text-destructive" />}
              </div>
            </div>
            {usernameMessage && (
              <p className={cn('mt-1.5 text-xs', usernameStatus === 'available' ? 'text-primary' : usernameStatus === 'checking' ? 'text-muted-foreground' : 'text-destructive')}>
                {usernameMessage}
              </p>
            )}
          </div>

          {/* Email field */}
          <div>
            <label className={fieldLabel}>Email</label>
            <IconField
              icon={IconMail}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className={cn(
                email && (isValidEmail ? 'border-primary/60' : 'border-destructive/60'),
              )}
            />
          </div>

          {/* Password field */}
          <div>
            <label className={fieldLabel}>Password</label>
            <div className="relative">
              <IconLock className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                autoComplete="new-password"
                className="h-11 w-full rounded-lg border border-border bg-surface-2 pl-10 pr-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-[color:var(--accent)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground-secondary"
              >
                {showPassword ? <IconEyeOff className="size-[18px]" /> : <IconEye className="size-[18px]" />}
              </button>
            </div>
            {password && (
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <PasswordRequirement met={hasMinLength} label="8+ characters" />
                <PasswordRequirement met={hasUppercase} label="Uppercase letter" />
                <PasswordRequirement met={hasLowercase} label="Lowercase letter" />
                <PasswordRequirement met={hasNumber} label="Number" />
              </div>
            )}
          </div>

          {/* Confirm password field */}
          <div>
            <label className={fieldLabel}>Confirm password</label>
            <div className="relative">
              <IconLock className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                autoComplete="new-password"
                className={cn(
                  'h-11 w-full rounded-lg border border-border bg-surface-2 pl-10 pr-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-[color:var(--accent)]',
                  confirmPassword && (passwordsMatch ? 'border-primary/60' : 'border-destructive/60'),
                )}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground-secondary"
              >
                {showConfirmPassword ? <IconEyeOff className="size-[18px]" /> : <IconEye className="size-[18px]" />}
              </button>
            </div>
            {confirmPassword && !passwordsMatch && (
              <p className="mt-1.5 text-xs text-destructive">Passwords do not match</p>
            )}
          </div>

          {/* Terms of Service checkbox */}
          <label htmlFor="tos" className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              id="tos"
              checked={tosAccepted}
              onChange={(e) => setTosAccepted(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[#e87fa0]"
            />
            <span className="text-sm text-muted-foreground">
              I agree to the{' '}
              <Link href="/tos" target="_blank" className="text-primary hover:underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" target="_blank" className="text-primary hover:underline">
                Privacy Policy
              </Link>
            </span>
          </label>

          {/* Cloudflare Turnstile */}
          {!process.env.NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION && (
            <div className="flex justify-center">
              <div ref={turnstileRef} />
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || usernameStatus !== 'available' || !isStrongPassword || !passwordsMatch || (!turnstileToken && !process.env.NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION) || !isValidEmail || !tosAccepted}
            className="w-full"
          >
            {loading ? (
              <>
                <IconLoader2 className="animate-spin" /> Creating…
              </>
            ) : (
              'Continue'
            )}
          </Button>

          {/* Discord divider */}
          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <a
            href="/api/auth/discord?action=signup"
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-[#5865F2] text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <svg width="20" height="20" viewBox="0 0 71 55" fill="white" xmlns="http://www.w3.org/2000/svg">
              <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.44077 45.4204 0.52529C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.52529C25.5141 0.44359 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.2998 23.0133 30.1579 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.8917 23.0133 53.7498 26.2532 53.6986 30.1693C53.6986 34.1136 50.8917 37.3253 47.3178 37.3253Z"/>
            </svg>
            Continue with Discord
          </a>
        </form>
      ) : (
        <form onSubmit={handleVerifyAndCreate} className="space-y-4">
          {/* Verification code input */}
          <div>
            <label className={fieldLabel}>Verification code</label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className={codeInputClass}
              maxLength={6}
              autoFocus
            />
          </div>

          {/* Cloudflare Turnstile for verification step */}
          {!process.env.NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION && (
            <div className="flex justify-center">
              <div ref={verifyTurnstileRef} />
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || verificationCode.length !== 6 || (!verifyTurnstileToken && !process.env.NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION)}
            className="w-full"
          >
            {loading ? (
              <>
                <IconLoader2 className="animate-spin" /> Creating account…
              </>
            ) : (
              'Create account'
            )}
          </Button>

          <div className="flex flex-col items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleResendCode}
              disabled={loading || resendCooldown > 0}
              className={linkBtn}
            >
              {resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : "Didn't receive the code? Resend"}
            </button>
            <button
              type="button"
              onClick={() => setStep('details')}
              className={linkBtn}
            >
              Change email address
            </button>
          </div>
        </form>
      )}
    </AuthShell>
  )
}
