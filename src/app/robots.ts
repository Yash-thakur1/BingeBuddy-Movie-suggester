import { MetadataRoute } from 'next';

const SITE_URL = 'https://www.bingebuddy.in';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/auth/',
          '/recommendations/results',
          '/tv/recommendations/results',
          '/profile',
          '/*?page=*',
          '/*?sort=*',
          '/*?genre=*&year=*&sort=*',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/api/',
          '/auth/',
          '/profile',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
