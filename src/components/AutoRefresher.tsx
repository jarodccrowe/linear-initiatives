'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes in milliseconds

export default function AutoRefresher() {
  const router = useRouter();

  useEffect(() => {
    console.log('Setting up auto-refresh interval:', REFRESH_INTERVAL);
    const intervalId = setInterval(() => {
      console.log('Refreshing page data...');
      router.refresh();
    }, REFRESH_INTERVAL);

    // Cleanup function to clear the interval when the component unmounts
    return () => {
      console.log('Clearing auto-refresh interval.');
      clearInterval(intervalId);
    };
  }, [router]); // Dependency array includes router

  // This component doesn't render anything visible
  return null;
}
