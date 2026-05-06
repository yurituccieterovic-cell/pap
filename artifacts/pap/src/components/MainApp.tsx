import React, { useState, useEffect, useRef, createContext, useContext } from "react";
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
  useGetMe,
  useLogin,
  useLogout,
  useGetExercises,
  useSubmitAttempt,
  getGetSummaryQueryKey,
  getListNodesQueryKey,
  getGetProgressQueryKey,
  getListAchievementsQueryKey,
  getListNotesQueryKey,
  getGetDailyActivityQueryKey,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import type { Node as KNode, CurrentUser, ExerciseQuestion } from "@workspace/api-client-react";
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
  Lock,
  LogIn,
  LogOut,
  HelpCircle,
  Zap,
  Map,
  Bell,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

/* ─── Auth Context ───────────────────────────────────────────────────────── */
interface AuthCtx {
  user: CurrentUser | null;
  isLoading: boolean;
  refetch: () => void;
}
const AuthContext = createContext<AuthCtx>({ user: null, isLoading: true, refetch: () => {} });
const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useGetMe({
    query: { staleTime: 5 * 60 * 1000, queryKey: getGetMeQueryKey() },
  });
  const user = (data as { user: CurrentUser | null } | undefined)?.user ?? null;
  return (
    <AuthContext.Provider value={{ user, isLoading, refetch: () => { void refetch(); queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() }); } }}>
      {children}
    </AuthContext.Provider>
  );
}

/* ─── Tier helpers ───────────────────────────────────────────────────────── */
const TIER_LABELS = ["Visitante", "Aluno I", "Aluno II", "Aluno III", "Aluno IV", "Dev"];
const TIER_COLORS = [
  "text-white/50",
  "text-primary",
  "text-accent",
  "text-yellow-400",
  "text-orange-400",
  "text-red-400",
];
function tierLabel(tier: number) { return TIER_LABELS[tier] ?? "Visitante"; }
function tierColor(tier: number) { return TIER_COLORS[tier] ?? "text-white/50"; }
function rootCodeForTier(tier: number) { return tier >= 4 ? "0" : "1"; }

/* ─── Main App ───────────────────────────────────────────────────────────── */
export function MainApp() {
  const queryClient = useQueryClient();
  return (
    <AuthProvider>
      <MainAppInner queryClient={queryClient} />
    </AuthProvider>
  );
}

function MainAppInner({ queryClient }: { queryClient: ReturnType<typeof useQueryClient> }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeNodeCode, setActiveNodeCode] = useState<string | null>(null);
  const [exerciseNodeCode, setExerciseNodeCode] = useState<string | null>(null);
  const [mirrored, setMirrored] = useState(false);
  const [inverted, setInverted] = useState(false);
  const [newAchievement, setNewAchievement] = useState<{ title: string; type: string } | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const { user } = useAuth();

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
      <TopBar menuOpen={menuOpen} setMenuOpen={setMenuOpen} onLoginClick={() => setLoginOpen(true)} />

      <div className="flex-1 relative overflow-hidden flex">
        <SpaceTree
          activeNodeCode={activeNodeCode}
          onNodeOpen={setActiveNodeCode}
          userTier={user?.tier ?? 0}
        />
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

      <IsaOwl />

      <AnimatePresence>
        {activeNodeCode && !exerciseNodeCode && (
          <NodeModal
            code={activeNodeCode}
            onClose={() => setActiveNodeCode(null)}
            onNodeOpen={setActiveNodeCode}
            onAchievementEarned={handleAchievementEarned}
            onExercise={(code) => setExerciseNodeCode(code)}
            userTier={user?.tier ?? 0}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {exerciseNodeCode && (
          <ExerciseModal
            nodeCode={exerciseNodeCode}
            onClose={() => setExerciseNodeCode(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {loginOpen && (
          <LoginModal onClose={() => setLoginOpen(false)} />
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
function TopBar({
  menuOpen,
  setMenuOpen,
  onLoginClick,
}: {
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
  onLoginClick: () => void;
}) {
  const { user, refetch } = useAuth();
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        refetch();
      },
    });
  };

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

        {user ? (
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end">
              <span className="text-[11px] font-bold text-white/80">{user.displayName ?? user.login}</span>
              <span className={`text-[9px] font-bold uppercase tracking-widest ${tierColor(user.tier)}`}>
                {tierLabel(user.tier)}
              </span>
            </div>
            <motion.button
              onClick={handleLogout}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
              title="Sair"
              whileTap={{ scale: 0.9 }}
            >
              <LogOut className="w-4 h-4 text-white/50" />
            </motion.button>
          </div>
        ) : (
          <motion.button
            onClick={onLoginClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest border border-primary/50"
            style={{ background: "hsl(var(--primary)/0.12)", color: "hsl(var(--primary))" }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <LogIn className="w-3.5 h-3.5" />
            Entrar
          </motion.button>
        )}

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

/* ─── Login Modal ────────────────────────────────────────────────────────── */
function LoginModal({ onClose }: { onClose: () => void }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { refetch } = useAuth();
  const loginMutation = useLogin();
  const queryClient = useQueryClient();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    loginMutation.mutate(
      { data: { login, password } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          refetch();
          onClose();
        },
        onError: () => {
          setError("Login ou senha incorretos.");
        },
      }
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/70 z-50 flex items-center justify-center p-8"
      style={{ backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.88, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.88, y: 24 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="w-full max-w-sm rounded-3xl flex flex-col overflow-hidden shadow-2xl"
        style={{ background: "hsl(var(--background)/0.98)", border: "1px solid hsl(var(--primary)/0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-7 pt-7 pb-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-black text-white">Entrar no PAP</h2>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full"><X className="w-4 h-4 text-white/50" /></button>
          </div>
          <p className="text-xs text-white/40">Acesse com seu login e senha</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-7">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Login</label>
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="px-3 py-2.5 rounded-xl text-sm text-white outline-none border border-white/15 focus:border-primary/60 transition-colors"
              style={{ background: "rgba(255,255,255,0.05)" }}
              placeholder="ex: aluno1"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="px-3 py-2.5 rounded-xl text-sm text-white outline-none border border-white/15 focus:border-primary/60 transition-colors"
              style={{ background: "rgba(255,255,255,0.05)" }}
              placeholder="••••••"
            />
          </div>

          {error && <p className="text-red-400 text-xs font-medium">{error}</p>}

          <motion.button
            type="submit"
            disabled={loginMutation.isPending}
            className="py-3 rounded-xl font-bold text-sm tracking-widest uppercase"
            style={{ background: "hsl(var(--primary))", color: "white" }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loginMutation.isPending ? "Entrando..." : "Entrar"}
          </motion.button>
        </form>

      </motion.div>
    </motion.div>
  );
}

/* ─── Space Tree ─────────────────────────────────────────────────────────── */
function SpaceTree({
  activeNodeCode,
  onNodeOpen,
  userTier,
}: {
  activeNodeCode: string | null;
  onNodeOpen: (c: string) => void;
  userTier: number;
}) {
  const rootCode = rootCodeForTier(userTier);

  const { data: rootNodeData, isLoading } = useGetNode(rootCode, {
    query: { queryKey: ["nodes", rootCode] },
  });

  const { data: level1Nodes } = useListNodes(
    { parentCode: rootCode },
    { query: { queryKey: getListNodesQueryKey({ parentCode: rootCode }) } }
  );

  const [expandedL1, setExpandedL1] = useState<string | null>(null);
  const { data: level2Nodes } = useListNodes(
    expandedL1 ? { parentCode: expandedL1 } : undefined,
    { query: { enabled: !!expandedL1, queryKey: getListNodesQueryKey({ parentCode: expandedL1 ?? "" }) } }
  );

  const openNodeMutation = useOpenNode();
  const queryClient = useQueryClient();
  const { data: progress } = useGetProgress();

  const handleNodeOpen = (code: string, locked: boolean) => {
    if (locked) return;
    onNodeOpen(code);
    openNodeMutation.mutate({ code }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProgressQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAchievementsQueryKey() });
      },
    });
  };

  const rootNode = rootNodeData
    ? {
        code: rootNodeData.code,
        title: rootNodeData.title,
        abbreviation: rootNodeData.abbreviation ?? null,
        parentCode: rootNodeData.parentCode ?? null,
        childCount: rootNodeData.children?.length ?? 0,
        level: rootNodeData.level,
        locked: false,
      }
    : null;

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
          onClick={() => handleNodeOpen(rootNode.code, false)}
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
                onClick={() => handleNodeOpen(child.code, child.locked ?? false)}
                onExpand={child.childCount > 0 && !(child.locked ?? false)
                  ? () => setExpandedL1(expandedL1 === child.code ? null : child.code)
                  : undefined}
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
                      onClick={() => handleNodeOpen(gc.code, gc.locked ?? false)}
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
  const locked = node.locked ?? false;
  const dim = size === "lg" ? "w-20 h-20" : size === "md" ? "w-16 h-16" : "w-12 h-12";
  const textSize = size === "lg" ? "text-sm" : size === "md" ? "text-xs" : "text-[10px]";
  const labelWidth = size === "lg" ? "max-w-[130px]" : size === "md" ? "max-w-[100px]" : "max-w-[80px]";

  const glowColor = locked
    ? "rgba(255,255,255,0.05)"
    : isRead
    ? "hsl(var(--accent) / 0.8)"
    : isOpened
    ? "hsl(var(--primary) / 0.8)"
    : "hsl(var(--secondary) / 0.35)";
  const border = locked
    ? "border-white/15"
    : isRead
    ? "border-accent"
    : isOpened
    ? "border-primary"
    : "border-secondary/40";
  const bg = locked
    ? "bg-white/3"
    : isRead
    ? "bg-accent/15"
    : isOpened
    ? "bg-primary/15"
    : "bg-secondary/5";

  const label = node.abbreviation ?? node.title.slice(0, 4);

  return (
    <div className="flex flex-col items-center gap-2 relative" title={locked ? "Desbloqueie sua conta para acessar este conteudo" : node.title}>
      <div className="relative">
        <motion.button
          onClick={onClick}
          whileHover={locked ? {} : { scale: 1.1 }}
          whileTap={locked ? {} : { scale: 0.93 }}
          className={`${dim} rounded-full flex items-center justify-center border-2 ${border} ${bg} relative ${locked ? "cursor-not-allowed opacity-40" : ""}`}
          style={{ boxShadow: `0 0 ${isActive ? 28 : 12}px ${glowColor}` }}
        >
          {isActive && !locked && (
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-primary"
              animate={{ scale: [1, 1.35, 1], opacity: [0.8, 0, 0.8] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
          )}
          {locked ? (
            <Lock className="w-4 h-4 text-white/30" />
          ) : (
            <span className={`font-bold ${textSize} text-white leading-none px-1 text-center`}>{label}</span>
          )}
          {isRead && !locked && (
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
              <Star className="w-2 h-2 text-white" />
            </div>
          )}
        </motion.button>

        {onExpand && !locked && (
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

        {node.childCount > 0 && !onExpand && !locked && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-primary/80 flex items-center justify-center text-[9px] font-bold text-white">
            {node.childCount}
          </div>
        )}
      </div>
      <span className={`text-xs font-medium tracking-wide text-center leading-tight ${labelWidth} mt-1 ${locked ? "text-white/25" : "text-white/75"}`}>
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
  const [activeTab, setActiveTab] = useState<"stats" | "badges" | "heatmap" | "guide">("stats");
  const { user } = useAuth();

  const earnedAchievements = (achievements ?? []).filter((a) => a.earned);

  return (
    <motion.div
      initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 220 }}
      className="absolute top-0 left-0 w-72 h-full z-50 flex flex-col border-r border-white/10 shadow-2xl"
      style={{ background: "hsl(var(--background)/0.97)", backdropFilter: "blur(20px)" }}
    >
      <div className="flex justify-between items-center p-5 border-b border-white/10 shrink-0">
        <div>
          <h2 className="text-sm font-bold tracking-[0.2em] text-primary uppercase">Menu</h2>
          {user && (
            <p className={`text-[10px] font-bold mt-0.5 ${tierColor(user.tier)}`}>
              {user.displayName ?? user.login} — {tierLabel(user.tier)}
            </p>
          )}
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition-colors"><X className="w-4 h-4" /></button>
      </div>

      <div className="flex border-b border-white/10 shrink-0">
        {([
          { key: "stats", label: "Status" },
          { key: "heatmap", label: "Calendario" },
          { key: "badges", label: "Insignias" },
          { key: "guide", label: "Guia" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className="flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors"
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

        {activeTab === "guide" && <NavGuide />}
      </div>
    </motion.div>
  );
}

/* ─── Navigation Guide ───────────────────────────────────────────────────── */
function NavGuide() {
  const steps = [
    {
      icon: Map,
      color: "text-primary",
      title: "Árvore do Conhecimento",
      desc: "Os orbes coloridos representam tópicos do FUVEST 2026. Clique num orbe para abrir o conteúdo. Use o botão de ramo para expandir sub-tópicos.",
    },
    {
      icon: Lock,
      color: "text-white/40",
      title: "Níveis de Acesso",
      desc: "Orbes com cadeado estão bloqueados. Faça login com contas de nível maior para acessar mais conteúdo (Aluno I: 4 níveis; Aluno II+: tudo).",
    },
    {
      icon: Zap,
      color: "text-yellow-400",
      title: "Exercícios com IA",
      desc: "Dentro de cada tópico, clique em Praticar para responder 3 questões geradas por IA no estilo FUVEST. Ganhe pontos por acerto!",
    },
    {
      icon: Star,
      color: "text-accent",
      title: "Insígnias e Conquistas",
      desc: "Explore um nó para ganhar a insígnia de Explorador. Leia o conteúdo por 30 segundos para ganhar a insígnia de Leitor.",
    },
    {
      icon: FileText,
      color: "text-secondary",
      title: "Notas do Explorador",
      desc: "Use o console central (painel de notas) para salvar anotações por tópico. Suas notas ficam vinculadas ao nó ativo.",
    },
    {
      icon: Globe,
      color: "text-primary",
      title: "Mapa de Exploração",
      desc: "O farol esquerdo (Mapa) mostra todos os nós que você já explorou. O farol direito (Social) é área comunitária — em breve!",
    },
    {
      icon: Bell,
      color: "text-primary",
      title: "Isa, a Coruja Guia",
      desc: "A corujinha no canto inferior esquerdo é a Isa! Clique nela para tirar dúvidas sobre matérias do FUVEST, dicas de estudo e muito mais.",
    },
    {
      icon: HelpCircle,
      color: "text-white/50",
      title: "Planos e Upgrades",
      desc: "Visitante: 3 níveis | Aluno I: 4 níveis | Aluno II+: acesso total ao FUVEST 2026. Contate o PAP para fazer upgrade da sua conta!",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Guia de Navegação</h3>
        <p className="text-[11px] text-white/50 leading-relaxed">Como usar o Projeto Aliança Panorama</p>
      </div>
      {steps.map((step, i) => (
        <div key={i} className="flex gap-3 items-start p-3 rounded-xl border border-white/8" style={{ background: "rgba(255,255,255,0.02)" }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(255,255,255,0.07)" }}>
            <step.icon className={`w-3.5 h-3.5 ${step.color}`} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-white mb-0.5">{step.title}</p>
            <p className="text-[10px] text-white/45 leading-relaxed">{step.desc}</p>
          </div>
        </div>
      ))}
    </div>
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
function NodeModal({ code, onClose, onNodeOpen, onAchievementEarned, onExercise, userTier }: {
  code: string;
  onClose: () => void;
  onNodeOpen: (code: string) => void;
  onAchievementEarned: (title: string, type: string) => void;
  onExercise: (code: string) => void;
  userTier: number;
}) {
  const { data: node, isLoading } = useGetNode(code, {
    query: { queryKey: ["nodes", code], enabled: !!code },
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

  const canExercise = userTier >= 1;

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

            <div className="px-8 pb-6 border-t border-black/8 pt-4 flex flex-col gap-4">
              {canExercise ? (
                <motion.button
                  onClick={() => { onClose(); onExercise(code); }}
                  className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                  style={{ background: "hsl(var(--primary))", color: "white" }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Zap className="w-4 h-4" />
                  Praticar — 3 Questões
                </motion.button>
              ) : (
                <div className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border border-black/10 text-black/30">
                  <Lock className="w-4 h-4" />
                  Exercicios disponíveis no Aluno I+
                </div>
              )}

              {node.children && node.children.length > 0 && (
                <div>
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
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-64 text-black/40">No encontrado</div>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ─── Exercise Modal ─────────────────────────────────────────────────────── */
function ExerciseModal({ nodeCode, onClose }: { nodeCode: string; onClose: () => void }) {
  const { data: exercises, isLoading, isError } = useGetExercises(
    { nodeCode },
    { query: { queryKey: ["exercises", nodeCode] } }
  );
  const submitAttempt = useSubmitAttempt();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [result, setResult] = useState<{ correct: boolean; correctOption: number; explanation: string | null } | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const questions = (exercises as ExerciseQuestion[] | undefined) ?? [];
  const currentQ = questions[currentIdx];

  const handleSelect = (optionIdx: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(optionIdx);
    if (!currentQ) return;
    submitAttempt.mutate(
      { data: { exerciseId: currentQ.id, selectedOption: optionIdx } },
      {
        onSuccess: (res) => {
          const r = res as { correct: boolean; correctOption: number; explanation: string | null };
          setResult(r);
          if (r.correct) setScore((s) => s + 1);
        },
      }
    );
  };

  const handleNext = () => {
    if (currentIdx + 1 >= questions.length) {
      setFinished(true);
    } else {
      setCurrentIdx((i) => i + 1);
      setSelectedOption(null);
      setResult(null);
    }
  };

  const scoreMsg = score === 3
    ? "Perfeito! Você domina esse tema!"
    : score === 2
    ? "Muito bem! Continue praticando."
    : score === 1
    ? "Bom inicio! Revise o conteúdo e tente de novo."
    : "Não desanime! Releia o tópico e pratique mais.";

  const LETTERS = ["A", "B", "C", "D"];

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
        className="w-full max-w-lg rounded-3xl flex flex-col overflow-hidden shadow-2xl"
        style={{ background: "hsl(var(--background)/0.98)", border: "1px solid hsl(var(--primary)/0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-white/10">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Exercicios FUVEST</span>
            <p className="text-xs text-white/40 mt-0.5">Nó: {nodeCode}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-1.5">
              {questions.map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{ background: i < currentIdx || finished ? "hsl(var(--accent))" : i === currentIdx ? "hsl(var(--primary))" : "rgba(255,255,255,0.2)" }}
                />
              ))}
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full"><X className="w-4 h-4 text-white/50" /></button>
          </div>
        </div>

        <div className="flex-1 p-7">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8">
              <motion.div className="w-10 h-10 rounded-full border-2 border-primary" animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} />
              <p className="text-xs text-white/40">Gerando questões com IA...</p>
            </div>
          ) : isError ? (
            <div className="text-center py-8">
              <p className="text-sm text-white/50">Não foi possível carregar os exercícios.</p>
              <p className="text-xs text-white/30 mt-2">Verifique sua conexão e tente novamente.</p>
            </div>
          ) : finished ? (
            <div className="flex flex-col items-center gap-5 py-4">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black"
                style={{ background: score >= 2 ? "hsl(var(--accent)/0.2)" : "hsl(var(--primary)/0.2)", border: `2px solid ${score >= 2 ? "hsl(var(--accent))" : "hsl(var(--primary))"}` }}
              >
                <span style={{ color: score >= 2 ? "hsl(var(--accent))" : "hsl(var(--primary))" }}>{score}/3</span>
              </div>
              <div className="text-center">
                <p className="text-lg font-black text-white mb-1">{score >= 2 ? "Excelente!" : "Continue tentando!"}</p>
                <p className="text-sm text-white/55 leading-relaxed">{scoreMsg}</p>
              </div>
              <div className="w-full flex gap-3 mt-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl text-sm font-bold border border-white/15 text-white/60 hover:bg-white/5 transition-colors"
                >
                  Fechar
                </button>
                <motion.button
                  onClick={() => { setCurrentIdx(0); setSelectedOption(null); setResult(null); setScore(0); setFinished(false); }}
                  className="flex-1 py-3 rounded-xl text-sm font-bold"
                  style={{ background: "hsl(var(--primary))", color: "white" }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Tentar Novamente
                </motion.button>
              </div>
            </div>
          ) : currentQ ? (
            <div className="flex flex-col gap-5">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Questão {currentIdx + 1} de {questions.length}</p>
                <p className="text-sm font-bold text-white leading-relaxed">{currentQ.question}</p>
              </div>

              <div className="flex flex-col gap-2">
                {(currentQ.options as string[]).map((opt, i) => {
                  const isSelected = selectedOption === i;
                  const isCorrect = result?.correctOption === i;
                  const isWrong = isSelected && result && !result.correct;
                  let bg = "rgba(255,255,255,0.05)";
                  let border = "border-white/15";
                  if (result) {
                    if (isCorrect) { bg = "hsl(var(--accent)/0.2)"; border = "border-accent"; }
                    else if (isWrong) { bg = "rgba(239,68,68,0.15)"; border = "border-red-400"; }
                  } else if (isSelected) {
                    bg = "hsl(var(--primary)/0.2)"; border = "border-primary";
                  }

                  return (
                    <motion.button
                      key={i}
                      onClick={() => handleSelect(i)}
                      disabled={selectedOption !== null}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${selectedOption !== null ? "cursor-default" : "hover:border-primary/50"}`}
                      style={{ background: bg, borderColor: border.replace("border-", "") }}
                      whileHover={selectedOption === null ? { scale: 1.01 } : {}}
                      whileTap={selectedOption === null ? { scale: 0.99 } : {}}
                    >
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0" style={{ background: isSelected ? "hsl(var(--primary))" : "rgba(255,255,255,0.1)", color: "white" }}>
                        {LETTERS[i]}
                      </span>
                      <span className="text-xs text-white/80 leading-relaxed">{opt}</span>
                      {result && isCorrect && <CheckCircle className="w-4 h-4 text-accent ml-auto shrink-0" />}
                      {result && isWrong && <XCircle className="w-4 h-4 text-red-400 ml-auto shrink-0" />}
                    </motion.button>
                  );
                })}
              </div>

              <AnimatePresence>
                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl border"
                    style={{
                      background: result.correct ? "hsl(var(--accent)/0.1)" : "rgba(239,68,68,0.08)",
                      borderColor: result.correct ? "hsl(var(--accent)/0.4)" : "rgba(239,68,68,0.3)",
                    }}
                  >
                    <p className="text-xs font-bold mb-1" style={{ color: result.correct ? "hsl(var(--accent))" : "rgb(239,68,68)" }}>
                      {result.correct ? "Correto!" : "Incorreto!"}
                    </p>
                    {result.explanation && <p className="text-[11px] text-white/60 leading-relaxed">{result.explanation}</p>}
                  </motion.div>
                )}
              </AnimatePresence>

              {result && (
                <motion.button
                  onClick={handleNext}
                  className="w-full py-3 rounded-xl font-bold text-sm"
                  style={{ background: "hsl(var(--primary))", color: "white" }}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {currentIdx + 1 >= questions.length ? "Ver Resultado" : "Próxima Questão"}
                </motion.button>
              )}
            </div>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Isa Owl Mascot ─────────────────────────────────────────────────────── */
function getIsaResponse(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("fuvest")) return "A FUVEST 2026 tem duas fases. A 1ª fase cobre todas as matérias com 90 questões. A 2ª fase tem redação e questões discursivas por área!";
  if (m.includes("física") || m.includes("fisica")) return "Física na FUVEST: Mecânica, Termodinâmica, Óptica, Eletromagnetismo e Física Moderna. Comece pela Mecânica — é a base de tudo!";
  if (m.includes("química") || m.includes("quimica")) return "Química tem muito peso na FUVEST! Foque em Química Orgânica (funções e reações) e Físico-Química (equilíbrio e eletroquímica).";
  if (m.includes("matemát") || m.includes("mat")) return "Matemática: domine Álgebra e Funções primeiro. Geometria e Probabilidade também caem bastante. Pratique com questões antigas!";
  if (m.includes("biolog") || m.includes("bio")) return "Biologia FUVEST: Fisiologia humana e Ecologia têm grande peso. Botânica também é cobrada. Estude os sistemas do corpo com atenção!";
  if (m.includes("histór") || m.includes("hist")) return "História: estude os grandes processos — Revolução Industrial, Imperialismo, Guerras Mundiais, Brasil República e Ditadura Militar.";
  if (m.includes("geograf") || m.includes("geo")) return "Geografia cobre muito: Geopolítica, Urbanização, Biomas brasileiros e Globalização. Mapas e dados estatísticos são frequentes!";
  if (m.includes("filosofia") || m.includes("fil")) return "Filosofia na FUVEST: Platão, Aristóteles, Kant, Marx e Nietzsche são os mais cobrados. Leia os textos filosóficos com calma.";
  if (m.includes("sociolog") || m.includes("soc")) return "Sociologia: Durkheim, Marx e Weber são essenciais. Temas como desigualdade, cultura e trabalho também caem muito.";
  if (m.includes("portugu") || m.includes("port")) return "Português: gramática, interpretação de texto e Literatura são fundamentais. Leia os autores do modernismo brasileiro — Drummond, Guimarães Rosa!";
  if (m.includes("inglês") || m.includes("ingles") || m.includes("ing")) return "Inglês na FUVEST é somente leitura e interpretação. Foque em vocabulário e estrutura de textos em inglês. Não é conversação!";
  if (m.includes("arte")) return "Arte na FUVEST abrange artes visuais, teatro, dança e música. Movimentos artísticos brasileiros e história da arte são os mais cobrados.";
  if (m.includes("dica") || m.includes("estud")) return "Dica de ouro: resolva provas antigas da FUVEST! Isso mostra o padrão das questões. Divida seu tempo por matéria e revise regularmente.";
  if (m.includes("redação") || m.includes("redacao") || m.includes("red")) return "Redação na 2ª fase: texto dissertativo-argumentativo. Tenha uma tese clara, argumentos bem desenvolvidos e uma conclusão propositiva.";
  if (m.includes("oi") || m.includes("olá") || m.includes("ola")) return "Oi! Sou a Isa, sua coruja guia no PAP. Estou aqui para te ajudar com dúvidas sobre matérias da FUVEST. O que quer saber?";
  if (m.includes("obrigad")) return "De nada, explorador! Continue estudando com dedicação. Cada nó que você explora é um passo a mais rumo à USP!";
  if (m.includes("usp")) return "USP é uma das melhores universidades do mundo! A FUVEST é o vestibular exclusivo da USP. Vale cada hora de estudo!";
  return "Boa pergunta! Explore os nós do mapa para aprofundar esse tema. Se quiser dicas sobre uma matéria específica, é só perguntar!";
}

function IsaOwl() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<"flying" | "perched" | "bubble" | "chat">("flying");
  const [wingFlap, setWingFlap] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ who: "isa" | "user"; text: string }>>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const hour = new Date().getHours();
  const name = user?.displayName ?? user?.login ?? "explorador";
  const timeGreet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const greeting = `${timeGreet}, ${name}!`;

  useEffect(() => {
    const t = setTimeout(() => setPhase("perched"), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase !== "perched") return;
    const t = setTimeout(() => setPhase("bubble"), 1400);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleClick = () => {
    if (phase === "perched" || phase === "bubble") {
      setPhase("chat");
    } else if (phase === "chat") {
      setWingFlap(true);
      setTimeout(() => setWingFlap(false), 700);
    }
  };

  const handleChat = (msg: string) => {
    if (!msg.trim()) return;
    const response = getIsaResponse(msg);
    setChatHistory((h) => [
      ...h,
      { who: "user", text: msg },
      { who: "isa", text: response },
    ]);
    setChatInput("");
  };

  const wingAnim = wingFlap
    ? { rotate: [-28, 28, -28, 0] as number[] }
    : { rotate: [0, -4, 0] as number[] };
  const wingTransition = wingFlap
    ? { duration: 0.35, repeat: 1 }
    : { duration: 3, repeat: Infinity, ease: "easeInOut" as const };

  return (
    <div
      className="absolute pointer-events-none"
      style={{ bottom: 132, left: 12, zIndex: 25 }}
    >
      <motion.div
        onClick={handleClick}
        initial={{ y: -280, x: -60, opacity: 0, rotate: -20 }}
        animate={
          phase !== "flying"
            ? { y: 0, x: 0, opacity: 1, rotate: 0 }
            : { y: -280, x: -60, opacity: 0, rotate: -20 }
        }
        transition={{ type: "spring", stiffness: 90, damping: 14, delay: 0.2 }}
        className="relative cursor-pointer pointer-events-auto"
        style={{ width: 48, height: 56 }}
        title="Isa — clique para conversar"
      >
        <motion.div
          className="absolute inset-0"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.div
            className="absolute"
            style={{ top: 16, left: -11, width: 15, height: 24, background: "hsl(var(--primary))", borderRadius: "50% 10% 60% 40%", transformOrigin: "right center", opacity: 0.9 }}
            animate={wingAnim}
            transition={wingTransition}
          />
          <motion.div
            className="absolute"
            style={{ top: 16, right: -11, width: 15, height: 24, background: "hsl(var(--primary))", borderRadius: "10% 50% 40% 60%", transformOrigin: "left center", opacity: 0.9 }}
            animate={wingFlap ? { rotate: [28, -28, 28, 0] as number[] } : { rotate: [0, 4, 0] as number[] }}
            transition={wingTransition}
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, hsl(var(--primary)/0.95) 0%, hsl(var(--primary)/0.6) 100%)", borderRadius: "42% 42% 50% 50%", border: "1.5px solid hsl(var(--primary)/0.7)" }} />
          <div className="absolute" style={{ top: 8, left: 8, right: 8, bottom: 14, background: "rgba(255,255,255,0.13)", borderRadius: "50%" }} />
          <div className="absolute" style={{ top: -5, left: 9, width: 7, height: 9, background: "hsl(var(--primary))", borderRadius: "50% 50% 0 0", transform: "rotate(-15deg)" }} />
          <div className="absolute" style={{ top: -5, right: 9, width: 7, height: 9, background: "hsl(var(--primary))", borderRadius: "50% 50% 0 0", transform: "rotate(15deg)" }} />
          <div className="absolute flex gap-1.5" style={{ top: 12, left: 9 }}>
            <motion.div className="w-4 h-4 rounded-full bg-white flex items-center justify-center shadow-sm" animate={{ scaleY: [1, 0.12, 1] }} transition={{ duration: 4, repeat: Infinity, repeatDelay: 2.5 }}>
              <div className="w-2.5 h-2.5 rounded-full bg-slate-900" />
            </motion.div>
            <motion.div className="w-4 h-4 rounded-full bg-white flex items-center justify-center shadow-sm" animate={{ scaleY: [1, 0.12, 1] }} transition={{ duration: 4, repeat: Infinity, repeatDelay: 2.5 }}>
              <div className="w-2.5 h-2.5 rounded-full bg-slate-900" />
            </motion.div>
          </div>
          <div className="absolute" style={{ top: 24, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "7px solid hsl(45,90%,58%)" }} />
          <div className="absolute flex gap-1.5" style={{ bottom: -5, left: "50%", transform: "translateX(-50%)" }}>
            <div style={{ width: 9, height: 5, background: "hsl(45,90%,58%)", borderRadius: "0 0 5px 5px" }} />
            <div style={{ width: 9, height: 5, background: "hsl(45,90%,58%)", borderRadius: "0 0 5px 5px" }} />
          </div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {phase === "bubble" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6, x: -8 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.6 }}
            className="absolute cursor-pointer pointer-events-auto px-3 py-2 rounded-xl text-[11px] font-bold"
            style={{ bottom: 60, left: 54, whiteSpace: "nowrap", background: "hsl(var(--primary))", color: "white", boxShadow: "0 4px 20px hsl(var(--primary)/0.5)" }}
            onClick={() => setPhase("chat")}
          >
            {greeting}
            <div className="absolute" style={{ bottom: -6, left: 14, width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "6px solid hsl(var(--primary))" }} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "chat" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85, y: 8 }}
            className="absolute flex flex-col rounded-2xl border overflow-hidden pointer-events-auto"
            style={{ bottom: 60, left: 54, width: 224, height: 230, background: "hsl(var(--background)/0.98)", borderColor: "hsl(var(--primary)/0.4)", boxShadow: "0 8px 32px hsl(var(--primary)/0.3)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0" style={{ borderColor: "hsl(var(--primary)/0.2)", background: "hsl(var(--primary)/0.12)" }}>
              <motion.div className="w-5 h-5 rounded-full border border-primary/60" style={{ background: "hsl(var(--primary)/0.3)" }} animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 2, repeat: Infinity }} />
              <span className="text-[10px] font-black tracking-widest text-primary uppercase">Isa</span>
              {user && <span className="text-[10px]" style={{ color: tierColor(user.tier).replace("text-", "") }}>· {tierLabel(user.tier)}</span>}
              <button onClick={() => setPhase("perched")} className="ml-auto text-white/30 hover:text-white transition-colors"><X className="w-3 h-3" /></button>
            </div>

            <div className="flex-1 overflow-auto p-2 flex flex-col gap-1.5">
              {chatHistory.length === 0 && (
                <p className="text-[10px] text-white/40 text-center mt-3 leading-relaxed px-2">
                  {greeting}<br />
                  {user
                    ? `Olá, ${user.displayName ?? user.login}! Como posso ajudar?`
                    : "Pergunte sobre FUVEST, matérias ou dicas!"}
                </p>
              )}
              {chatHistory.map((m, i) => (
                <div key={i} className={`flex ${m.who === "user" ? "justify-end" : "justify-start"}`}>
                  <span className="text-[10px] px-2 py-1.5 rounded-xl max-w-[88%] leading-relaxed" style={{ background: m.who === "isa" ? "hsl(var(--primary)/0.18)" : "hsl(var(--secondary)/0.2)", color: "rgba(255,255,255,0.87)" }}>
                    {m.text}
                  </span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form
              className="flex items-center gap-1.5 px-2 py-2 border-t shrink-0"
              style={{ borderColor: "hsl(var(--primary)/0.18)" }}
              onSubmit={(e) => { e.preventDefault(); handleChat(chatInput); }}
            >
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-transparent text-[10px] text-white outline-none placeholder:text-white/25"
                placeholder="Pergunte à Isa..."
                autoFocus
              />
              <button type="submit" className="text-primary hover:opacity-70 transition-opacity">
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
