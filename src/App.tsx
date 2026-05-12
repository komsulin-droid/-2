/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  BrainCircuit, 
  History, 
  Plus, 
  Trash2, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Maximize2,
  Calendar,
  Sparkles,
  Info,
  Download,
  FileText,
  FileDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeDecision } from './services/geminiService';
import { exportToWord, exportToPDF } from './services/exportService';
import { Decision, AnalysisResult } from './types';
import { cn } from './lib/utils';

export default function App() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [query, setQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentDecision, setCurrentDecision] = useState<Decision | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('decision_history');
    if (saved) {
      try {
        setDecisions(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('decision_history', JSON.stringify(decisions));
  }, [decisions]);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await analyzeDecision(query);
      const newDecision: Decision = {
        id: crypto.randomUUID(),
        query,
        timestamp: Date.now(),
        analysis: result,
      };

      setDecisions(prev => [newDecision, ...prev]);
      setCurrentDecision(newDecision);
      setQuery('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Щось пішло не так при аналізі.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const deleteDecision = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDecisions(prev => prev.filter(d => d.id !== id));
    if (currentDecision?.id === id) {
      setCurrentDecision(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#1A1A1A] font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-bottom border-gray-100 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-[#1A1A1A] p-2 rounded-xl">
            <BrainCircuit className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Аналізатор рішень</h1>
        </div>
        
        <button 
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 px-4 py-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <History className="w-5 h-5 text-gray-600" />
          <span className="text-sm font-medium">Історія</span>
          {decisions.length > 0 && (
            <span className="bg-black text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {decisions.length}
            </span>
          )}
        </button>
      </header>

      <main className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Input and Results */}
        <div className={cn("lg:col-span-12 space-y-8 transition-all duration-500", showHistory && "lg:col-span-8")}>
          
          {/* Input Section */}
          <section className="bg-white p-8 rounded-3xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex items-start gap-4 mb-6">
              <div className="bg-amber-100 p-2 rounded-lg">
                <Sparkles className="text-amber-600 w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-medium">Яке рішення ви обмірковуєте?</h2>
                <p className="text-sm text-gray-500">Опишіть ситуацію — ШІ допоможе зважити всі "за" і "проти".</p>
              </div>
            </div>

            <form onSubmit={handleAnalyze} className="space-y-4">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Приклад: Чи варто мені змінювати роботу зараз на віддалену, але з меншою зарплатою?"
                className="w-full min-h-[120px] p-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all resize-none text-lg leading-relaxed"
                disabled={isAnalyzing}
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isAnalyzing || !query.trim()}
                  className="bg-[#1A1A1A] hover:bg-black text-white px-8 py-4 rounded-2xl font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Аналізуємо...
                    </>
                  ) : (
                    <>
                      <span>Аналізувати</span>
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </motion.div>
            )}
          </section>

          {/* Current Result */}
          <AnimatePresence mode="wait">
            {currentDecision && (
              <motion.section
                key={currentDecision.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-8 pb-20"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-medium text-gray-900 line-clamp-1 max-w-2xl">{currentDecision.query}</h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(currentDecision.timestamp).toLocaleString('uk-UA')}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="group relative">
                      <button className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors shadow-sm text-sm font-medium">
                        <Download className="w-4 h-4" />
                        <span>Зберегти</span>
                      </button>
                      <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                        <button 
                          onClick={() => exportToWord(currentDecision)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 rounded-xl text-left text-sm transition-colors text-gray-700"
                        >
                          <FileText className="w-4 h-4 text-blue-500" />
                          <span>Документ Word</span>
                        </button>
                        <button 
                          onClick={() => exportToPDF(currentDecision)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-rose-50 rounded-xl text-left text-sm transition-colors text-gray-700"
                        >
                          <FileDown className="w-4 h-4 text-rose-500" />
                          <span>Документ PDF</span>
                        </button>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => setCurrentDecision(null)}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <Plus className="w-5 h-5 rotate-45" />
                    </button>
                  </div>
                </div>

                {/* Analysis Grids */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Pros & Cons */}
                  <div className="bg-white p-6 rounded-3xl border border-emerald-100/50 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 text-emerald-600 font-semibold mb-2">
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Переваги (Pros)</span>
                    </div>
                    <ul className="space-y-3">
                      {currentDecision.analysis.prosCons.pros.map((item, idx) => (
                        <li key={idx} className="flex gap-3 text-sm leading-relaxed text-gray-700">
                          <span className="text-emerald-500 font-bold">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-rose-100/50 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 text-rose-600 font-semibold mb-2">
                        <AlertCircle className="w-5 h-5" />
                        <span>Недоліки (Cons)</span>
                    </div>
                    <ul className="space-y-3">
                      {currentDecision.analysis.prosCons.cons.map((item, idx) => (
                        <li key={idx} className="flex gap-3 text-sm leading-relaxed text-gray-700">
                          <span className="text-rose-400 font-bold">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* SWOT Analysis */}
                <div className="bg-[#1A1A1A] text-white p-8 rounded-[40px] shadow-2xl relative overflow-hidden group">
                   {/* Background element */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-white/10 transition-colors" />
                  
                  <div className="relative z-10 space-y-8">
                    <div className="flex items-center gap-3">
                      <div className="bg-white/10 p-2 rounded-xl backdrop-blur-sm">
                        <Maximize2 className="w-5 h-5" />
                      </div>
                      <h4 className="text-xl font-medium">SWOT Аналіз</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-12">
                      <SWOTGrid 
                        title="Strengths (Сильні сторони)" 
                        items={currentDecision.analysis.swot.strengths} 
                        color="text-emerald-400" 
                      />
                      <SWOTGrid 
                        title="Weaknesses (Слабкі сторони)" 
                        items={currentDecision.analysis.swot.weaknesses} 
                        color="text-amber-400" 
                      />
                      <SWOTGrid 
                        title="Opportunities (Можливості)" 
                        items={currentDecision.analysis.swot.opportunities} 
                        color="text-blue-400" 
                      />
                      <SWOTGrid 
                        title="Threats (Загрози)" 
                        items={currentDecision.analysis.swot.threats} 
                        color="text-rose-400" 
                      />
                    </div>
                  </div>
                </div>

                {/* Comparison Table if it exists */}
                {currentDecision.analysis.comparison && (
                  <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-gray-50 flex items-center gap-2 bg-gray-50/50">
                      <div className="bg-indigo-100 p-1.5 rounded-lg">
                        <Info className="w-4 h-4 text-indigo-600" />
                      </div>
                      <h4 className="font-medium">Порівняльна таблиця</h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="bg-gray-50/30">
                            {currentDecision.analysis.comparison.headers.map((h, i) => (
                              <th key={i} className="px-6 py-4 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {currentDecision.analysis.comparison.rows.map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50/20 transition-colors">
                              {row.map((cell, j) => (
                                <td key={j} className="px-6 py-4 text-gray-700 leading-relaxed">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div className="bg-indigo-50 border border-indigo-100 p-8 rounded-[32px] space-y-4">
                  <h4 className="text-lg font-semibold text-indigo-900">Підсумок та рекомендація</h4>
                  <p className="text-indigo-800 leading-relaxed text-lg italic">
                    "{currentDecision.analysis.summary}"
                  </p>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: History Sidebar */}
        <AnimatePresence>
          {showHistory && (
            <motion.aside
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="lg:col-span-4 space-y-6"
            >
              <div className="sticky top-[88px] max-h-[calc(100vh-120px)] flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Ваша історія</h2>
                  <button 
                    onClick={() => setDecisions([])}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors uppercase font-bold tracking-tight"
                  >
                    Очистити все
                  </button>
                </div>

                <div className="overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                  {decisions.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                      <p className="text-sm text-gray-400">Тут поки порожньо</p>
                    </div>
                  ) : (
                    decisions.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => {
                          setCurrentDecision(d);
                          if (window.innerWidth < 1024) setShowHistory(false);
                        }}
                        className={cn(
                          "w-full text-left p-4 rounded-2xl border transition-all group relative",
                          currentDecision?.id === d.id 
                            ? "bg-[#1A1A1A] text-white border-black" 
                            : "bg-white border-gray-100 hover:border-gray-300"
                        )}
                      >
                        <div className="flex flex-col gap-1 pr-8">
                          <span className="text-sm font-medium line-clamp-2 leading-snug">
                            {d.query}
                          </span>
                          <span className={cn(
                            "text-[10px] uppercase font-bold tracking-wider",
                            currentDecision?.id === d.id ? "text-gray-400" : "text-gray-400"
                          )}>
                            {new Date(d.timestamp).toLocaleDateString('uk-UA')}
                          </span>
                        </div>
                        <div 
                          onClick={(e) => deleteDecision(d.id, e)}
                          className={cn(
                            "absolute top-4 right-4 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity",
                            currentDecision?.id === d.id ? "hover:bg-white/10 text-white" : "hover:bg-red-50 text-gray-400 hover:text-red-500"
                          )}
                        >
                          <Trash2 className="w-4 h-4" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Welcome (if no history and no analysis) */}
      {!currentDecision && decisions.length === 0 && !isAnalyzing && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 text-center space-y-2 pointer-events-none">
          <div className="bg-white px-6 py-3 rounded-full border border-gray-100 shadow-xl inline-flex items-center gap-2">
            <Sparkles className="text-amber-500 w-4 h-4" />
            <span className="text-sm font-medium">Ваше перше рішення чекає на аналіз</span>
          </div>
        </div>
      )}
    </div>
  );
}

function SWOTGrid({ title, items, color }: { title: string; items: string[], color: string }) {
  return (
    <div className="space-y-4">
      <h5 className={cn("text-xs font-bold uppercase tracking-[0.2em]", color)}>
        {title}
      </h5>
      <ul className="space-y-2.5">
        {items.map((item, idx) => (
          <li key={idx} className="text-sm text-gray-400 leading-relaxed">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
