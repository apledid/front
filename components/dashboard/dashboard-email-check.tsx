'use client'

import { useState, useEffect } from 'react'
import { EmailVerificationModal } from './email-verification-modal'

interface DashboardEmailCheckProps {
  email: string | null
  emailVerified: boolean
  emailDeadline: string | null
}

export function DashboardEmailCheck({ 
  email, 
  emailVerified, 
  emailDeadline 
}: DashboardEmailCheckProps) {
  const [showModal, setShowModal] = useState(false)
  const [verified, setVerified] = useState(emailVerified)

  useEffect(() => {
    // Show modal if user doesn't have a verified email and has a deadline
    if (!verified && emailDeadline) {
      setShowModal(true)
    }
  }, [verified, emailDeadline])

  function handleVerified() {
    setVerified(true)
    setShowModal(false)
    // Refresh the page to update the profile data
    window.location.reload()
  }

  return (
    <EmailVerificationModal
      open={showModal}
      deadline={emailDeadline}
      email={email}
      emailVerified={verified}
      onVerified={handleVerified}
    />
  )
}
