// Re-export the webhook handler from the canonical location.
// Stripe is configured to send events to /api/stripe/webhook,
// but the handler lives at /api/webhooks/stripe.
// This file ensures both URLs work.
export { POST } from '@/app/api/webhooks/stripe/route'
