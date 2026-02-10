import Stripe from 'stripe'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY is missing from environment variables')
}

export const stripe = new Stripe(stripeSecretKey, {
    typescript: true,
})
