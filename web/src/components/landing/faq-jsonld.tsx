import { faqs } from './faqs-data'

// Server component: renders schema.org FAQPage JSON-LD.
// Google surfaces this as rich snippets in search results — FAQ questions
// expand directly in the SERP for branded / intent-matching queries.
// Keep questions/answers in sync with faqs-data.ts (single source).
export function FaqJsonLd() {
    const payload = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: f.answer,
            },
        })),
    }

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
        />
    )
}
