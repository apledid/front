"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { IconAlertTriangle, IconCopy, IconCheck, IconLogout, IconShield, IconLoader2, IconLink, IconTrash, IconMessageCircle, IconMail, IconKey, IconArrowRight } from "@tabler/icons-react"
import { toast } from "sonner"
import { UnsavedChangesBar } from "@/components/dashboard/unsaved-changes-bar"
import type { Profile } from "@/lib/types"

type PrivacySettings = {
  isPublic: boolean
  showViewCount: boolean
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsPageContent />
    </Suspense>
  )
}

function SettingsPageContent() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState<string>("")
  const [discordId, setDiscordId] = useState<string | null>(null)
  const [discordDisconnecting, setDiscordDisconnecting] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Show toast if Discord was just connected/disconnected via OAuth
  useEffect(() => {
    const discord = searchParams.get('discord')
    if (discord === 'connected') {
      toast.success('Discord connected successfully!')
      // Reload to get updated discord_id
      router.replace('/dashboard/settings')
    } else if (discord === 'already_linked') {
      toast.error('That Discord account is already linked to another user.')
      router.replace('/dashboard/settings')
    }
  }, [searchParams, router])

  const initialSettings = useRef<PrivacySettings>({
    isPublic: true,
    showViewCount: true,
  })
  const [settings, setSettings] = useState<PrivacySettings>({
    isPublic: true,
    showViewCount: true,
  })

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(initialSettings.current)

  useEffect(() => {
    async function fetchData() {
      const res = await fetch("/api/auth/me")
      const { user, profile: profileData } = await res.json()
      if (!user) {
        router.push("/login")
        return
      }

      setUsername(user.username || "")
      setEmail((profileData?.email as string) || (user as any).email || "")

      if (profileData) {
        setProfile(profileData)
        setDiscordId((profileData as any).discord_id ?? null)
        const newSettings = {
          isPublic: profileData.is_public !== false,
          showViewCount: profileData.show_view_count !== false,
        }
        setSettings(newSettings)
        initialSettings.current = newSettings
      }

      setLoading(false)
    }
    fetchData()
  }, [router])

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_public: settings.isPublic,
          show_view_count: settings.showViewCount,
        }),
      })
      if (!res.ok) throw new Error("Failed to save settings")
      initialSettings.current = { ...settings }
      toast.success("Settings saved")
    } catch (error) {
      toast.error("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  const handleResetSettings = () => {
    setSettings(initialSettings.current)
  }

  const handleSettingChange = (field: keyof PrivacySettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  const handleCopyLink = () => {
    if (profile?.username) {
      navigator.clipboard.writeText(`${window.location.origin}/${profile.username}`)
      setCopied(true)
      toast.success("Link copied!")
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/")
  }

  const handleDiscordDisconnect = async () => {
    setDiscordDisconnecting(true)
    try {
      const res = await fetch("/api/auth/discord/disconnect", { method: "POST" })
      if (res.ok) {
        setDiscordId(null)
        toast.success("Discord disconnected")
      } else {
        toast.error("Failed to disconnect Discord")
      }
    } catch {
      toast.error("Failed to disconnect Discord")
    } finally {
      setDiscordDisconnecting(false)
    }
  }

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")
  const [deleteLoading, setDeleteLoading] = useState(false)

  const handleDeleteAccount = () => {
    setDeletePassword("")
    setShowDeleteModal(true)
  }

  const confirmDeleteAccount = async () => {
    if (!deletePassword) {
      toast.error("Please enter your password")
      return
    }
    setDeleteLoading(true)
    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push("/")
      } else {
        toast.error(data.error || "Failed to delete account")
      }
    } catch {
      toast.error("Failed to delete account")
    } finally {
      setDeleteLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <IconLoader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account and preferences</p>
      </div>

      {/* Profile Link */}
      <Card className="border-border bg-surface backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft">
              <IconLink className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg text-foreground">Your Profile Link</CardTitle>
              <CardDescription className="text-muted-foreground">Share this link with others</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              readOnly
              value={profile?.username ? `${typeof window !== "undefined" ? window.location.origin : ""}/${profile.username}` : ""}
              className="h-12 font-mono text-sm"
            />
            <Button 
              onClick={handleCopyLink} 
              className="h-12 w-12 rounded-xl"
            >
              {copied ? <IconCheck className="size-4" /> : <IconCopy className="size-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card className="border-border bg-surface backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft">
              <IconShield className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg text-foreground">Account</CardTitle>
              <CardDescription className="text-muted-foreground">Your account information</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Username</label>
            <Input
              readOnly
              value={username}
              className="h-12 font-mono"
            />
          </div>
        </CardContent>
      </Card>

      {/* Email change */}
      <EmailChangeCard currentEmail={email} onChanged={(next) => setEmail(next)} />

      {/* Password change */}
      <PasswordChangeCard />

      {/* Discord */}
      <Card className="border-border bg-surface backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(88,101,242,0.2)' }}>
              <IconMessageCircle className="h-5 w-5" style={{ color: '#5865F2' }} />
            </div>
            <div>
              <CardTitle className="text-lg text-foreground">Discord</CardTitle>
              <CardDescription className="text-muted-foreground">
                Connect Discord to log in without a verification code
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {discordId ? (
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2 p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Discord Connected</p>
                <p className="font-mono text-xs text-muted-foreground/70">ID: {discordId}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDiscordDisconnect}
                disabled={discordDisconnecting}
              >
                {discordDisconnecting ? <IconLoader2 className="size-4 animate-spin" /> : 'Disconnect'}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2 p-4">
              <div>
                <p className="text-sm font-medium text-foreground">No Discord Connected</p>
                <p className="text-xs text-muted-foreground/70">Link your Discord to enable code-free login</p>
              </div>
              <a href="/api/auth/discord?action=connect">
                <Button
                  size="sm"
                  style={{ background: '#5865F2', color: '#fff' }}
                  className="hover:opacity-90"
                >
                  Connect Discord
                </Button>
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-500/20 bg-red-500/5 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20">
              <IconAlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <CardTitle className="text-lg text-red-400">Danger Zone</CardTitle>
              <CardDescription className="text-muted-foreground">Irreversible account actions</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Log Out</p>
              <p className="text-xs text-muted-foreground/70">Sign out of your account</p>
            </div>
            <Button 
              variant="outline" 
              onClick={handleLogout}
            >
              <IconLogout className="mr-2 size-4" />
              Log Out
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <div>
              <p className="text-sm font-medium text-red-400">Delete Account</p>
              <p className="text-xs text-muted-foreground/70">Permanently delete your account and all data</p>
            </div>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              className="bg-red-600 hover:bg-red-700"
            >
              <IconTrash className="mr-2 size-4" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-destructive/30 bg-surface p-6 shadow-2xl">
            <h3 className="mb-1 text-lg font-bold text-foreground">Delete your account?</h3>
            <p className="mb-5 text-sm text-muted-foreground">
              This permanently deletes your profile, links, and all data. This cannot be undone.
            </p>
            <p className="mb-2 text-xs font-medium text-foreground-secondary">Enter your password to confirm</p>
            <Input
              type="password"
              placeholder="Your password"
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && confirmDeleteAccount()}
              className="mb-4 "
              autoFocus
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1"
                disabled={deleteLoading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteAccount}
                className="flex-1 bg-red-600 hover:bg-red-700"
                disabled={deleteLoading || !deletePassword}
              >
                {deleteLoading ? <IconLoader2 className="mr-2 size-4 animate-spin" /> : <IconTrash className="mr-2 size-4" />}
                Delete forever
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved Changes Bar */}
      <UnsavedChangesBar
        show={hasChanges}
        saving={saving}
        onSave={handleSaveSettings}
        onReset={handleResetSettings}
      />
    </div>
  )
}

// ── Email change card ───────────────────────────────────────────────
// Three-step flow with internal state machine:
//   idle    -> show current email + Change button
//   step1   -> input the new email, hit "Send code"
//              POST /api/auth/change-email/start
//   step2   -> we just emailed a code to the CURRENT address;
//              user types it. POST /change-email/verify-old.
//              On success, server sends a second code to the NEW
//              address and the flow advances.
//   step3   -> code typed in is for the NEW address.
//              POST /change-email/verify-new finalises everything.
//   done    -> brief success state then collapses back to idle
//              with the new email shown.
function EmailChangeCard({ currentEmail, onChanged }: { currentEmail: string; onChanged: (email: string) => void }) {
  type Step = 'idle' | 'step1' | 'step2' | 'step3' | 'done'
  const [step, setStep] = useState<Step>('idle')
  const [newEmail, setNewEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string>('')

  function reset() {
    setStep('idle')
    setNewEmail('')
    setCode('')
    setError(null)
    setSentTo('')
  }

  async function startFlow(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmed = newEmail.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/auth/change-email/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not send code')
        return
      }
      setSentTo(data.sentTo || currentEmail)
      setStep('step2')
      setCode('')
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function verifyOld(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^[0-9]{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from your email')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/auth/change-email/verify-old', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Wrong code')
        return
      }
      setSentTo(data.sentTo || newEmail)
      setStep('step3')
      setCode('')
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function verifyNew(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^[0-9]{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from your email')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/auth/change-email/verify-new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Wrong code')
        return
      }
      onChanged(data.email || newEmail)
      setStep('done')
      toast.success('Email updated')
      setTimeout(() => reset(), 1800)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-border bg-surface backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft">
            <IconMail className="size-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg text-foreground">Email</CardTitle>
            <CardDescription className="text-muted-foreground">
              {currentEmail ? `Current: ${currentEmail}` : 'No email on file'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {step === 'idle' ? (
          <Button
            onClick={() => setStep('step1')}
            variant="outline"
          >
            Change email
          </Button>
        ) : step === 'step1' ? (
          <form onSubmit={startFlow} className="space-y-3">
            <p className="text-xs text-foreground-secondary">
              Enter your new email. We'll send a 6-digit code to your <b className="text-foreground">current</b> email first to confirm it's you, then a second code to the new one to verify it.
            </p>
            <Input
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="new@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              disabled={busy}
              className="h-12 "
              autoFocus
            />
            {error ? <p className="text-xs text-red-300">{error}</p> : null}
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={busy}
                
              >
                {busy ? <IconLoader2 className="mr-2 size-4 animate-spin" /> : <IconArrowRight className="mr-2 size-4" />}
                Send code to current email
              </Button>
              <Button type="button" variant="ghost" onClick={reset} disabled={busy} >
                Cancel
              </Button>
            </div>
          </form>
        ) : step === 'step2' ? (
          <form onSubmit={verifyOld} className="space-y-3">
            <p className="text-xs text-foreground-secondary">
              Step 1 of 2. Enter the 6-digit code we just sent to your current email <b className="text-foreground">{sentTo}</b>.
            </p>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              disabled={busy}
              className="h-12 text-center font-mono text-lg tracking-[0.5em]"
              autoFocus
            />
            {error ? <p className="text-xs text-red-300">{error}</p> : null}
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={busy || code.length !== 6}
                
              >
                {busy ? <IconLoader2 className="mr-2 size-4 animate-spin" /> : <IconArrowRight className="mr-2 size-4" />}
                Verify current email
              </Button>
              <Button type="button" variant="ghost" onClick={reset} disabled={busy} >
                Cancel
              </Button>
            </div>
          </form>
        ) : step === 'step3' ? (
          <form onSubmit={verifyNew} className="space-y-3">
            <p className="text-xs text-foreground-secondary">
              Step 2 of 2. We sent a code to your <b className="text-foreground">new</b> email <b className="text-foreground">{sentTo}</b>. Enter it to finish.
            </p>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              disabled={busy}
              className="h-12 text-center font-mono text-lg tracking-[0.5em]"
              autoFocus
            />
            {error ? <p className="text-xs text-red-300">{error}</p> : null}
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={busy || code.length !== 6}
                
              >
                {busy ? <IconLoader2 className="mr-2 size-4 animate-spin" /> : <IconCheck className="mr-2 size-4" />}
                Apply email change
              </Button>
              <Button type="button" variant="ghost" onClick={reset} disabled={busy} >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <p className="flex items-center gap-2 text-sm text-emerald-300">
            <IconCheck className="size-4" /> Email updated.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ── Password change card ────────────────────────────────────────────
// Two-step flow:
//   idle  -> show "Password" + Change button
//   step1 -> show "We'll email you a code." + Send button
//            POST /api/auth/change-password/start
//   step2 -> input code + new password + confirm; submit fires
//            POST /change-password/verify
//   done  -> brief success then collapse to idle
function PasswordChangeCard() {
  type Step = 'idle' | 'step1' | 'step2' | 'done'
  const [step, setStep] = useState<Step>('idle')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState('')

  function reset() {
    setStep('idle')
    setCode('')
    setNewPassword('')
    setConfirmPassword('')
    setError(null)
    setSentTo('')
  }

  async function sendCode() {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/auth/change-password/start', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not send code')
        return
      }
      setSentTo(data.sentTo || '')
      setStep('step2')
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^[0-9]{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from your email')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match")
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/auth/change-password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not change password')
        return
      }
      toast.success('Password updated')
      setStep('done')
      setTimeout(() => reset(), 1800)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-border bg-surface backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft">
            <IconKey className="size-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg text-foreground">Password</CardTitle>
            <CardDescription className="text-muted-foreground">
              We'll email you a code to confirm it's you
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {step === 'idle' ? (
          <Button
            onClick={() => setStep('step1')}
            variant="outline"
          >
            Change password
          </Button>
        ) : step === 'step1' ? (
          <div className="space-y-3">
            <p className="text-xs text-foreground-secondary">
              We'll send a 6-digit verification code to your registered email. You'll then enter it along with your new password.
            </p>
            {error ? <p className="text-xs text-red-300">{error}</p> : null}
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={sendCode}
                disabled={busy}
                
              >
                {busy ? <IconLoader2 className="mr-2 size-4 animate-spin" /> : <IconArrowRight className="mr-2 size-4" />}
                Send verification code
              </Button>
              <Button type="button" variant="ghost" onClick={reset} disabled={busy} >
                Cancel
              </Button>
            </div>
          </div>
        ) : step === 'step2' ? (
          <form onSubmit={verify} className="space-y-3">
            <p className="text-xs text-foreground-secondary">
              Code sent to <b className="text-foreground">{sentTo}</b>. Enter it and pick a new password.
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Verification code</label>
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                disabled={busy}
                className="h-12 text-center font-mono text-lg tracking-[0.5em]"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">New password</label>
              <Input
                type="password"
                autoComplete="new-password"
                minLength={8}
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={busy}
                className="h-12 "
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Confirm new password</label>
              <Input
                type="password"
                autoComplete="new-password"
                minLength={8}
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={busy}
                className="h-12 "
              />
            </div>
            {error ? <p className="text-xs text-red-300">{error}</p> : null}
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={busy || code.length !== 6 || newPassword.length < 8 || newPassword !== confirmPassword}
                
              >
                {busy ? <IconLoader2 className="mr-2 size-4 animate-spin" /> : <IconCheck className="mr-2 size-4" />}
                Update password
              </Button>
              <Button type="button" variant="ghost" onClick={reset} disabled={busy} >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <p className="flex items-center gap-2 text-sm text-emerald-300">
            <IconCheck className="size-4" /> Password updated.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
