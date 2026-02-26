import { BookCheck, FileEdit } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.css";

interface AnswerSectionProps {
  answer: string;
  onUpdate: (field: string, value: any) => void;
}

export const AnswerSection = ({ answer, onUpdate }: AnswerSectionProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[500px] divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
      {/* Live Preview */}
      <div className="flex flex-col overflow-hidden h-[500px] lg:h-auto bg-emerald-50/20">
        <div className="p-4 border-b border-emerald-100 flex items-center gap-3 shrink-0">
          <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
            <BookCheck className="w-4 h-4" />
          </div>
          <span className="text-sm font-bold text-emerald-700 uppercase tracking-wide">
            答案预览
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-8 bg-transparent min-h-0">
          {answer?.trim() ? (
            <article className="prose prose-slate max-w-none dark:prose-invert prose-code:before:content-none prose-code:after:content-none prose-p:leading-relaxed">
              <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeHighlight, rehypeKatex]}
              >
                {answer}
              </ReactMarkdown>
            </article>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-2">
              <BookCheck size={32} className="opacity-20" />
              <p className="font-medium">暂无答案内容</p>
            </div>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex flex-col overflow-hidden h-[500px] lg:h-auto bg-white/40">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3 shrink-0">
          <div className="p-1.5 bg-gray-100 text-gray-600 rounded-lg">
            <FileEdit className="w-4 h-4" />
          </div>
          <span className="text-sm font-bold text-gray-600 uppercase tracking-wide">
            标准答案 (支持 Markdown)
          </span>
        </div>
        <Textarea
          placeholder="在此输入八股文的标准答案，支持 Markdown 语法..."
          className="flex-1 resize-none border-none focus-visible:ring-0 text-gray-800 text-lg leading-relaxed p-8 shadow-none font-mono bg-transparent min-h-0 placeholder:text-gray-300"
          value={answer || ''}
          onChange={(e) => onUpdate("answer", e.target.value)}
        />
      </div>
    </div>
  );
};
