'use client'

import type { ComponentType } from 'react'
import { Suspense, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { useSearchParams } from 'next/navigation'
import {
  IconLoader2,
  IconMail,
  IconLock,
  IconArrowLeft,
  type IconProps,
} from '@tabler/icons-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AuthShell } from '@/components/marketing/auth-shell'

const DISCORD_ERROR_MESSAGES: Record<string, string> = {
  discord_not_configured: 'Discord login is not set up yet.',
  discord_cancelled: 'Discord login was cancelled.',
  discord_state_mismatch: 'Discord login failed (invalid state). Please try again.',
  discord_token_failed: 'Failed to connect to Discord. Please try again.',
  discord_user_failed: 'Failed to fetch your Discord profile. Please try again.',
  discord_not_linked: 'No account is linked to that Discord. Connect Discord in Settings first.',
  discord_banned: 'Your account is banned.',
}

declare global {
  interface Window {
    turnstile: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          'error-callback'?: () => void
          'expired-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
        },
      ) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
    onTurnstileLoad?: () => void
  }
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAAC1PANoH5URbVGJe'

type Step = 'credentials' | 'verify' | 'forgot' | 'forgot-code' | 'new-password'

const fieldLabel = 'mb-1.5 block text-sm font-medium text-foreground-secondary'

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

const codeInputClass =
  'h-14 w-full rounded-lg border border-border bg-surface-2 text-center text-2xl tracking-[0.5em] text-foreground outline-none transition-colors placeholder:text-muted-foreground/40 focus-visible:border-[color:var(--accent)]'

const linkBtn =
  'mx-auto flex items-center justify-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground-secondary disabled:cursor-not-allowed disabled:opacity-50'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  )
}

function LoginPageContent() {
  const searchParams = useSearchParams()
  const [step, setStep] = useState<Step>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const err = searchParams.get('error')
    if (err && DISCORD_ERROR_MESSAGES[err]) {
      setError(DISCORD_ERROR_MESSAGES[err])
    }
  }, [searchParams])
  const [verificationCode, setVerificationCode] = useState('')
  const [userId, setUserId] = useState('')
  const [maskedEmail, setMaskedEmail] = useState('')
  const [resendToken, setResendToken] = useState('')

  const [rememberDevice, setRememberDevice] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const cooldownRef = useRef<NodeJS.Timeout | null>(null)

  const [forgotEmail, setForgotEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [forgotCode, setForgotCode] = useState('')
  const [forgotMessage, setForgotMessage] = useState('')

  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileReady, setTurnstileReady] = useState(false)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    window.onTurnstileLoad = () => setTurnstileReady(true)
    if (window.turnstile) setTurnstileReady(true)
    return () => {
      window.onTurnstileLoad = undefined
    }
  }, [])

  useEffect(() => {
    if (turnstileReady && turnstileRef.current && !widgetIdRef.current) {
      try {
        widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => setTurnstileToken(token),
          'error-callback': () => setTurnstileToken(''),
          'expired-callback': () => setTurnstileToken(''),
          theme: 'dark',
        })
      } catch (e) {
        console.error('Turnstile render error:', e)
      }
    }
    return () => {
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {}
        widgetIdRef.current = null
      }
    }
  }, [turnstileReady])

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current)
    }
  }, [])

  function startCooldown(seconds: number) {
    setResendCooldown(seconds)
    if (cooldownRef.current) clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  function resetTurnstile() {
    if (widgetIdRef.current) {
      try {
        window.turnstile.reset(widgetIdRef.current)
      } catch {}
      setTurnstileToken('')
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!turnstileToken && !process.env.NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION) {
      setError('Please complete the verification')
      return
    }
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, turnstileToken }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Login failed')
        resetTurnstile()
        setLoading(false)
        return
      }

      if (data.requiresVerification) {
        setUserId(data.userId)
        setMaskedEmail(data.maskedEmail)
        setResendToken(data.resendToken || '')
        setStep('verify')
        startCooldown(60)
      } else {
        window.location.href = '/dashboard'
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyLogin(e: React.FormEvent) {
    e.preventDefault()
    if (verificationCode.length !== 6) {
      setError('Please enter the 6-digit code')
      return
    }
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, code: verificationCode, rememberDevice }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Verification failed')
        setLoading(false)
        return
      }

      window.location.href = '/dashboard'
    } catch {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  async function handleResendCode() {
    if (resendCooldown > 0 || loading) return
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, resendToken }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to resend code')
        setLoading(false)
        return
      }

      startCooldown(60)
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotSend(e: React.FormEvent) {
    e.preventDefault()
    if (!forgotEmail) {
      setError('Please enter your email')
      return
    }
    setLoading(true)
    setError('')
    setForgotMessage('')

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to send reset code')
        setLoading(false)
        return
      }

      setForgotMessage('If an account exists with that email, a code has been sent.')
      setStep('forgot-code')
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotVerify(e: React.FormEvent) {
    e.preventDefault()
    if (forgotCode.length !== 6) {
      setError('Please enter the 6-digit code')
      return
    }
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/forgot-password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, code: forgotCode }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Invalid code')
        setLoading(false)
        return
      }

      setStep('new-password')
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, code: forgotCode, newPassword }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to reset password')
        setLoading(false)
        return
      }

      setStep('credentials')
      setError('')
      setForgotMessage('Password reset successfully! Please sign in.')
      setPassword('')
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const titles: Record<Step, string> = {
    credentials: 'Welcome back',
    verify: 'Verify your identity',
    forgot: 'Reset password',
    'forgot-code': 'Check your email',
    'new-password': 'New password',
  }
  const subtitles: Record<Step, string> = {
    credentials: 'Sign in to your account to continue',
    verify: `Enter the code sent to ${maskedEmail}`,
    forgot: 'Enter your email to receive a reset code',
    'forgot-code': 'Enter the 6-digit code we sent you',
    'new-password': 'Choose a new password for your account',
  }

  return (
    <AuthShell
      title={titles[step]}
      subtitle={subtitles[step]}
      footer={
        step === 'credentials' ? (
          <>
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </>
        ) : undefined
      }
    >
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad"
        strategy="afterInteractive"
      />

      {forgotMessage && step === 'credentials' ? (
        <p className="mb-4 rounded-lg border border-primary/20 bg-accent-soft px-3.5 py-2.5 text-center text-sm text-primary">
          {forgotMessage}
        </p>
      ) : null}

      {error ? (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-center text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {step === 'credentials' && (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className={fieldLabel}>Email</label>
            <IconField
              icon={IconMail}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className={fieldLabel}>Password</label>
            <IconField
              icon={IconLock}
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {!process.env.NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION && (
            <div className="flex justify-center">
              <div ref={turnstileRef} />
            </div>
          )}

          <Button
            type="submit"
            disabled={
              loading ||
              (!turnstileToken && !process.env.NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION)
            }
            className="w-full"
          >
            {loading ? (
              <>
                <IconLoader2 className="animate-spin" /> Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </Button>

          <button
            type="button"
            onClick={() => {
              setStep('forgot')
              setError('')
              setForgotMessage('')
            }}
            className={cn(linkBtn, 'w-full')}
          >
            Forgot your password?
          </button>

          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <a
            href="/api/auth/discord?action=login"
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-[#5865F2] text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <svg width="20" height="20" viewBox="0 0 71 55" fill="white" xmlns="http://www.w3.org/2000/svg">
              <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.44077 45.4204 0.52529C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.52529C25.5141 0.44359 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.2998 23.0133 30.1579 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.8917 23.0133 53.7498 26.2532 53.6986 30.1693C53.6986 34.1136 50.8917 37.3253 47.3178 37.3253Z" />
            </svg>
            Continue with Discord
          </a>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={handleVerifyLogin} className="space-y-4">
          <div>
            <label className={fieldLabel}>Verification code</label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) =>
                setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              placeholder="000000"
              className={codeInputClass}
              maxLength={6}
              autoFocus
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface-2 p-3.5">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              className="size-4 cursor-pointer accent-[#e87fa0]"
            />
            <span>
              <span className="block text-sm font-medium text-foreground">
                Remember this device for 14 days
              </span>
              <span className="block text-xs text-muted-foreground">
                Skip the verification code on this browser
              </span>
            </span>
          </label>

          <Button type="submit" disabled={loading || verificationCode.length !== 6} className="w-full">
            {loading ? (
              <>
                <IconLoader2 className="animate-spin" /> Verifying…
              </>
            ) : (
              'Verify & sign in'
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
              onClick={() => {
                setStep('credentials')
                setError('')
                setVerificationCode('')
              }}
              className={linkBtn}
            >
              <IconArrowLeft className="size-4" /> Back to login
            </button>
          </div>
        </form>
      )}

      {step === 'forgot' && (
        <form onSubmit={handleForgotSend} className="space-y-4">
          <div>
            <label className={fieldLabel}>Email</label>
            <IconField
              icon={IconMail}
              type="email"
              placeholder="you@example.com"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <Button type="submit" disabled={loading || !forgotEmail} className="w-full">
            {loading ? (
              <>
                <IconLoader2 className="animate-spin" /> Sending…
              </>
            ) : (
              'Send reset code'
            )}
          </Button>

          <button
            type="button"
            onClick={() => {
              setStep('credentials')
              setError('')
              setForgotMessage('')
            }}
            className={cn(linkBtn, 'w-full')}
          >
            <IconArrowLeft className="size-4" /> Back to login
          </button>
        </form>
      )}

      {step === 'forgot-code' && (
        <form onSubmit={handleForgotVerify} className="space-y-4">
          <div>
            <label className={fieldLabel}>Verification code</label>
            <input
              type="text"
              value={forgotCode}
              onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className={codeInputClass}
              maxLength={6}
              autoFocus
            />
          </div>

          <Button type="submit" disabled={loading || forgotCode.length !== 6} className="w-full">
            {loading ? (
              <>
                <IconLoader2 className="animate-spin" /> Verifying…
              </>
            ) : (
              'Verify code'
            )}
          </Button>

          <button
            type="button"
            onClick={() => {
              setStep('forgot')
              setError('')
            }}
            className={cn(linkBtn, 'w-full')}
          >
            <IconArrowLeft className="size-4" /> Use a different email
          </button>
        </form>
      )}

      {step === 'new-password' && (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className={fieldLabel}>New password</label>
            <IconField
              icon={IconLock}
              type="password"
              placeholder="New password (min. 8 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className={fieldLabel}>Confirm new password</label>
            <IconField
              icon={IconLock}
              type="password"
              placeholder="Repeat your new password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              required
            />
          </div>

          <Button
            type="submit"
            disabled={loading || newPassword.length < 8 || newPassword !== confirmNewPassword}
            className="w-full"
          >
            {loading ? (
              <>
                <IconLoader2 className="animate-spin" /> Resetting…
              </>
            ) : (
              'Reset password'
            )}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
