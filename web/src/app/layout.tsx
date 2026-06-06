import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL('https://www.kinevoapp.com'),
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
    canonical: 'https://www.kinevoapp.com',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://www.kinevoapp.com',
    siteName: 'Kinevo',
    title: 'Kinevo — Sistema completo para personal trainers',
    description: 'Prescreva, acompanhe e receba sem taxa Kinevo. App nativo iOS/Android + Apple Watch.',
    // A imagem é gerada por src/app/opengraph-image.tsx (convenção do Next).
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kinevo — Sistema completo para personal trainers',
    description: 'Prescreva, acompanhe e receba sem taxa Kinevo.',
    // A imagem é gerada por src/app/twitter-image.tsx (convenção do Next).
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
  url: 'https://www.kinevoapp.com',
  logo: 'https://www.kinevoapp.com/logo-icon.png',
  description:
    'Kinevo é o sistema para personal trainers que prescreve treino com inteligência artificial revisada e aprovada pelo profissional, com app nativo para iOS, Android e Apple Watch e recebimento sem taxa da plataforma.',
  sameAs: [
    'https://www.instagram.com/kinevo.app',
    'https://apps.apple.com/br/app/kinevo/id6759053587',
    'https://play.google.com/store/apps/details?id=com.kinevo.mobile',
  ],
}

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Kinevo',
  url: 'https://www.kinevoapp.com',
  inLanguage: 'pt-BR',
  publisher: { '@type': 'Organization', name: 'Kinevo' },
}

const softwareJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Kinevo',
  description:
    'Sistema para personal trainers: prescrição de treino assistida por IA e revisada pelo profissional, acompanhamento de treinos em tempo real, app nativo para o aluno no iOS, Android e Apple Watch, e recebimento sem taxa da plataforma.',
  applicationCategory: 'HealthApplication',
  operatingSystem: 'iOS, Android, Web',
  url: 'https://www.kinevoapp.com',
  inLanguage: 'pt-BR',
  featureList: [
    'Prescrição de treino assistida por IA, revisada e aprovada pelo personal',
    'Acompanhamento de treinos em tempo real (Sala de Treino)',
    'App nativo para o aluno no iOS e Android',
    'App nativo para Apple Watch com frequência cardíaca e timer de descanso',
    'Funciona offline',
    'Recebimento sem taxa da plataforma',
    'Assistente de IA com contexto completo de cada aluno',
    'Formulários e anamneses gerados por IA',
  ],
  offers: {
    '@type': 'Offer',
    price: '39.90',
    priceCurrency: 'BRL',
    url: 'https://www.kinevoapp.com',
    availability: 'https://schema.org/InStock',
    priceValidUntil: '2026-12-31',
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
        />
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
