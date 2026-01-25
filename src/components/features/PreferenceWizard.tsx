'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { GenreSelector } from './GenreSelector';
import { MoodSelector } from './QuickMoods';
import { Button } from '@/components/ui';
import { usePreferencesStore } from '@/store';
import { ERA_PRESETS, LANGUAGES } from '@/lib/tmdb';
import { cn } from '@/lib/utils';

/**
 * Preference Wizard Component
 * Multi-step preference selection for personalized recommendations
 */

interface PreferenceWizardProps {
  onComplete?: () => void;
  className?: string;
}

type WizardStep = 'genres' | 'mood' | 'era' | 'language' | 'rating';

const steps: { id: WizardStep; title: string; description: string }[] = [
  { id: 'genres', title: 'Pick your genres', description: 'Select genres you love' },
  { id: 'mood', title: "What's your mood?", description: 'How are you feeling today?' },
  { id: 'era', title: 'Pick an era', description: 'Classic or modern?' },
  { id: 'language', title: 'Language preference', description: 'What languages do you prefer?' },
  { id: 'rating', title: 'Rating preference', description: 'Quality matters!' },
];

export function PreferenceWizard({ onComplete, className }: PreferenceWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const {
    preferences,
    toggleGenre,
    setMood,
    setEra,
    setLanguages,
    setRatingPreference,
  } = usePreferencesStore();

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      // Complete wizard - build query params from preferences
      onComplete?.();
      
      const params = new URLSearchParams();
      
      // Add genres
      if (preferences.genres.length > 0) {
        params.set('genres', preferences.genres.join(','));
      }
      
      // Add era (year range)
      if (preferences.era && ERA_PRESETS[preferences.era]) {
        const eraRange = ERA_PRESETS[preferences.era];
        if (eraRange.from) params.set('year_gte', eraRange.from.toString());
        if (eraRange.to) params.set('year_lte', eraRange.to.toString());
      }
      
      // Add language
      if (preferences.languages.length > 0) {
        params.set('language', preferences.languages[0]); // Use first selected language
      }
      
      // Add rating
      if (preferences.ratingPreference === 'high') {
        params.set('vote_gte', '6');
      } else if (preferences.ratingPreference === 'top') {
        params.set('vote_gte', '8');
      }
      
      // Navigate to results
      router.push(`/recommendations/results?${params.toString()}`);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const toggleLanguage = (langCode: string) => {
    const current = preferences.languages;
    if (current.includes(langCode)) {
      setLanguages(current.filter((l) => l !== langCode));
    } else {
      setLanguages([...current, langCode]);
    }
  };

  const renderStepContent = () => {
    switch (steps[currentStep].id) {
      case 'genres':
        return (
          <GenreSelector
            selectedGenres={preferences.genres}
            onToggleGenre={toggleGenre}
            variant="grid"
          />
        );

      case 'mood':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['happy', 'dark', 'emotional', 'exciting', 'relaxing', 'thrilling'] as const).map(
              (mood) => (
                <button
                  key={mood}
                  onClick={() => setMood(preferences.mood === mood ? null : mood)}
                  className={cn(
                    'p-4 rounded-xl border text-center capitalize transition-all',
                    preferences.mood === mood
                      ? 'bg-primary-600/20 border-primary-500 text-white'
                      : 'bg-dark-800 border-dark-600 text-gray-300 hover:border-primary-500/50'
                  )}
                >
                  {mood}
                </button>
              )
            )}
          </div>
        );

      case 'era':
        return (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {(Object.keys(ERA_PRESETS) as Array<keyof typeof ERA_PRESETS>).map((era) => (
              <button
                key={era}
                onClick={() => setEra(preferences.era === era ? null : era)}
                className={cn(
                  'p-4 rounded-xl border text-center capitalize transition-all',
                  preferences.era === era
                    ? 'bg-primary-600/20 border-primary-500 text-white'
                    : 'bg-dark-800 border-dark-600 text-gray-300 hover:border-primary-500/50'
                )}
              >
                {era === 'latest' ? '🆕 Latest' : era === 'classic' ? '🎬 Classic' : `📅 ${era}`}
              </button>
            ))}
          </div>
        );

      case 'language':
        return (
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => toggleLanguage(lang.code)}
                className={cn(
                  'px-4 py-2 rounded-full border transition-all',
                  preferences.languages.includes(lang.code)
                    ? 'bg-primary-600/20 border-primary-500 text-white'
                    : 'bg-dark-800 border-dark-600 text-gray-300 hover:border-primary-500/50'
                )}
              >
                {lang.name}
              </button>
            ))}
          </div>
        );

      case 'rating':
        return (
          <div className="grid grid-cols-3 gap-4">
            {([
              { value: 'any', label: 'Any Rating', desc: 'Show all movies' },
              { value: 'high', label: 'Good (6+)', desc: 'Above average' },
              { value: 'top', label: 'Top Rated (8+)', desc: 'Best of the best' },
            ] as const).map((option) => (
              <button
                key={option.value}
                onClick={() => setRatingPreference(option.value)}
                className={cn(
                  'p-4 rounded-xl border text-center transition-all',
                  preferences.ratingPreference === option.value
                    ? 'bg-primary-600/20 border-primary-500 text-white'
                    : 'bg-dark-800 border-dark-600 text-gray-300 hover:border-primary-500/50'
                )}
              >
                <div className="font-semibold">{option.label}</div>
                <div className="text-xs text-gray-400 mt-1">{option.desc}</div>
              </button>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={cn('max-w-4xl mx-auto py-8', className)}>
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                'flex-1 text-center text-xs',
                index <= currentStep ? 'text-primary-400' : 'text-gray-600'
              )}
            >
              Step {index + 1}
            </div>
          ))}
        </div>
        <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary-500"
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Step content */}
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3 }}
      >
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
          {steps[currentStep].title}
        </h2>
        <p className="text-gray-400 mb-6">{steps[currentStep].description}</p>
        {renderStepContent()}
      </motion.div>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <Button
          variant="ghost"
          onClick={handlePrev}
          disabled={currentStep === 0}
          className="gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
        <Button onClick={handleNext} className="gap-2">
          {currentStep === steps.length - 1 ? (
            <>
              <Sparkles className="w-4 h-4" />
              Get Recommendations
            </>
          ) : (
            <>
              Next
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
