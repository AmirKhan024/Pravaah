'use client';
import dynamic from 'next/dynamic';

const CoverFlow = dynamic(() => import('@/components/cover/CoverFlow'), { ssr: false });

export default function CoverVisual() {
  return <CoverFlow />;
}
