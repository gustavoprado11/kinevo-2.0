import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            { userAgent: '*', allow: '/', disallow: ['/api/', '/dashboard/', '/students/', '/programs/', '/financial/', '/settings/', '/messages/', '/exercises/', '/forms/', '/reports/', '/training-room/', '/subscription/'] },
        ],
        sitemap: 'https://www.kinevoapp.com/sitemap.xml',
        host: 'https://www.kinevoapp.com',
    }
}
