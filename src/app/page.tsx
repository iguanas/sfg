import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-white px-4">
      <main className="text-center space-y-8 max-w-2xl">
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">
            Set Forget Grow
          </h1>
          <p className="text-xl text-gray-600">
            Client Onboarding System
          </p>
        </div>

        <p className="text-lg text-gray-500 leading-relaxed">
          Complete your onboarding in just 10-15 minutes. We'll guide you through
          everything we need to get your local business marketing up and running.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg" className="text-lg px-8">
            <Link href="/start">
              Start Onboarding
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="text-lg px-8">
            <Link href="/login">
              Admin Login
            </Link>
          </Button>
        </div>

        <div className="pt-8 border-t border-gray-200">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
            What we'll collect
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Business Info
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Domain Access
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Google Profile
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Business Photos
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Hours & Services
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Contact Details
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
