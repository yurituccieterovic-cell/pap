import React, { useState, useEffect, useRef } from "react";
import {
  useGetSummary,
  useListNodes,
  useGetNode,
  useGetProgress,
  useOpenNode,
  useReadNode,
  useListNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  useListAchievements,
  useGetDailyActivity,
  getGetSummaryQueryKey,
  getListNodesQueryKey,
  getGetProgressQueryKey,
  getListAchievementsQueryKey,
  getListNotesQueryKey,
  getGetDailyActivityQueryKey,
} from "@workspace/api-client-react";
import type { Node as KNode } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  FileText,
  Calculator,
  Radio,
  ChevronUp,
  ChevronDown,
  User,
  Globe,
  X,
  Star,
  Trophy,
  BookOpen,
  Eye,
  Trash2,
  GitBranch,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export function MainApp() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeNodeCode, setActiveNodeCode] = useState<string | null>(null);
  const [mirrored, setMirrored] = useState(false);
  const [inverted, setInverted] = useState(false);
  const [newAchievement, setNewAchievement] = useState<{ title: string; type: string } | null>(null);

  const { data: progress } = useGetProgress();

  const handleAchievementEarned = (title: string, type: string) => {
    setNewAchievement({ title, type });
    setTimeout(() => setNewAchievement(null), 3500);
  };

  return (
    <div
      className="flex flex-col h-full w-full relative overflow-hidden"
      style={{
        transform: mirrored ? "scaleX(-1)" : undefined,
        filter: inverted ? "invert(1)" : undefined,
      }}
    >
      <StarField />
      <TopBar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      <div className="flex-1 relative overflow-hidden flex">
        <SpaceTree activeNodeCode={activeNodeCode} onNodeOpen={setActiveNodeCode} />
        <Totem />
      </div>

      <SpaceshipDashboard activeNodeCode={activeNodeCode} />

      <AnimatePresence>
        {menuOpen && (
          <MenuPanel
            onClose={() => setMenuOpen(false)}
            onMirror={() => setMirrored((v) => !v)}
            onInvert={() => setInverted((v) => !v)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeNodeCode && (
          <NodeModal
            code={activeNodeCode}
            onClose={() => setActiveNodeCode(null)}
            onNodeOpen={setActiveNodeCode}
            onAchievementEarned={handleAchievementEarned}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {newAchievement && (
          <AchievementToast title={newAchievement.title} type={newAchievement.type} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Star field ─────────────────────────────────────────────────────────── */
const STARS = Array.from({ length: 90 }, (_, i) => ({
  id: i,
  x: (i * 37.1) % 100,
  y: (i * 53.7) % 100,
  size: (i % 3) * 0.7 + 0.6,
  opacity: ((i % 5) + 2) / 10,
  dur: (i % 4) + 2.5,
}));

function StarField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {STARS.map((s) => (
        <motion.div
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, opacity: s.opacity }}
          animate={{ opacity: [s.opacity, s.opacity * 0.25, s.opacity] }}
          transition={{ duration: s.dur, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

/* ─── Top bar ────────────────────────────────────────────────────────────── */
function TopBar({ menuOpen, setMenuOpen }: { menuOpen: boolean; setMenuOpen: (v: boolean) => void }) {
  return (
    <div
      className="h-14 flex items-center justify-between px-5 z-10 border-b border-white/10 shrink-0"
      style={{ background: "hsl(var(--background) / 0.85)", backdropFilter: "blur(12px)" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-full border-2 border-primary flex items-center justify-center"
          style={{ boxShadow: "0 0 18px hsl(var(--primary) / 0.6)", background: "hsl(var(--primary) / 0.15)" }}
        >
          <motion.div
            className="w-3 h-3 rounded-full bg-primary"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
        <span className="text-primary tracking-widest font-bold text-xs uppercase">Conhecimento</span>
      </div>

      <div className="flex items-center gap-3">
        <AnimatePresence mode="wait">
          <motion.span
            key={menuOpen ? "full" : "short"}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="font-bold tracking-[0.18em] text-base"
          >
            {menuOpen ? "Projeto Aliança Panorama" : "PAP"}
          </motion.span>
        </AnimatePresence>
        <motion.button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 rounded-full"
          style={{ background: "hsl(var(--primary) / 0.12)" }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <Menu className="w-5 h-5 text-primary" />
        </motion.button>
      </div>
    </div>
  );
}

/* ─── Space Tree ─────────────────────────────────────────────────────────── */
function SpaceTree({ activeNodeCode, onNodeOpen }: { activeNodeCode: string | null; onNodeOpen: (c: string) => void }) {
  const { data: rootNodes, isLoading } = useListNodes();
  const { data: level1Nodes } = useListNodes(
    { parentCode: "0" },
    { query: { queryKey: getListNodesQueryKey({ parentCode: "0" }) } }
  );

  const [expandedL1, setExpandedL1] = useState<string | null>(null);
  const { data: level2Nodes } = useListNodes(
    expandedL1 ? { parentCode: expandedL1 } : undefined,
    { query: { enabled: !!expandedL1, queryKey: getListNodesQueryKey({ parentCode: expandedL1 ?? "" }) } }
  );

  const openNodeMutation = useOpenNode();
  const queryClient = useQueryClient();
  const { data: progress } = useGetProgress();

  const handleNodeOpen = (code: string) => {
    onNodeOpen(code);
    openNodeMutation.mutate({ code }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProgressQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAchievementsQueryKey() });
      },
    });
  };

  const rootNode = rootNodes?.[0];

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <motion.div className="w-14 h-14 rounded-full border-2 border-primary/50" animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} />
      </div>
    );
  }

  return (
    <div className="flex-1 relative overflow-auto z-0 flex flex-col items-center justify-center gap-5 p-6">
      {rootNode && (
        <NodeOrb
          node={rootNode}
          onClick={() => handleNodeOpen(rootNode.code)}
          onExpand={undefined}
          isActive={activeNodeCode === rootNode.code}
          isOpened={progress?.openedNodes.includes(rootNode.code) ?? false}
          isRead={progress?.readNodes.includes(rootNode.code) ?? false}
          size="lg"
        />
      )}

      {level1Nodes && level1Nodes.length > 0 && (
        <div className="flex flex-wrap justify-center gap-8 max-w-3xl">
          {level1Nodes.map((child) => (
            <div key={child.code} className="flex flex-col items-center gap-3">
              <NodeOrb
                node={child}
                onClick={() => handleNodeOpen(child.code)}
                onExpand={child.childCount > 0 ? () => setExpandedL1(expandedL1 === child.code ? null : child.code) : undefined}
                isActive={activeNodeCode === child.code}
                isOpened={progress?.openedNodes.includes(child.code) ?? false}
                isRead={progress?.readNodes.includes(child.code) ?? false}
                size="md"
                isExpanded={expandedL1 === child.code}
              />

              {expandedL1 === child.code && level2Nodes && level2Nodes.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap justify-center gap-3"
                >
                  {level2Nodes.map((gc) => (
                    <NodeOrb
                      key={gc.code}
                      node={gc}
                      onClick={() => handleNodeOpen(gc.code)}
                      onExpand={undefined}
                      isActive={activeNodeCode === gc.code}
                      isOpened={progress?.openedNodes.includes(gc.code) ?? false}
                      isRead={progress?.readNodes.includes(gc.code) ?? false}
                      size="sm"
                    />
                  ))}
                </motion.div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Node Orb ───────────────────────────────────────────────────────────── */
function NodeOrb({
  node, onClick, onExpand, isActive, isOpened, isRead, size = "md", isExpanded,
}: {
  node: KNode;
  onClick: () => void;
  onExpand: (() => void) | undefined;
  isActive: boolean;
  isOpened: boolean;
  isRead: boolean;
  size?: "sm" | "md" | "lg";
  isExpanded?: boolean;
}) {
  const dim = size === "lg" ? "w-20 h-20" : size === "md" ? "w-16 h-16" : "w-12 h-12";
  const textSize = size === "lg" ? "text-sm" : size === "md" ? "text-xs" : "text-[10px]";
  const labelWidth = size === "lg" ? "max-w-[130px]" : size === "md" ? "max-w-[100px]" : "max-w-[80px]";

  const glowColor = isRead
    ? "hsl(var(--accent) / 0.8)"
    : isOpened
    ? "hsl(var(--primary) / 0.8)"
    : "hsl(var(--secondary) / 0.35)";
  const border = isRead ? "border-accent" : isOpened ? "border-primary" : "border-secondary/40";
  const bg = isRead ? "bg-accent/15" : isOpened ? "bg-primary/15" : "bg-secondary/5";

  const label = node.abbreviation ?? node.title.slice(0, 4);

  return (
    <div className="flex flex-col items-center gap-2 relative">
      <div className="relative">
        <motion.button
          onClick={onClick}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.93 }}
          className={`${dim} rounded-full flex items-center justify-center border-2 ${border} ${bg} relative`}
          style={{ boxShadow: `0 0 ${isActive ? 28 : 12}px ${glowColor}` }}
          title={node.title}
        >
          {isActive && (
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-primary"
              animate={{ scale: [1, 1.35, 1], opacity: [0.8, 0, 0.8] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
          )}
          <span className={`font-bold ${textSize} text-white leading-none px-1 text-center`}>{label}</span>
          {isRead && (
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
              <Star className="w-2 h-2 text-white" />
            </div>
          )}
        </motion.button>

        {/* Broto (sprout) — expand children button */}
        {onExpand && (
          <motion.button
            onClick={(e) => { e.stopPropagation(); onExpand(); }}
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center border border-primary/60 z-10"
            style={{ background: isExpanded ? "hsl(var(--primary) / 0.5)" : "hsl(var(--primary) / 0.2)" }}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.85 }}
            title="Expandir ramos filhos"
          >
            <GitBranch className="w-2.5 h-2.5 text-primary" />
          </motion.button>
        )}

        {node.childCount > 0 && !onExpand && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-primary/80 flex items-center justify-center text-[9px] font-bold text-white">
            {node.childCount}
          </div>
        )}
      </div>
      <span className={`text-xs font-medium tracking-wide text-center text-white/75 leading-tight ${labelWidth} mt-1`}>
        {node.title}
      </span>
    </div>
  );
}

/* ─── Totem ──────────────────────────────────────────────────────────────── */
function Totem() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
      <motion.div
        className="w-20 rounded-xl overflow-hidden border border-white/15 shadow-2xl"
        style={{ background: "hsl(var(--background) / 0.9)", backdropFilter: "blur(12px)" }}
        animate={{ y: collapsed ? "60%" : 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
      >
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="w-full py-2 flex justify-center border-b border-white/10 hover:bg-white/5 transition-colors"
        >
          {collapsed ? <ChevronDown className="w-4 h-4 text-white/50" /> : <ChevronUp className="w-4 h-4 text-white/50" />}
        </button>
        {!collapsed && (
          <>
            <div className="h-20 border-b border-white/10 flex items-center justify-center p-2" style={{ background: "hsl(var(--primary) / 0.2)" }}>
              <span className="text-[10px] font-bold text-primary tracking-widest uppercase text-center">Promo</span>
            </div>
            <div className="h-20 border-b border-white/10 flex items-center justify-center p-2" style={{ background: "hsl(var(--secondary) / 0.2)" }}>
              <span className="text-[10px] font-bold text-secondary tracking-widest uppercase text-center">Ads</span>
            </div>
            <div className="h-20 flex items-center justify-center p-2" style={{ background: "hsl(var(--accent) / 0.2)" }}>
              <span className="text-[10px] font-bold text-accent tracking-widest uppercase text-center">Store</span>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

/* ─── Spaceship Dashboard ────────────────────────────────────────────────── */
function SpaceshipDashboard({ activeNodeCode }: { activeNodeCode: string | null }) {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<"notes" | "calc" | "radio">("notes");

  const { data: progress } = useGetProgress();
  const { data: notes } = useListNotes(
    activeNodeCode ? { nodeCode: activeNodeCode } : undefined,
    { query: { queryKey: getListNotesQueryKey(activeNodeCode ? { nodeCode: activeNodeCode } : undefined) } }
  );
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const queryClient = useQueryClient();

  const [noteContent, setNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNoteChange = (val: string) => {
    setNoteContent(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (editingNoteId) {
        updateNote.mutate({ id: editingNoteId, data: { content: val } }, {
          onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() }),
        });
      }
    }, 800);
  };

  const handleNewNote = () => {
    createNote.mutate({ data: { nodeCode: activeNodeCode ?? undefined, content: "" } }, {
      onSuccess: (note) => {
        setEditingNoteId(note.id);
        setNoteContent("");
        queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
      },
    });
  };

  const handleDeleteNote = (id: number) => {
    deleteNote.mutate({ id }, {
      onSuccess: () => {
        if (editingNoteId === id) { setEditingNoteId(null); setNoteContent(""); }
        queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
      },
    });
  };

  const exploredNodes = progress?.openedNodes ?? [];

  return (
    <div
      className="h-32 border-t border-white/15 flex items-stretch px-3 py-3 gap-3 z-20 relative shrink-0"
      style={{ background: "hsl(var(--background) / 0.96)", backdropFilter: "blur(16px)" }}
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg,transparent,hsl(var(--primary)/0.6),transparent)" }} />

      {/* Left headlight — Map */}
      <motion.button
        onClick={() => setLeftOpen(true)}
        className="w-24 h-24 rounded-full flex flex-col items-center justify-center gap-1 border-4 border-muted overflow-hidden shrink-0"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)/0.15) 0%, black 70%)", boxShadow: "inset 0 0 20px rgba(255,255,255,0.05)" }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Globe className="w-7 h-7 text-primary" />
        <span className="text-[9px] text-primary/70 uppercase tracking-widest font-bold">Mapa</span>
      </motion.button>

      {/* Center console */}
      <div className="flex-1 rounded-xl border border-white/10 flex flex-col overflow-hidden" style={{ background: "rgba(0,0,0,0.5)" }}>
        <div className="flex justify-center gap-2 p-2 border-b border-white/10">
          {([{ key: "notes" as const, Icon: FileText }, { key: "calc" as const, Icon: Calculator }, { key: "radio" as const, Icon: Radio }]).map(({ key, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTool(key)}
              className="p-1.5 rounded-lg transition-all"
              style={{ background: activeTool === key ? "hsl(var(--primary)/0.3)" : "rgba(255,255,255,0.04)", border: `1px solid ${activeTool === key ? "hsl(var(--primary)/0.6)" : "transparent"}` }}
            >
              <Icon className={`w-4 h-4 ${activeTool === key ? "text-primary" : "text-white/40"}`} />
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden">
          {activeTool === "notes" && (
            <div className="h-full flex flex-col p-2 gap-1">
              <div className="flex gap-1 overflow-x-auto pb-1 shrink-0">
                {(notes ?? []).slice(0, 5).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => { setEditingNoteId(n.id); setNoteContent(n.content); }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] shrink-0 border border-white/10 hover:border-primary/50 transition-colors"
                    style={{ background: editingNoteId === n.id ? "hsl(var(--primary)/0.15)" : "rgba(255,255,255,0.04)" }}
                  >
                    <span className="max-w-[55px] truncate text-white/70">{n.content.slice(0, 18) || "Nota"}</span>
                    <Trash2 className="w-2.5 h-2.5 text-white/30 hover:text-red-400 shrink-0" onClick={(e) => { e.stopPropagation(); handleDeleteNote(n.id); }} />
                  </button>
                ))}
                <button onClick={handleNewNote} className="px-2 py-0.5 rounded text-[10px] border border-dashed border-white/20 hover:border-primary/50 text-white/40 hover:text-primary transition-colors shrink-0">
                  + Nova
                </button>
              </div>
              <textarea
                value={noteContent}
                onChange={(e) => handleNoteChange(e.target.value)}
                className="flex-1 bg-transparent resize-none outline-none text-xs text-white/80 placeholder:text-white/25 leading-relaxed"
                placeholder={activeNodeCode ? `Anotacoes sobre ${activeNodeCode}...` : "Diario do explorador..."}
              />
            </div>
          )}
          {activeTool === "calc" && <div className="h-full flex items-center justify-center text-white/30 text-xs">Calculadora — em breve</div>}
          {activeTool === "radio" && <div className="h-full flex items-center justify-center text-white/30 text-xs">Radio espacial — em breve</div>}
        </div>
      </div>

      {/* Right headlight — Social */}
      <motion.button
        onClick={() => setRightOpen(true)}
        className="w-24 h-24 rounded-full flex flex-col items-center justify-center gap-1 border-4 border-muted overflow-hidden shrink-0"
        style={{ background: "radial-gradient(circle, hsl(var(--secondary)/0.15) 0%, black 70%)", boxShadow: "inset 0 0 20px rgba(255,255,255,0.05)" }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <User className="w-7 h-7 text-secondary" />
        <span className="text-[9px] text-secondary/70 uppercase tracking-widest font-bold">Social</span>
      </motion.button>

      {/* Map circle */}
      <AnimatePresence>
        {leftOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
            className="absolute bottom-36 left-3 w-72 h-72 rounded-full flex flex-col items-center justify-center border-2 border-primary/60 z-30 overflow-hidden"
            style={{ background: "hsl(var(--background)/0.97)", boxShadow: "0 0 40px hsl(var(--primary)/0.4)" }}
          >
            <button onClick={() => setLeftOpen(false)} className="absolute top-8 right-8 text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
            <Globe className="w-9 h-9 text-primary mb-2" />
            <p className="text-xs font-bold text-primary tracking-widest uppercase mb-2">Mapa de Exploração</p>
            <div className="flex flex-wrap justify-center gap-1 px-14">
              {exploredNodes.slice(0, 16).map((code) => (
                <span key={code} className="text-[10px] px-1.5 py-0.5 rounded border border-primary/40 text-primary/80">{code}</span>
              ))}
              {exploredNodes.length === 0 && <span className="text-white/40 text-[11px] text-center">Explore nos para construir seu mapa</span>}
            </div>
            <p className="absolute bottom-10 text-[10px] text-white/40">{exploredNodes.length} nos explorados</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Social circle */}
      <AnimatePresence>
        {rightOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
            className="absolute bottom-36 right-3 w-72 h-72 rounded-full flex flex-col items-center justify-center border-2 border-secondary/60 z-30 overflow-hidden"
            style={{ background: "hsl(var(--background)/0.97)", boxShadow: "0 0 40px hsl(var(--secondary)/0.4)" }}
          >
            <button onClick={() => setRightOpen(false)} className="absolute top-8 right-8 text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
            <User className="w-9 h-9 text-secondary mb-2" />
            <p className="text-xs font-bold text-secondary tracking-widest uppercase mb-1">Area Social</p>
            <p className="text-[11px] text-white/50 text-center px-14 leading-relaxed">Saia de casa e estude com amigos. O conhecimento cresce quando compartilhado.</p>
            <p className="absolute bottom-10 text-[10px] text-white/30">Em desenvolvimento</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Menu Panel ─────────────────────────────────────────────────────────── */
function MenuPanel({ onClose, onMirror, onInvert }: { onClose: () => void; onMirror: () => void; onInvert: () => void }) {
  const { data: summary } = useGetSummary();
  const { data: achievements } = useListAchievements();
  const { data: dailyActivity } = useGetDailyActivity();
  const [activeTab, setActiveTab] = useState<"stats" | "badges" | "heatmap">("stats");

  const earnedAchievements = (achievements ?? []).filter((a) => a.earned);

  return (
    <motion.div
      initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 220 }}
      className="absolute top-0 left-0 w-72 h-full z-50 flex flex-col border-r border-white/10 shadow-2xl"
      style={{ background: "hsl(var(--background)/0.97)", backdropFilter: "blur(20px)" }}
    >
      <div className="flex justify-between items-center p-5 border-b border-white/10 shrink-0">
        <h2 className="text-sm font-bold tracking-[0.2em] text-primary uppercase">Menu</h2>
        <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition-colors"><X className="w-4 h-4" /></button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 shrink-0">
        {([
          { key: "stats", label: "Status" },
          { key: "heatmap", label: "Calendario" },
          { key: "badges", label: "Insignias" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className="flex-1 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-colors"
            style={{ color: activeTab === key ? "hsl(var(--primary))" : "rgba(255,255,255,0.35)", borderBottom: activeTab === key ? "2px solid hsl(var(--primary))" : "2px solid transparent" }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-5">
        {activeTab === "stats" && (
          <div className="flex flex-col gap-5">
            <div className="p-4 rounded-xl border border-white/10" style={{ background: "rgba(255,255,255,0.03)" }}>
              <h3 className="text-[10px] uppercase tracking-widest text-white/40 mb-3">Exploração</h3>
              <div className="flex justify-between items-end mb-2">
                <span className="text-3xl font-black text-accent">{summary?.explorationPercent ?? 0}%</span>
                <span className="text-xs text-white/40 pb-1">{summary?.nodesExplored ?? 0}/{summary?.totalNodes ?? 0} nos</span>
              </div>
              <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${summary?.explorationPercent ?? 0}%` }} transition={{ duration: 1, ease: "easeOut" }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Lidos", val: summary?.nodesRead ?? 0, color: "text-accent" },
                { label: "Insignias", val: summary?.achievementsEarned ?? 0, color: "text-primary" },
              ].map(({ label, val, color }) => (
                <div key={label} className="p-3 rounded-xl border border-white/10 flex flex-col" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <span className="text-[10px] text-white/40 uppercase tracking-widest">{label}</span>
                  <span className={`text-2xl font-black ${color} mt-1`}>{val}</span>
                </div>
              ))}
            </div>

            <div className="mt-auto flex flex-col gap-2 pt-4 border-t border-white/10">
              <button onClick={onInvert} className="w-full py-2.5 rounded-xl text-[11px] font-bold tracking-widest uppercase border border-white/10 hover:bg-white/5 transition-colors">Inverter Cores</button>
              <button onClick={onMirror} className="w-full py-2.5 rounded-xl text-[11px] font-bold tracking-widest uppercase border border-white/10 hover:bg-white/5 transition-colors">Espelhar Tela</button>
            </div>
          </div>
        )}

        {activeTab === "heatmap" && (
          <ActivityHeatmap dailyActivity={dailyActivity ?? []} />
        )}

        {activeTab === "badges" && (
          <div className="flex flex-col gap-3">
            <p className="text-[11px] text-white/40">{earnedAchievements.length} de {(achievements ?? []).length} conquistadas</p>
            <div className="flex flex-col gap-2">
              {earnedAchievements.map((a) => (
                <div
                  key={a.code}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl border"
                  style={{
                    borderColor: a.type === "read" ? "hsl(var(--accent)/0.4)" : "hsl(var(--primary)/0.4)",
                    background: a.type === "read" ? "hsl(var(--accent)/0.07)" : "hsl(var(--primary)/0.07)",
                  }}
                >
                  {a.type === "read" ? <BookOpen className="w-4 h-4 text-accent shrink-0" /> : <Eye className="w-4 h-4 text-primary shrink-0" />}
                  <div>
                    <p className="text-xs font-bold text-white">{a.title}</p>
                    <p className="text-[10px] text-white/40">{a.description}</p>
                  </div>
                </div>
              ))}
              {earnedAchievements.length === 0 && (
                <div className="text-center py-8">
                  <Trophy className="w-10 h-10 text-white/15 mx-auto mb-3" />
                  <p className="text-xs text-white/35">Explore nos para conquistar insignias</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Activity Heatmap ───────────────────────────────────────────────────── */
function ActivityHeatmap({ dailyActivity }: { dailyActivity: Array<{ date: string; count: number }> }) {
  const today = new Date();
  const days: Array<{ date: string; count: number; dow: number }> = [];

  for (let i = 90; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const found = dailyActivity.find((a) => a.date === dateStr);
    days.push({ date: dateStr, count: found?.count ?? 0, dow: d.getDay() });
  }

  const maxCount = Math.max(...days.map((d) => d.count), 1);

  const getColor = (count: number) => {
    if (count === 0) return "rgba(255,255,255,0.06)";
    const intensity = Math.min(count / maxCount, 1);
    if (intensity < 0.33) return "hsl(var(--primary)/0.35)";
    if (intensity < 0.66) return "hsl(var(--primary)/0.65)";
    return "hsl(var(--primary))";
  };

  // Group into weeks
  const weeks: typeof days[] = [];
  let currentWeek: typeof days = [];
  days.forEach((d) => {
    if (currentWeek.length === 0 && d.dow !== 0) {
      for (let pad = 0; pad < d.dow; pad++) currentWeek.push({ date: "", count: 0, dow: pad });
    }
    currentWeek.push(d);
    if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
  });
  if (currentWeek.length > 0) weeks.push(currentWeek);

  const totalDays = days.filter((d) => d.count > 0).length;
  const totalNodes = days.reduce((s, d) => s + d.count, 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Atividade — Ultimos 90 dias</h3>
        <div className="flex gap-1.5 text-[10px] text-white/35">
          <span>{totalDays} dias ativos</span>
          <span>·</span>
          <span>{totalNodes} interacoes</span>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day, di) => (
              <div
                key={di}
                className="w-3 h-3 rounded-sm"
                style={{ background: day.date ? getColor(day.count) : "transparent" }}
                title={day.date ? `${day.date}: ${day.count} interacoes` : ""}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] text-white/30">Menos</span>
        {[0, 0.33, 0.66, 1].map((v, i) => (
          <div key={i} className="w-3 h-3 rounded-sm" style={{ background: getColor(Math.round(v * maxCount)) }} />
        ))}
        <span className="text-[10px] text-white/30">Mais</span>
      </div>
    </div>
  );
}

/* ─── Node Modal ─────────────────────────────────────────────────────────── */
function NodeModal({ code, onClose, onNodeOpen, onAchievementEarned }: {
  code: string;
  onClose: () => void;
  onNodeOpen: (code: string) => void;
  onAchievementEarned: (title: string, type: string) => void;
}) {
  const { data: node, isLoading } = useGetNode(code, {
    query: { queryKey: getListNodesQueryKey({ parentCode: code }), enabled: !!code },
  });
  const readNodeMutation = useReadNode();
  const openNodeMutation = useOpenNode();
  const queryClient = useQueryClient();
  const { data: progress } = useGetProgress();
  const hasRead = progress?.readNodes.includes(code) ?? false;

  useEffect(() => {
    if (hasRead) return;
    const t = setTimeout(() => {
      readNodeMutation.mutate({ code }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProgressQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListAchievementsQueryKey() });
          onAchievementEarned(`Leitor: ${node?.title ?? code}`, "read");
        },
      });
    }, 30000);
    return () => clearTimeout(t);
  }, [code, hasRead]);

  const handleChildClick = (childCode: string) => {
    onClose();
    setTimeout(() => {
      onNodeOpen(childCode);
      openNodeMutation.mutate({ code: childCode }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProgressQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
        },
      });
    }, 150);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/70 z-40 flex items-center justify-center p-8"
      style={{ backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.88, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.88, y: 24 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="w-full max-w-lg max-h-[80vh] rounded-3xl flex flex-col relative overflow-hidden shadow-2xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors z-10 text-black/50">
          <X className="w-4 h-4" />
        </button>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <motion.div className="w-10 h-10 rounded-full border-2 border-primary" animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} />
          </div>
        ) : node ? (
          <>
            <div className="px-8 pt-8 pb-4 border-b border-black/8">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded" style={{ background: "hsl(var(--primary)/0.12)", color: "hsl(var(--primary))" }}>
                  {node.abbreviation ?? code}
                </span>
                {hasRead && (
                  <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded flex items-center gap-1" style={{ background: "hsl(var(--accent)/0.12)", color: "hsl(var(--accent))" }}>
                    <Star className="w-2.5 h-2.5" /> Lido
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-black text-black mt-1 leading-tight">{node.title}</h2>
              {node.subtitle && <p className="text-sm text-black/55 font-medium mt-1">{node.subtitle}</p>}
            </div>

            <div className="flex-1 overflow-auto px-8 py-6">
              {node.content ? (
                <p className="text-sm text-black/75 leading-relaxed">{node.content}</p>
              ) : (
                <p className="text-sm text-black/35 italic">Conteudo em desenvolvimento...</p>
              )}
            </div>

            {node.children && node.children.length > 0 && (
              <div className="px-8 pb-8 border-t border-black/8 pt-4">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-3">Ramos filhos</h4>
                <div className="flex flex-wrap gap-2">
                  {node.children.map((child) => (
                    <motion.button
                      key={child.code}
                      onClick={() => handleChildClick(child.code)}
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold border"
                      style={{ background: "hsl(var(--primary)/0.08)", borderColor: "hsl(var(--primary)/0.3)", color: "hsl(var(--primary))" }}
                    >
                      {child.abbreviation ?? child.code} — {child.title}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-64 text-black/40">No encontrado</div>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ─── Achievement Toast ──────────────────────────────────────────────────── */
function AchievementToast({ title, type }: { title: string; type: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.9 }}
      className="absolute bottom-40 left-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl border shadow-2xl"
      style={{
        translateX: "-50%",
        background: "hsl(var(--background)/0.98)",
        borderColor: type === "read" ? "hsl(var(--accent)/0.6)" : "hsl(var(--primary)/0.6)",
        boxShadow: type === "read" ? "0 0 30px hsl(var(--accent)/0.3)" : "0 0 30px hsl(var(--primary)/0.3)",
      }}
    >
      <Trophy className="w-5 h-5" style={{ color: type === "read" ? "hsl(var(--accent))" : "hsl(var(--primary))" }} />
      <div>
        <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Insignia Conquistada</p>
        <p className="text-sm font-bold text-white">{title}</p>
      </div>
    </motion.div>
  );
}
