import { BrainCircuit } from 'lucide-react';

interface ReviewHeaderProps {
  total: number;
  completed: number;
}

export const ReviewHeader = ({ total, completed }: ReviewHeaderProps) => {
  const remaining = total - completed;

  return (
    <div className="flex items-center justify-between gap-6">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-blue-50 text-blue-500 rounded-2xl shadow-sm border border-blue-100/50 shrink-0">
          <BrainCircuit size={28} strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
            今日复习
          </h1>
          <p className="text-sm text-gray-500 font-medium mt-0.5">
            {remaining > 0 ? (
              <>还剩 <span className="font-bold text-gray-700">{remaining}</span> 张</>
            ) : (
              '全部完成 🎉'
            )}
          </p>
        </div>
      </div>

      {/* Compact X/Y counter */}
      <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-gray-200/60 shadow-sm shrink-0">
        <span className="text-xl font-black text-gray-900">{completed}</span>
        <span className="text-gray-300 font-bold">/</span>
        <span className="text-base font-bold text-gray-400">{total}</span>
      </div>
    </div>
  );
};
