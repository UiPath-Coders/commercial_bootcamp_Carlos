import winnerUrl from '@/assets/winner.png';
import message from '@/assets/message.txt?raw';

interface GatePageProps {
  onContinue: () => void;
}

/** Screen 1: shown once, right after sign-in. winner.png and message.txt are its only content. */
export function GatePage({ onContinue }: GatePageProps) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 flex items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl shadow-brand-950/40 ring-1 ring-brand-100 overflow-hidden">
        <div className="bg-white px-4 pt-6 sm:px-10 sm:pt-10">
          <img
            src={winnerUrl}
            alt="Six runners in number 1 bibs celebrating as they cross the finish line"
            className="mx-auto block h-auto w-full max-w-3xl"
          />
        </div>
        <div className="border-t border-brand-100 bg-brand-50/60 px-6 py-8 sm:px-12 sm:py-10 text-center">
          <p className="mx-auto max-w-2xl whitespace-pre-line break-words text-lg leading-relaxed text-slate-700 sm:text-xl">
            {message.trim()}
          </p>
          <button
            type="button"
            onClick={onContinue}
            className="mt-8 inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-8 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 active:bg-brand-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:w-auto"
          >
            Yes, I am winner
          </button>
        </div>
      </div>
    </main>
  );
}
