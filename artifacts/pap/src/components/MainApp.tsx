import React, { useState, useEffect, useRef, useCallback } from "react";
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
  getGetSummaryQueryKey,
  getListNodesQueryKey,
  getGetProgressQueryKey,
  getListAchievementsQueryKey,
  getListNotesQueryKey,
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
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export function MainApp() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeNodeCode, setActiveNodeCode] = useState<string | null>(null);
  const [mirrored, setMirrored] = useState(false);
  const [inverted, setInverted] = useState(false);
  const [newAchievement, setNewAchievement] = useState<{ title: string; type: string } | null>(null);

  const { data: progress } = useGetProgress();

  const handleNodeOpen = (code: string) => {
    setActiveNodeCode(code);
  };

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
      <TopBar
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        exploredCount={progress?.openedNodes.length ?? 0}
      />

      <div className="flex-1 relative overflow-hidden flex">
        <SpaceTree activeNodeCode={activeNodeCode} onNodeOpen={handleNodeOpen} />
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
            onNodeOpen={handleNodeOpen}
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

function StarField() {
  const stars = Array.from({ length: 80 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    opacity: Math.random() * 0.6 + 0.2,
    duration: Math.random() * 4 + 2,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map((s) => (
        <motion.div
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            opacity: s.opacity,
          }}
          animate={{ opacity: [s.opacity, s.opacity * 0.3, s.opacity] }}
          transition={{ duration: s.duration, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function TopBar({
  menuOpen,
  setMenuOpen,
  exploredCount,
}: {
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
  exploredCount: number;
}) {
  return (
    <div
      className="h-14 flex items-center justify-between px-5 z-10 border-b border-white/10"
      style={{ background: "hsl(var(--background) / 0.85)", backdropFilter: "blur(12px)" }}
    >
      <div className="flex items-center gap-3">
        <motion.div
          className="w-9 h-9 rounded-full border-2 border-primary flex items-center justify-center cursor-pointer"
          style={{ boxShadow: "0 0 18px hsl(var(--primary) / 0.6)", background: "hsl(var(--primary) / 0.15)" }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="w-3 h-3 rounded-full bg-primary" style={{ animation: "pulse 2s ease-in-out infinite" }} />
        </motion.div>
        <span className="text-primary tracking-widest font-bold text-xs uppercase">Conhecimento</span>
      </div>

      <div className="flex items-center gap-3">
        <AnimatePresence mode="wait">
          <motion.span
            key={menuOpen ? "full" : "short"}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="font-bold tracking-[0.18em] text-base"
          >
            {menuOpen ? "Projeto Aliança Panorama" : "PAP"}
          </motion.span>
        </AnimatePresence>
        <motion.button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 rounded-full transition-colors"
          style={{ background: "hsl(var(--primary) / 0.1)" }}
          whileHover={{ scale: 1.1, background: "hsl(var(--primary) / 0.2)" }}
          whileTap={{ scale: 0.9 }}
          data-testid="button-menu-toggle"
        >
          <Menu className="w-5 h-5 text-primary" />
        </motion.button>
      </div>
    </div>
  );
}

function SpaceTree({
  activeNodeCode,
  onNodeOpen,
}: {
  activeNodeCode: string | null;
  onNodeOpen: (code: string) => void;
}) {
  // Root-level fetch (parentCode=null) returns node "0"
  const { data: rootNodes, isLoading } = useListNodes();
  const openNodeMutation = useOpenNode();
  const queryClient = useQueryClient();
  const { data: progress } = useGetProgress();

  // Level-1 children of root "0"
  const { data: level1Nodes } = useListNodes(
    { parentCode: "0" },
    { query: { queryKey: getListNodesQueryKey({ parentCode: "0" }) } }
  );

  // When user expands a level-1 node, fetch its children
  const [expandedL1, setExpandedL1] = useState<string | null>(null);
  const { data: level2Nodes } = useListNodes(
    expandedL1 ? { parentCode: expandedL1 } : undefined,
    { query: { enabled: !!expandedL1, queryKey: getListNodesQueryKey({ parentCode: expandedL1 ?? "" }) } }
  );

  const handleNodeClick = (code: string) => {
    onNodeOpen(code);
    openNodeMutation.mutate(
      { code },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProgressQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListAchievementsQueryKey() });
        },
      }
    );
  };

  const rootNode = rootNodes?.[0];

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <motion.div
          className="w-16 h-16 rounded-full border-2 border-primary/50"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 relative overflow-auto z-0 flex flex-col items-center justify-center gap-5 p-6">
      {/* Root orb */}
      {rootNode && (
        <NodeOrb
          node={rootNode}
          onClick={() => handleNodeClick(rootNode.code)}
          isActive={activeNodeCode === rootNode.code}
          isOpened={progress?.openedNodes.includes(rootNode.code) ?? false}
          isRead={progress?.readNodes.includes(rootNode.code) ?? false}
          size="lg"
        />
      )}

      {/* Level-1 children */}
      {level1Nodes && level1Nodes.length > 0 && (
        <div className="flex flex-wrap justify-center gap-8 max-w-3xl">
          {level1Nodes.map((child) => (
            <div key={child.code} className="flex flex-col items-center gap-4">
              <NodeOrb
                node={child}
                onClick={() => {
                  handleNodeClick(child.code);
                  setExpandedL1(expandedL1 === child.code ? null : child.code);
                }}
                isActive={activeNodeCode === child.code}
                isOpened={progress?.openedNodes.includes(child.code) ?? false}
                isRead={progress?.readNodes.includes(child.code) ?? false}
                size="md"
              />

              {/* Level-2 grandchildren */}
              {expandedL1 === child.code && level2Nodes && level2Nodes.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap justify-center gap-3"
                >
                  {level2Nodes.map((grandchild) => (
                    <NodeOrb
                      key={grandchild.code}
                      node={grandchild}
                      onClick={() => handleNodeClick(grandchild.code)}
                      isActive={activeNodeCode === grandchild.code}
                      isOpened={progress?.openedNodes.includes(grandchild.code) ?? false}
                      isRead={progress?.readNodes.includes(grandchild.code) ?? false}
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

function NodeOrb({
  node,
  onClick,
  isActive,
  isOpened,
  isRead,
  size = "md",
}: {
  node: KNode;
  onClick: () => void;
  isActive: boolean;
  isOpened: boolean;
  isRead: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const sizeMap = {
    sm: "w-12 h-12",
    md: "w-16 h-16",
    lg: "w-20 h-20",
  };
  const textMap = { sm: "text-xs", md: "text-sm", lg: "text-base" };
  const labelMap = { sm: "text-xs max-w-[80px]", md: "text-sm max-w-[100px]", lg: "text-base max-w-[130px]" };

  const glowColor = isRead
    ? "hsl(var(--accent) / 0.8)"
    : isOpened
    ? "hsl(var(--primary) / 0.8)"
    : "hsl(var(--secondary) / 0.4)";

  const borderClass = isRead
    ? "border-accent"
    : isOpened
    ? "border-primary"
    : "border-secondary/40";

  const bgClass = isRead
    ? "bg-accent/15"
    : isOpened
    ? "bg-primary/15"
    : "bg-secondary/5";

  return (
    <motion.div className="flex flex-col items-center gap-2">
      <motion.button
        onClick={onClick}
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.92 }}
        className={`${sizeMap[size]} rounded-full flex items-center justify-center border-2 ${borderClass} ${bgClass} relative transition-all duration-300`}
        style={{ boxShadow: `0 0 ${isActive ? 30 : 14}px ${glowColor}` }}
        data-testid={`node-orb-${node.code}`}
      >
        {isActive && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-primary"
            animate={{ scale: [1, 1.3, 1], opacity: [1, 0, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
        <span className={`font-bold ${textMap[size]} text-white`}>{node.code}</span>
        {isRead && (
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
            <Star className="w-2 h-2 text-white" />
          </div>
        )}
        {node.childCount > 0 && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-primary/80 flex items-center justify-center text-[9px] font-bold text-white">
            {node.childCount}
          </div>
        )}
      </motion.button>
      <span className={`${labelMap[size]} font-medium tracking-wide text-center text-white/80 leading-tight`}>
        {node.title}
      </span>
    </motion.div>
  );
}

function Totem() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.div
      className="absolute right-3 top-1/2 z-10"
      style={{ translateY: "-50%" }}
      animate={{ y: collapsed ? 80 : 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
    >
      <div
        className="w-20 rounded-xl overflow-hidden border border-white/15 shadow-2xl"
        style={{ background: "hsl(var(--background) / 0.9)", backdropFilter: "blur(12px)" }}
      >
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="w-full py-2 flex justify-center border-b border-white/10 hover:bg-white/5 transition-colors"
          data-testid="button-totem-toggle"
        >
          {collapsed ? (
            <ChevronDown className="w-4 h-4 text-white/50" />
          ) : (
            <ChevronUp className="w-4 h-4 text-white/50" />
          )}
        </button>

        {!collapsed && (
          <>
            <div
              className="h-20 border-b border-white/10 flex items-center justify-center p-2 text-center"
              style={{ background: "hsl(var(--primary) / 0.2)" }}
            >
              <span className="text-xs font-bold text-primary tracking-widest uppercase">Promo</span>
            </div>
            <div
              className="h-20 border-b border-white/10 flex items-center justify-center p-2 text-center"
              style={{ background: "hsl(var(--secondary) / 0.2)" }}
            >
              <span className="text-xs font-bold text-secondary tracking-widest uppercase">Ads</span>
            </div>
            <div
              className="h-20 flex items-center justify-center p-2 text-center"
              style={{ background: "hsl(var(--accent) / 0.2)" }}
            >
              <span className="text-xs font-bold text-accent tracking-widest uppercase">Store</span>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

function SpaceshipDashboard({ activeNodeCode }: { activeNodeCode: string | null }) {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<"notes" | "calc" | "radio">("notes");

  const { data: progress } = useGetProgress();
  const { data: notes, refetch: refetchNotes } = useListNotes(
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
        updateNote.mutate(
          { id: editingNoteId, data: { content: val } },
          { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() }) }
        );
      }
    }, 800);
  };

  const handleNewNote = () => {
    createNote.mutate(
      { data: { nodeCode: activeNodeCode ?? undefined, content: noteContent || "" } },
      {
        onSuccess: (note) => {
          setEditingNoteId(note.id);
          queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
        },
      }
    );
  };

  const handleDeleteNote = (id: number) => {
    deleteNote.mutate(
      { id },
      {
        onSuccess: () => {
          if (editingNoteId === id) {
            setEditingNoteId(null);
            setNoteContent("");
          }
          queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
        },
      }
    );
  };

  const exploredNodes = progress?.openedNodes ?? [];

  return (
    <div
      className="h-32 border-t border-white/15 flex items-stretch px-3 py-3 gap-3 z-20 relative"
      style={{ background: "hsl(var(--background) / 0.95)", backdropFilter: "blur(16px)" }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.6), transparent)" }}
      />

      {/* Left headlight - Map */}
      <motion.button
        onClick={() => setLeftOpen(true)}
        className="w-24 h-24 rounded-full flex flex-col items-center justify-center gap-1 border-4 border-muted relative overflow-hidden shrink-0"
        style={{
          background: "radial-gradient(circle, hsl(var(--primary) / 0.15) 0%, black 70%)",
          boxShadow: "inset 0 0 20px rgba(255,255,255,0.05)",
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        data-testid="button-map-open"
      >
        <Globe className="w-7 h-7 text-primary" />
        <span className="text-[9px] text-primary/70 uppercase tracking-widest font-bold">Mapa</span>
      </motion.button>

      {/* Center console */}
      <div
        className="flex-1 rounded-xl border border-white/10 flex flex-col overflow-hidden"
        style={{ background: "rgba(0,0,0,0.5)" }}
      >
        <div className="flex justify-center gap-2 p-2 border-b border-white/10">
          {(
            [
              { key: "notes", Icon: FileText },
              { key: "calc", Icon: Calculator },
              { key: "radio", Icon: Radio },
            ] as const
          ).map(({ key, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTool(key)}
              className="p-1.5 rounded-lg transition-all"
              style={{
                background:
                  activeTool === key ? "hsl(var(--primary) / 0.3)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${activeTool === key ? "hsl(var(--primary) / 0.6)" : "transparent"}`,
              }}
              data-testid={`button-tool-${key}`}
            >
              <Icon className={`w-4 h-4 ${activeTool === key ? "text-primary" : "text-white/40"}`} />
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden">
          {activeTool === "notes" && (
            <div className="h-full flex flex-col p-2 gap-1">
              <div className="flex gap-1 overflow-x-auto pb-1 shrink-0">
                {(notes ?? []).slice(0, 4).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      setEditingNoteId(n.id);
                      setNoteContent(n.content);
                    }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] shrink-0 border border-white/10 hover:border-primary/50 transition-colors"
                    style={{
                      background:
                        editingNoteId === n.id ? "hsl(var(--primary) / 0.15)" : "rgba(255,255,255,0.04)",
                    }}
                    data-testid={`note-tab-${n.id}`}
                  >
                    <span className="max-w-[60px] truncate text-white/70">
                      {n.content.slice(0, 20) || "Nota"}
                    </span>
                    <Trash2
                      className="w-2.5 h-2.5 text-white/30 hover:text-red-400 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNote(n.id);
                      }}
                    />
                  </button>
                ))}
                <button
                  onClick={handleNewNote}
                  className="px-2 py-0.5 rounded text-[10px] border border-dashed border-white/20 hover:border-primary/50 text-white/40 hover:text-primary transition-colors shrink-0"
                  data-testid="button-new-note"
                >
                  + Nova
                </button>
              </div>
              <textarea
                value={noteContent}
                onChange={(e) => handleNoteChange(e.target.value)}
                className="flex-1 bg-transparent resize-none outline-none text-xs text-white/80 placeholder:text-white/25 leading-relaxed"
                placeholder={
                  activeNodeCode
                    ? `Anotacoes sobre ${activeNodeCode}...`
                    : "Diario do explorador..."
                }
                data-testid="textarea-notes"
              />
            </div>
          )}
          {activeTool === "calc" && (
            <div className="h-full flex items-center justify-center text-white/30 text-xs">
              Calculadora — em breve
            </div>
          )}
          {activeTool === "radio" && (
            <div className="h-full flex items-center justify-center text-white/30 text-xs">
              Radio espacial — em breve
            </div>
          )}
        </div>
      </div>

      {/* Right headlight - Social */}
      <motion.button
        onClick={() => setRightOpen(true)}
        className="w-24 h-24 rounded-full flex flex-col items-center justify-center gap-1 border-4 border-muted relative overflow-hidden shrink-0"
        style={{
          background: "radial-gradient(circle, hsl(var(--secondary) / 0.15) 0%, black 70%)",
          boxShadow: "inset 0 0 20px rgba(255,255,255,0.05)",
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        data-testid="button-social-open"
      >
        <User className="w-7 h-7 text-secondary" />
        <span className="text-[9px] text-secondary/70 uppercase tracking-widest font-bold">Social</span>
      </motion.button>

      {/* Map modal */}
      <AnimatePresence>
        {leftOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            className="absolute bottom-36 left-3 w-72 h-72 rounded-full flex flex-col items-center justify-center border-2 border-primary/60 shadow-2xl overflow-hidden z-30"
            style={{
              background: "hsl(var(--background) / 0.97)",
              boxShadow: "0 0 40px hsl(var(--primary) / 0.4)",
            }}
          >
            <button
              onClick={() => setLeftOpen(false)}
              className="absolute top-8 right-8 text-white/40 hover:text-white text-sm"
              data-testid="button-map-close"
            >
              <X className="w-4 h-4" />
            </button>
            <Globe className="w-10 h-10 text-primary mb-3" />
            <p className="text-sm font-bold text-primary tracking-widest uppercase mb-2">Mapa de Exploração</p>
            <div className="flex flex-wrap justify-center gap-1 px-12">
              {exploredNodes.slice(0, 12).map((code) => (
                <span
                  key={code}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-primary/40 text-primary/80"
                >
                  {code}
                </span>
              ))}
              {exploredNodes.length === 0 && (
                <span className="text-white/40 text-xs text-center">
                  Explore nos para construir seu mapa
                </span>
              )}
            </div>
            <p className="absolute bottom-10 text-[10px] text-white/40">
              {exploredNodes.length} nos explorados
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Social modal */}
      <AnimatePresence>
        {rightOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            className="absolute bottom-36 right-3 w-72 h-72 rounded-full flex flex-col items-center justify-center border-2 border-secondary/60 shadow-2xl overflow-hidden z-30"
            style={{
              background: "hsl(var(--background) / 0.97)",
              boxShadow: "0 0 40px hsl(var(--secondary) / 0.4)",
            }}
          >
            <button
              onClick={() => setRightOpen(false)}
              className="absolute top-8 right-8 text-white/40 hover:text-white"
              data-testid="button-social-close"
            >
              <X className="w-4 h-4" />
            </button>
            <User className="w-10 h-10 text-secondary mb-3" />
            <p className="text-sm font-bold text-secondary tracking-widest uppercase mb-1">Area Social</p>
            <p className="text-[11px] text-white/50 text-center px-14 leading-relaxed">
              Saia de casa e estude com amigos. O conhecimento cresce quando compartilhado.
            </p>
            <p className="absolute bottom-10 text-[10px] text-white/30">Em desenvolvimento</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuPanel({
  onClose,
  onMirror,
  onInvert,
}: {
  onClose: () => void;
  onMirror: () => void;
  onInvert: () => void;
}) {
  const { data: summary } = useGetSummary();
  const { data: achievements } = useListAchievements();

  const earnedAchievements = (achievements ?? []).filter((a) => a.earned);

  return (
    <motion.div
      initial={{ x: "-100%" }}
      animate={{ x: 0 }}
      exit={{ x: "-100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 220 }}
      className="absolute top-0 left-0 w-72 h-full z-50 flex flex-col border-r border-white/10 shadow-2xl"
      style={{ background: "hsl(var(--background) / 0.97)", backdropFilter: "blur(20px)" }}
    >
      <div className="flex justify-between items-center p-5 border-b border-white/10">
        <h2 className="text-sm font-bold tracking-[0.2em] text-primary uppercase">Menu</h2>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
          data-testid="button-menu-close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-5 flex flex-col gap-5">
        {/* Stats */}
        <div className="p-4 rounded-xl border border-white/10" style={{ background: "rgba(255,255,255,0.03)" }}>
          <h3 className="text-[10px] uppercase tracking-widest text-white/40 mb-3">Exploração</h3>
          <div className="flex justify-between items-end mb-2">
            <span className="text-3xl font-black text-accent">{summary?.explorationPercent ?? 0}%</span>
            <span className="text-xs text-white/40 pb-1">
              {summary?.nodesExplored ?? 0}/{summary?.totalNodes ?? 0} nos
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${summary?.explorationPercent ?? 0}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Badges earned */}
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-white/40 mb-3 flex items-center gap-2">
            <Trophy className="w-3 h-3 text-accent" />
            Insignias ({earnedAchievements.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {earnedAchievements.slice(0, 6).map((a) => (
              <div
                key={a.code}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold"
                style={{
                  borderColor: a.type === "read" ? "hsl(var(--accent))" : "hsl(var(--primary))",
                  color: a.type === "read" ? "hsl(var(--accent))" : "hsl(var(--primary))",
                  background:
                    a.type === "read" ? "hsl(var(--accent) / 0.1)" : "hsl(var(--primary) / 0.1)",
                }}
                data-testid={`badge-${a.code}`}
              >
                {a.type === "read" ? (
                  <BookOpen className="w-2.5 h-2.5" />
                ) : (
                  <Eye className="w-2.5 h-2.5" />
                )}
                {a.nodeCode}
              </div>
            ))}
            {earnedAchievements.length === 0 && (
              <span className="text-[11px] text-white/30">Explore nos para ganhar insignias</span>
            )}
          </div>
        </div>

        {/* Options */}
        <div className="mt-auto flex flex-col gap-2">
          <button
            onClick={onInvert}
            className="w-full py-3 rounded-xl text-xs font-bold tracking-widest uppercase transition-colors border border-white/10 hover:bg-white/5"
            data-testid="button-invert-colors"
          >
            Inverter Cores
          </button>
          <button
            onClick={onMirror}
            className="w-full py-3 rounded-xl text-xs font-bold tracking-widest uppercase transition-colors border border-white/10 hover:bg-white/5"
            data-testid="button-mirror-display"
          >
            Espelhar Tela
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function NodeModal({
  code,
  onClose,
  onNodeOpen,
  onAchievementEarned,
}: {
  code: string;
  onClose: () => void;
  onNodeOpen: (code: string) => void;
  onAchievementEarned: (title: string, type: string) => void;
}) {
  const { data: node, isLoading } = useGetNode(code, {
    query: { queryKey: getListNodesQueryKey({ parentCode: code }) },
  });
  const readNodeMutation = useReadNode();
  const openNodeMutation = useOpenNode();
  const queryClient = useQueryClient();
  const { data: progress } = useGetProgress();
  const hasRead = progress?.readNodes.includes(code) ?? false;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasRead) {
        readNodeMutation.mutate(
          { code },
          {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: getGetProgressQueryKey() });
              queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
              queryClient.invalidateQueries({ queryKey: getListAchievementsQueryKey() });
              onAchievementEarned(`Leitor: ${code}`, "read");
            },
          }
        );
      }
    }, 30000);
    return () => clearTimeout(timer);
  }, [code, hasRead]);

  const handleChildClick = (childCode: string) => {
    onClose();
    setTimeout(() => onNodeOpen(childCode), 200);
    openNodeMutation.mutate({ code: childCode }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProgressQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
      },
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/70 z-40 flex items-center justify-center p-8"
      style={{ backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.88, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.88, y: 24 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="w-full max-w-lg max-h-[80vh] rounded-3xl flex flex-col relative overflow-hidden shadow-2xl"
        style={{ background: "#ffffff" }}
        onClick={(e) => e.stopPropagation()}
        data-testid="node-modal"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors z-10"
          style={{ color: "rgba(0,0,0,0.5)" }}
          data-testid="button-node-modal-close"
        >
          <X className="w-4 h-4" />
        </button>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <motion.div
              className="w-10 h-10 rounded-full border-2 border-primary"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
          </div>
        ) : node ? (
          <>
            <div className="px-8 pt-8 pb-4 border-b border-black/8">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-xs font-bold tracking-widest uppercase px-2 py-0.5 rounded"
                  style={{ background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}
                >
                  {code}
                </span>
                {hasRead && (
                  <span
                    className="text-xs font-bold tracking-widest uppercase px-2 py-0.5 rounded flex items-center gap-1"
                    style={{ background: "hsl(var(--accent) / 0.12)", color: "hsl(var(--accent))" }}
                  >
                    <Star className="w-2.5 h-2.5" />
                    Lido
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-black text-black mt-1 leading-tight">{node.title}</h2>
              {node.subtitle && (
                <p className="text-sm text-black/55 font-medium mt-1">{node.subtitle}</p>
              )}
            </div>

            <div className="flex-1 overflow-auto px-8 py-6">
              {node.content && (
                <p className="text-sm text-black/75 leading-relaxed mb-6">{node.content}</p>
              )}
              {!node.content && (
                <p className="text-sm text-black/40 italic">Conteudo em desenvolvimento...</p>
              )}
            </div>

            {node.children && node.children.length > 0 && (
              <div className="px-8 pb-8 border-t border-black/8 pt-4">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-3">
                  Ramos filhos
                </h4>
                <div className="flex flex-wrap gap-2">
                  {node.children.map((child) => (
                    <motion.button
                      key={child.code}
                      onClick={() => handleChildClick(child.code)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all border"
                      style={{
                        background: "hsl(var(--primary) / 0.08)",
                        borderColor: "hsl(var(--primary) / 0.3)",
                        color: "hsl(var(--primary))",
                      }}
                      data-testid={`child-node-${child.code}`}
                    >
                      {child.code} — {child.title}
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

function AchievementToast({ title, type }: { title: string; type: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 40, scale: 0.9 }}
      className="absolute bottom-40 left-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl border shadow-2xl"
      style={{
        translateX: "-50%",
        background: "hsl(var(--background) / 0.98)",
        borderColor: type === "read" ? "hsl(var(--accent) / 0.6)" : "hsl(var(--primary) / 0.6)",
        boxShadow:
          type === "read"
            ? "0 0 30px hsl(var(--accent) / 0.3)"
            : "0 0 30px hsl(var(--primary) / 0.3)",
      }}
      data-testid="achievement-toast"
    >
      <Trophy className="w-5 h-5" style={{ color: type === "read" ? "hsl(var(--accent))" : "hsl(var(--primary))" }} />
      <div>
        <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Insignia Conquistada</p>
        <p className="text-sm font-bold text-white">{title}</p>
      </div>
    </motion.div>
  );
}
