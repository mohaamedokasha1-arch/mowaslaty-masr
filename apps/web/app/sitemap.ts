import type { MetadataRoute } from 'next';

const BASE = 'https://mowaslaty-masr.example.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = ['', '/routes', '/cities', '/report'].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: path === '' ? 1 : 0.8,
  }));

  // Known seed route ids (kept in sync with apps/backend/src/database/seed-data.ts)
  const routeIds = [
    'route-zg-01',
    'route-zg-02',
    'route-zg-03',
    'route-zg-04',
    'route-zg-ism',
    'route-is-01',
    'route-ca-metro1',
    'route-ca-01',
    'route-ca-zg',
  ];

  return [
    ...staticPages,
    ...routeIds.map((id) => ({
      url: `${BASE}/route/${id}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ];
}
