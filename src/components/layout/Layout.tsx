
import React from 'react';
import Header from './Header';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  showBack?: boolean;
  backTo?: string;
}

export default function Layout({ children, title, showBack, backTo }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header title={title} showBack={showBack} backTo={backTo} />
      <main className="flex-1 p-4 sm:p-6 container mx-auto max-w-3xl">
        {children}
      </main>
    </div>
  );
}
