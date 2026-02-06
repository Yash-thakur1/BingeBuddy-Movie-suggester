import type { Metadata } from 'next';
import { TVPreferenceWizard } from './TVPreferenceWizard';

export const metadata: Metadata = {
  title: 'AI TV Show Recommendations - Find Your Next Binge',
  description:
    'Get personalized TV show recommendations powered by AI. Tell us your preferences and discover series perfectly matched to your taste.',
  alternates: {
    canonical: '/tv/recommendations',
  },
  openGraph: {
    title: 'AI TV Show Recommendations - Find Your Next Binge',
    description:
      'Get AI-powered TV show recommendations based on your preferences.',
    url: '/tv/recommendations',
  },
};

export default function TVRecommendationsPage() {
  return (
    <div className="container mx-auto px-4 md:px-8 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-2">
          📺 TV Show Recommendations
        </h1>
        <p className="text-gray-400 max-w-xl mx-auto">
          Tell us what you like and we&apos;ll find the perfect TV shows for you
        </p>
      </div>

      <TVPreferenceWizard />
    </div>
  );
}
