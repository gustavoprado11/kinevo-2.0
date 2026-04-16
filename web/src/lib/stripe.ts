import Stripe from 'stripe'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY is missing from environment variables')
}

// Pin apiVersion. Without this, the Stripe SDK uses whatever version is
// bundled with the installed library version — a silent bump on upgrade can
// change field shapes (e.g. the Invoice.subscription move to Invoice.parent
// that already bit us in the v20 upgrade). Pinning decouples our code from
// the SDK's default.
export const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2026-02-25.clover',
    typescript: true,
})
