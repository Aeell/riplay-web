// Structured data for search engines, built from the same facts the pages show.
//
// Nothing here may say more than the site does. Unknown facts are omitted rather than filled:
// there is no phone number, no opening hours, no IČO and no price — so there is no field for
// them. A rich result that states a fact the page does not is exactly the kind of lie this
// project exists to refuse.

import { shop } from '../data/shop';

export const SITE = 'https://riplay.cz';

type Json = Record<string, unknown>;

const postalAddress = {
  '@type': 'PostalAddress',
  streetAddress: 'Mokrá 68',
  addressLocality: 'Liberec-Machnín',
  postalCode: '460 01',
  addressCountry: 'CZ',
} as const;

/** The workshop itself: who, where, how to write. */
export function localBusiness(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${SITE}/#dilna`,
    name: 'Riplay',
    description:
      'Jednočlenná dílna v Liberci: CAD, CNC frézování a 3D tisk. Náhradní díly a součásti na míru.',
    url: `${SITE}/`,
    image: `${SITE}/og.png`,
    email: shop.legal.email,
    address: postalAddress,
    knowsAbout: ['CNC frézování', '3D tisk', 'CAD modelování', 'Náhradní díly'],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Služby',
      itemListElement: shop.services.map((service) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: service.title,
          description: service.text,
          provider: { '@id': `${SITE}/#dilna` },
        },
      })),
    },
  };
}

/** The site as a whole, tied to the business above. */
export function webSite(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE}/#web`,
    url: `${SITE}/`,
    name: 'Riplay',
    inLanguage: 'cs',
    publisher: { '@id': `${SITE}/#dilna` },
  };
}

/** A browser tool that is free and runs locally — which is what the pages claim. */
export function webApplication(name: string, description: string, path: string): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    description,
    url: new URL(path, SITE).href,
    applicationCategory: 'DesignApplication',
    operatingSystem: 'Any',
    browserRequirements: 'JavaScript',
    inLanguage: 'cs',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'CZK' },
    isAccessibleForFree: true,
    publisher: { '@id': `${SITE}/#dilna` },
  };
}

/** A journal episode: dated, titled, written by the workshop. */
export function blogPosting(entry: {
  headline: string;
  description: string;
  datePublished: string;
  path: string;
}): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: entry.headline,
    description: entry.description,
    datePublished: entry.datePublished,
    url: new URL(entry.path, SITE).href,
    mainEntityOfPage: new URL(entry.path, SITE).href,
    inLanguage: 'cs',
    author: { '@type': 'Person', name: shop.legal.name },
    publisher: { '@id': `${SITE}/#dilna` },
  };
}
