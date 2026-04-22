import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL('https://kinevo.com.br'),
  title: {
    default: 'Kinevo — Sistema completo para personal trainers',
    template: '%s · Kinevo',
  },
  description: 'Prescreva programas em minutos, acompanhe quem treinou de verdade e receba sem taxa Kinevo. App iOS/Android, Apple Watch nativo e assistente IA.',
  keywords: ['personal trainer', 'app personal trainer', 'gestão personal', 'prescrição treino', 'apple watch personal', 'assistente IA personal'],
  authors: [{ name: 'Kinevo' }],
  creator: 'Kinevo',
  publisher: 'Kinevo',
  alternates: {
    canonical: 'https://kinevo.com.br',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://kinevo.com.br',
    siteName: 'Kinevo',
    title: 'Kinevo — Sistema completo para personal trainers',
    description: 'Prescreva, acompanhe e receba sem taxa Kinevo. App nativo iOS/Android + Apple Watch.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Kinevo — Sistema completo para personal trainers',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kinevo — Sistema completo para personal trainers',
    description: 'Prescreva, acompanhe e receba sem taxa Kinevo.',
    images: ['/og-image.png'],
    creator: '@kinevo',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: '/favicon.png',
    apple: '/icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0A0B' },
  ],
  width: 'device-width',
  initialScale: 1,
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Kinevo',
  url: 'https://kinevo.com.br',
  logo: 'https://kinevo.com.br/logo-icon.png',
  sameAs: ['https://www.instagram.com/kinevo.app'],
  description: 'Sistema completo para personal trainers',
}

const softwareJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Kinevo',
  applicationCategory: 'HealthApplication',
  operatingSystem: 'iOS, Android, Web',
  offers: {
    '@type': 'Offer',
    price: '39.90',
    priceCurrency: 'BRL',
  },
  // Note: aggregateRating intentionally omitted until we have real
  // verifiable reviews (G2, Trustpilot, App Store). Google penalizes
  // fabricated structured data.
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jakarta.variable} ${inter.className} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
        />
        <ThemeProvider>{children}</ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
