import { test as setup, expect } from '@playwright/test'

const AUTH_FILE = 'e2e/.auth/user.json'

/**
 * Authenticates via Microsoft OAuth and saves storage state for all tests.
 * Set E2E_USER_EMAIL and E2E_USER_PASSWORD env vars with Microsoft credentials.
 */
setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD

  if (!email || !password) {
    console.warn(
      '⚠️  E2E_USER_EMAIL / E2E_USER_PASSWORD not set – saving empty auth state.',
    )
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.context().storageState({ path: AUTH_FILE })
    return
  }

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // Click "Sign in with Microsoft" — this redirects to Supabase → Azure AD
  const msBtn = page.getByRole('button', { name: /sign in with microsoft/i })
  await expect(msBtn).toBeVisible({ timeout: 15_000 })
  await msBtn.click()

  // Microsoft login page: enter email
  await page.waitForURL(/login\.microsoftonline\.com|supabase/, { timeout: 15_000 })
  const emailInput = page.locator('input[type="email"], input[name="loginfmt"]')
  await expect(emailInput).toBeVisible({ timeout: 10_000 })
  await emailInput.fill(email)
  await page.getByRole('button', { name: /next/i }).click()

  // Microsoft login page: enter password
  const passwordInput = page.locator('input[type="password"], input[name="passwd"]')
  await expect(passwordInput).toBeVisible({ timeout: 10_000 })
  await passwordInput.fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()

  // "Stay signed in?" prompt — click Yes
  const staySignedInYes = page.locator('input[type="submit"][value="Yes"], button:has-text("Yes"), #idSIButton9')
  await staySignedInYes.first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {})
  if (await staySignedInYes.first().isVisible().catch(() => false)) {
    await staySignedInYes.first().click()
  }

  // Wait for redirect back to the app (/employee is the default redirect)
  await page.waitForURL(/localhost|127\.0\.0\.1/, { timeout: 30_000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(3000)

  await page.context().storageState({ path: AUTH_FILE })
})
