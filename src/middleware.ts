import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isOnDashboard = req.nextUrl.pathname.startsWith('/dashboard');
  const isOnLogin = req.nextUrl.pathname.startsWith('/login');
  const isOnOnboarding = req.nextUrl.pathname.startsWith('/onboarding');
  const isOnStart = req.nextUrl.pathname.startsWith('/start');
  const isApi = req.nextUrl.pathname.startsWith('/api');

  // Public routes - onboarding and start pages don't require auth
  if (isOnOnboarding || isOnStart) {
    return NextResponse.next();
  }

  // API routes - handle their own auth
  if (isApi) {
    return NextResponse.next();
  }

  // Dashboard requires authentication
  if (isOnDashboard) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    return NextResponse.next();
  }

  // If logged in and trying to access login page, redirect to dashboard
  if (isLoggedIn && isOnLogin) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
