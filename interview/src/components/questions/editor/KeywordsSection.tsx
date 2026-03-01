import { Tag, FileEdit } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface KeywordsSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export const KeywordsSection = ({ value, onChange }: KeywordsSectionProps) => {
  const keywords = value
    .split(/[,，]+/)
    .map(k => k.trim())
    .filter(k => k);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[280px] divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
      {/* Live Preview */}
      <div className="flex flex-col overflow-hidden h-[280px] lg:h-auto bg-red-50/20">
        <div className="p-4 border-b border-red-100 flex items-center gap-3 shrink-0">
          <div className="p-1.5 bg-red-100 text-red-600 rounded-lg">
            <Tag className="w-4 h-4" />
          </div>
          <span className="text-sm font-bold text-red-700 uppercase tracking-wide">
            关键词预览
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-8 bg-transparent min-h-0">
          {keywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {keywords.map((keyword, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-4 py-2 bg-red-50 text-red-600 font-bold rounded-full border-2 border-red-400 shadow-md whitespace-nowrap flex-shrink-0"
                >
                  {keyword}
                </span>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-2">
              <Tag size={32} className="opacity-20" />
              <p className="font-medium">暂无关键词</p>
            </div>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex flex-col overflow-hidden h-[280px] lg:h-auto bg-white/40">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3 shrink-0">
          <div className="p-1.5 bg-gray-100 text-gray-600 rounded-lg">
            <FileEdit className="w-4 h-4" />
          </div>
          <span className="text-sm font-bold text-gray-600 uppercase tracking-wide">
            答案关键词
          </span>
        </div>
        <Textarea
          placeholder="输入答案的核心关键词，用逗号分隔（如：递归,时间复杂度,空间优化）..."
          className="flex-1 resize-none border-none focus-visible:ring-0 text-gray-800 text-lg leading-relaxed p-8 shadow-none font-mono bg-transparent min-h-0 placeholder:text-gray-300"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
};
