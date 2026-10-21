import React, { useState } from 'react';
import { Lock, Droplets, Delete, ShieldCheck } from 'lucide-react';

interface PinLockScreenProps {
  correctPin: string;
  onUnlocked: () => void;
  appName?: string;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({
  correctPin,
  onUnlocked,
  appName = 'TubeWell Khata',
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(false);

      if (nextPin.length === 4) {
        if (nextPin === correctPin) {
          onUnlocked();
        } else {
          setError(true);
          setTimeout(() => {
            setPin('');
            setError(false);
          }, 800);
        }
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 text-white flex flex-col items-center justify-between p-6">
      <div className="text-center pt-10">
        <div className="w-16 h-16 mx-auto mb-3 rounded-3xl bg-[#087C71] flex items-center justify-center shadow-xl shadow-teal-900/40">
          <Droplets className="w-8 h-8 text-white fill-white/30" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">{appName}</h1>
        <p className="text-xs text-teal-300 font-medium mt-1">App Locked</p>
      </div>

      <div className="flex flex-col items-center space-y-6">
        <p className="text-xs text-slate-400">Enter your 4-digit security PIN</p>

        {/* PIN Indicators */}
        <div className="flex gap-4">
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  error
                    ? 'bg-rose-500 scale-110'
                    : isFilled
                    ? 'bg-[#087C71] scale-125'
                    : 'bg-slate-700'
                }`}
              />
            );
          })}
        </div>

        {error && (
          <p className="text-xs text-rose-400 font-bold animate-pulse">
            Incorrect PIN. Try again.
          </p>
        )}
      </div>

      {/* Numeric Keypad */}
      <div className="w-full max-w-xs grid grid-cols-3 gap-3 pb-8">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => handleDigit(d)}
            className="h-16 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-2xl font-bold text-white flex items-center justify-center active:scale-95 transition-all"
          >
            {d}
          </button>
        ))}
        <div />
        <button
          type="button"
          onClick={() => handleDigit('0')}
          className="h-16 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-2xl font-bold text-white flex items-center justify-center active:scale-95 transition-all"
        >
          0
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="h-16 rounded-2xl bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center active:scale-95 transition-all"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
