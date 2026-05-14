import { CheckoutBridgeClient } from './bridge-client'

interface SearchParams {
    result?: string
}

export default async function CheckoutBridgePage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>
}) {
    const params = await searchParams
    const result: 'success' | 'canceled' = params.result === 'canceled' ? 'canceled' : 'success'
    return <CheckoutBridgeClient result={result} />
}
