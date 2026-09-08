'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const { token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (token) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [token, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f7fa]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1a1a2e]"></div>
    </div>
  );
}
