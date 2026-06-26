'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { IconLoader2, IconMail, IconAlertTriangle } from '@tabler/icons-react'
import { toast } from 'sonner'

interface EmailVerificationModalProps {
  open: boolean
  deadline: string | null
  email: string | null
  emailVerified: boolean
  onVerified: () => void
}

export function EmailVerificationModal({ 
  open, 
  deadline, 
  email: existingEmail, 
  emailVerified,
  onVerified 
}: EmailVerificationModalProps) {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState(existingEmail || '')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState<string>('')
  
  // Progressive resend cooldown
  const [resendCount, setResendCount] = useState(0)
  const [resendCooldown, setResendCooldown] = useState(0)
  const cooldownIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Calculate time remaining until deletion
  useEffect(() => {
    if (!deadline) return

    const updateTimer = () => {
      const now = new Date().getTime()
      const deadlineTime = new Date(deadline).getTime()
      const diff = deadlineTime - now

      if (diff <= 0) {
        setTimeLeft('EXPIRED')
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      setTimeLeft(`${hours}h ${minutes}m`)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 60000)
    return () => clearInterval(interval)
  }, [deadline])

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

  async function handleSendCode() {
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/add-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to send code')

      toast.success('Verification code sent!')
      setStep('code')
      
      // Progressive cooldown: 60s first time, doubles each time
      const cooldownTime = 60 * Math.pow(2, resendCount)
      setResendCount(prev => prev + 1)
      startCooldown(cooldownTime)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to send code'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleResendCode() {
    if (resendCooldown > 0) return

    setLoading(true)
    try {
      const res = await fetch('/api/auth/add-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to resend code')

      toast.success('New verification code sent!')
      
      // Progressive cooldown: doubles each time
      const cooldownTime = 60 * Math.pow(2, resendCount)
      setResendCount(prev => prev + 1)
      startCooldown(cooldownTime)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to resend code'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyCode() {
    if (!code || code.length < 6) {
      toast.error('Please enter the 6-digit code')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Verification failed')

      toast.success('Email verified successfully!')
      onVerified()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Verification failed'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  // Handle email change - reset cooldown count but keep current cooldown timer running
  function handleEmailChange(newEmail: string) {
    setEmail(newEmail)
    // Don't reset resendCount - they should still wait even if they change email
  }

  // Don't show if email is already verified
  if (emailVerified) return null

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="border-border bg-surface sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <IconAlertTriangle className="size-6 text-destructive" />
          </div>
          <DialogTitle className="text-center text-xl text-foreground">
            Add Your Email Now
          </DialogTitle>
          <DialogDescription className="text-center text-foreground-secondary">
            Your account will be <span className="font-semibold text-destructive">deleted</span> if you don&apos;t verify your email
            {timeLeft && timeLeft !== 'EXPIRED' && (
              <span className="mt-1 block text-lg font-bold text-destructive">
                Time remaining: {timeLeft}
              </span>
            )}
            {timeLeft === 'EXPIRED' && (
              <span className="mt-1 block text-lg font-bold text-destructive">
                DEADLINE EXPIRED - Verify now to save your account!
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {step === 'email' ? (
            <>
              <div className="space-y-2">
                <label className="text-sm text-foreground-secondary">Email Address</label>
                <div className="relative">
                  <IconMail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    className="border-border bg-surface-2 pl-10 text-foreground placeholder:text-muted-foreground"
                    onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
                  />
                </div>
              </div>
              <Button
                onClick={handleSendCode}
                disabled={loading || !email}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {loading ? <IconLoader2 className="size-4 animate-spin" /> : 'Send Verification Code'}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm text-foreground-secondary">
                  Enter the 6-digit code sent to <span className="text-primary">{email}</span>
                </label>
                <Input
                  type="text"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="border-border bg-surface-2 text-center text-2xl tracking-widest text-foreground placeholder:text-muted-foreground"
                  maxLength={6}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('email')}
                  disabled={loading}
                  className="flex-1 border-border bg-surface-2 text-foreground hover:bg-surface-3"
                >
                  Back
                </Button>
                <Button
                  onClick={handleVerifyCode}
                  disabled={loading || code.length < 6}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {loading ? <IconLoader2 className="size-4 animate-spin" /> : 'Verify'}
                </Button>
              </div>
              <button
                onClick={handleResendCode}
                disabled={loading || resendCooldown > 0}
                className={`w-full text-sm ${
                  resendCooldown > 0
                    ? 'cursor-not-allowed text-muted-foreground'
                    : 'text-foreground-secondary hover:text-foreground'
                }`}
              >
                {resendCooldown > 0 
                  ? `Resend code in ${resendCooldown}s` 
                  : "Didn't receive the code? Click to resend"}
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
