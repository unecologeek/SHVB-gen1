
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Match, AppConfig, VisualType, ConnectionSource, DB_SOURCE } from './types';
import VisualPreview from './components/VisualPreview';
import EditorPanel from './components/EditorPanel';
import TeamDatabaseManager from './components/TeamDatabaseManager';
import * as htmlToImage from 'html-to-image';
import { tryConnectAiven, tryConnectSupabase } from './lib/database-helpers';
import { DatabaseAdapter, createDatabaseAdapter } from './lib/db-adapter';
import { useLocalCache } from './hooks/useLocalCache';
import { ToastProvider } from './components/Toast';

interface TeamData {
  id?: string;
  name: string;
  logo: string;
  is_local?: boolean;
}

const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>({
    visualType: 'results',
    title: 'RÉSULTATS',
    subtitle: 'SEMAINE 51',
    resultsBg: '',
    category: 'PRÉ NATIONALE MASCULINE',
    matchDate: 'DIM. 01 FÉV - 15:00',
    location: 'COMPLEXE SPORTIF DEMIANNAY',
    previewBg: '',
    victoryBg: '',
    mainColor: '#F58220',
    liveColor: '#FFD700',
    showSlideIndicator: false,
    totalSlides: 3,
    currentSlide: 1,
    paginationMarginTop: undefined,
    paginationMarginBottom: undefined,
    paginationPaddingTop: undefined,
    paginationPaddingBottom: undefined,
  });

  const [configLoaded, setConfigLoaded] = useState(false);
  const [activeSource, setActiveSource] = useState<ConnectionSource>(DB_SOURCE.LOCAL);
  const [dbErrorMessage, setDbErrorMessage] = useState<string | null>(null);
  const [victoryPhoto, setVictoryPhoto] = useState<string>('');
  const [availableTeams, setAvailableTeams] = useState<TeamData[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [showDatabase, setShowDatabase] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [scale, setScale] = useState(1);
  const [matches, setMatches] = useState<Match[]>([]);

  const previewRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cache = useLocalCache();
  /** Cache des logos par id pour éviter de recréer les références et recharger les images à chaque affichage. */
  const logoCacheRef = useRef<Record<string, string>>({});

  const localTeam = useMemo(() => availableTeams.find(t => t.is_local), [availableTeams]);
  const currentDimensions = useMemo(() => config.visualType === 'victory' ? { width: 1080, height: 1920 } : { width: 1080, height: 1080 }, [config.visualType]);

  /** Liste avec logos issus du cache quand inchangés, pour éviter de recharger les images à chaque rendu. */
  const teamsWithCachedLogos = useMemo(() => {
    return availableTeams.map(t => {
      const cached = t.id ? logoCacheRef.current[t.id] : undefined;
      return cached !== undefined && cached === t.logo ? { ...t, logo: cached } : t;
    });
  }, [availableTeams]);

  const updateScale = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const padding = 0.92;
    const newScale = Math.min((clientWidth * padding) / currentDimensions.width, (clientHeight * padding) / currentDimensions.height);
    setScale(newScale);
  }, [currentDimensions]);

  useEffect(() => {
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [updateScale, showDatabase, config.visualType]);

  const loadFromCache = useCallback(() => {
    const { config: cachedConfig, teams: cachedTeams } = cache.loadAll();
    if (cachedConfig) setConfig(cachedConfig);
    if (cachedTeams) {
      cachedTeams.forEach((t: TeamData) => { if (t.id && t.logo) logoCacheRef.current[t.id] = t.logo; });
      setAvailableTeams(cachedTeams);
    }
    return !!cachedConfig;
  }, [cache]);

  const fetchTeams = useCallback(async (source: ConnectionSource, adapter?: DatabaseAdapter) => {
    setLoadingTeams(true);
    console.log(`🔄 [${source}] Tentative de chargement des clubs...`);
    try {
      if (source === 'AIVEN' || source === 'SUPABASE') {
        const dbAdapter = adapter ?? createDatabaseAdapter(source);
        const teams = await dbAdapter.getTeams(source === 'AIVEN' ? { noLogos: true } : undefined);
        teams.forEach(t => { if (t.id && t.logo) logoCacheRef.current[t.id] = t.logo; });
        setAvailableTeams(prev => {
          if (prev.length === teams.length && teams.every((t, i) => t.id === prev[i]?.id && t.name === prev[i]?.name && t.logo === prev[i]?.logo && t.is_local === prev[i]?.is_local)) return prev;
          return teams;
        });
        console.log(`✅ [${source}] ${teams.length} clubs récupérés.`);
        return true;
      }
      return false;
    } catch (err: any) {
      console.error(`❌ [${source}] Erreur lors de la récupération des clubs:`, {
        message: err.message,
        code: err.code || err.status,
        type: err.type || 'Unknown'
      });
      return false;
    } finally {
      setLoadingTeams(false);
    }
  }, []);

  const loadingLogoIdsRef = useRef<Set<string>>(new Set());
  const loadTeamLogo = useCallback(async (id: string) => {
    if (!id || logoCacheRef.current[id]) return;
    if (loadingLogoIdsRef.current.has(id)) return;
    if (activeSource !== 'AIVEN' && activeSource !== 'SUPABASE') return;
    loadingLogoIdsRef.current.add(id);
    try {
      const adapter = createDatabaseAdapter(activeSource);
      const team = await adapter.getTeam(id);
      if (team?.logo) {
        logoCacheRef.current[id] = team.logo;
        setAvailableTeams(prev => prev.map(t => t.id === id ? { ...t, logo: team.logo } : t));
      }
    } finally {
      loadingLogoIdsRef.current.delete(id);
    }
  }, [activeSource]);

  const loadAll = useCallback(async () => {
    console.log("🚀 Initialisation du Studio...");

    // 1. TENTER AIVEN (PostgreSQL)
    console.log("📡 [AIVEN] Tentative de connexion...");
    const aivenResult = await tryConnectAiven(config);
    if (aivenResult) {
      console.log("✅ [AIVEN] Connexion réussie.");
      setConfig(aivenResult.config);
      aivenResult.teams.forEach(t => { if (t.id && t.logo) logoCacheRef.current[t.id] = t.logo; });
      setAvailableTeams(aivenResult.teams);
      setActiveSource(DB_SOURCE.AIVEN);
      cache.saveAll(aivenResult.config, aivenResult.teams);
      setConfigLoaded(true);
      return;
    }

    // 2. TENTER SUPABASE
    console.log("📡 [SUPABASE] Tentative de connexion...");
    const supabaseResult = await tryConnectSupabase(config);
    if (supabaseResult) {
      console.log("✅ [SUPABASE] Connexion réussie.");
      setConfig(supabaseResult.config);
      supabaseResult.teams.forEach(t => { if (t.id && t.logo) logoCacheRef.current[t.id] = t.logo; });
      setAvailableTeams(supabaseResult.teams);
      setActiveSource(DB_SOURCE.SUPABASE);
      cache.saveAll(supabaseResult.config, supabaseResult.teams);
      setConfigLoaded(true);
      return;
    }

    // 3. CACHE LOCAL OU JSON
    console.log("🏠 Basculement en mode Local/Cache...");
    if (loadFromCache()) {
      setActiveSource(DB_SOURCE.CACHE);
      setDbErrorMessage("Connexion cloud impossible. Utilisation des données locales du navigateur.");
    } else {
      setActiveSource(DB_SOURCE.LOCAL);
      const res = await fetch('teams.json').catch(() => null);
      if (res?.ok) {
        const localData = await res.json();
        (localData as TeamData[]).forEach(t => { if (t.id && t.logo) logoCacheRef.current[t.id] = t.logo; });
        setAvailableTeams(localData);
        console.log("✅ [LOCAL] Données teams.json chargées.");
      }
    }
    setConfigLoaded(true);
  // Exécuter uniquement au montage : ne pas re-déprendre de config pour éviter de recharger
  // la config depuis l’API après un changement de visuel (Résultats / Affiche / Victoire).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (availableTeams.length > 0 && matches.length === 0) {
      const team = localTeam || availableTeams[0];
      setMatches([{ id: '1', league: 'DIVISION', team1: { name: team.name, logo: team.logo }, team2: { name: 'ADVERSAIRE', logo: '' }, score1: 0, score2: 0, isLive: false }]);
      cache.saveAll(config, availableTeams);
    }
  }, [availableTeams, localTeam, config, cache]);

  // Préchargement des logos en arrière-plan (liste initiale sans logos pour Aiven)
  useEffect(() => {
    if (activeSource !== 'AIVEN' && activeSource !== 'SUPABASE') return;
    const withoutLogo = availableTeams.filter(t => t.id && !t.logo);
    withoutLogo.slice(0, 20).forEach(t => loadTeamLogo(t.id!));
  }, [activeSource, availableTeams, loadTeamLogo]);

  const handleExport = async () => {
    if (!previewRef.current) return;
    setIsExporting(true);
    try {
      await document.fonts.ready;
      await document.fonts.load("115px 'Bebas Neue'");
      const dataUrl = await htmlToImage.toPng(previewRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement('a');
      link.download = `shvb-${config.visualType}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed', err);
      alert("Erreur lors de l'exportation. Vérifiez la console pour plus de détails.");
    } finally {
      setIsExporting(false);
    }
  };

  if (!configLoaded) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-950 text-white gap-8">
        <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin shadow-[0_0_30px_rgba(249,115,22,0.3)]"></div>
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm font-black uppercase tracking-[0.4em] animate-pulse text-orange-500">Vérification des accès</span>
          <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest text-center max-w-xs">{'Aiven > Supabase > LocalStorage'}</span>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="h-screen flex flex-col md:flex-row bg-[#F0F2F5] overflow-hidden">
      <div className="w-full md:w-[480px] h-[50vh] md:h-screen flex flex-col bg-white border-r border-gray-200 z-20 shadow-2xl shrink-0 overflow-y-auto custom-scrollbar">
        <div className="p-8 flex flex-col gap-12">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <div className="w-14 h-14 bg-orange-600 rounded-2xl flex items-center justify-center shadow-xl transform rotate-3 shrink-0">
                 <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              </div>
              <div className="flex flex-col justify-center min-w-0 flex-1">
                <span className="text-2xl font-[900] text-gray-900 uppercase italic tracking-tighter leading-tight block break-words">Studio</span>
                <span className="text-lg font-[800] text-gray-600 uppercase tracking-tight leading-tight block break-words" title={localTeam?.name || 'CLUB'}>{localTeam?.name || 'CLUB'}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
                <div
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full border transition-all cursor-help group relative ${
                  activeSource === DB_SOURCE.AIVEN ? 'bg-teal-50 border-teal-200 shadow-sm' :
                  activeSource === DB_SOURCE.SUPABASE ? 'bg-green-50 border-green-200' :
                  'bg-orange-50 border-orange-200'
                }`}
              >
                <div className={`w-3 h-3 rounded-full animate-pulse ${activeSource === DB_SOURCE.AIVEN ? 'bg-teal-500' : activeSource === DB_SOURCE.SUPABASE ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                <span className={`text-[12px] font-black uppercase tracking-widest ${activeSource === DB_SOURCE.AIVEN ? 'text-teal-700' : activeSource === DB_SOURCE.SUPABASE ? 'text-green-700' : 'text-orange-700'}`}>
                  {activeSource}
                </span>
                <div className="absolute top-full right-0 mt-4 w-80 bg-gray-900 text-white p-6 rounded-[32px] shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] border border-white/10 pointer-events-none">
                  <p className="text-xs font-black uppercase mb-4 text-orange-400 tracking-wider">Statut Connexion :</p>
                  <div className="text-xs leading-relaxed font-bold bg-white/5 p-4 rounded-2xl border border-white/5 italic">
                    {dbErrorMessage || `Source active : ${activeSource}. Toutes les modifications sont synchronisées.`}
                  </div>
                </div>
              </div>
              <button onClick={() => setShowDatabase(!showDatabase)} className={`p-3.5 rounded-2xl transition-all shadow-sm ${showDatabase ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} title="Clubs & Logos">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
            </div>
          </div>

          {showDatabase && (
            <div className="animate-in slide-in-from-top-8 duration-500">
              <TeamDatabaseManager
                onTeamsChange={(newTeams) => {
                  if (newTeams?.length) {
                    newTeams.forEach(t => { if (t.id && t.logo) logoCacheRef.current[t.id] = t.logo; });
                    setAvailableTeams(prev => [...prev, ...newTeams]);
                  } else {
                    fetchTeams(activeSource);
                  }
                }}
                onSetLocalTeam={(teamId) => {
                  setAvailableTeams(prev => {
                    const next = prev.map(t => ({ ...t, is_local: t.id === teamId }));
                    cache.saveAll(config, next);
                    return next;
                  });
                }}
                availableTeams={teamsWithCachedLogos}
                loadingTeams={loadingTeams}
                activeSource={activeSource}
                loadTeamLogo={loadTeamLogo}
              />
            </div>
          )}

          <EditorPanel config={config} setConfig={setConfig} matches={matches} setMatches={setMatches} availableTeams={teamsWithCachedLogos} victoryPhoto={victoryPhoto} setVictoryPhoto={setVictoryPhoto} activeSource={activeSource} loadTeamLogo={loadTeamLogo} />
          
          <button 
            disabled={isExporting} 
            onClick={handleExport}
            className="w-full bg-black hover:bg-orange-600 disabled:bg-gray-400 text-white font-[900] py-8 px-6 rounded-[40px] transition-all shadow-xl flex flex-col items-center justify-center gap-2 transform active:scale-95"
          >
            <span className="text-2xl uppercase tracking-tighter">{isExporting ? 'Exportation...' : 'Télécharger l\'image'}</span>
            <span className="text-xs opacity-60 font-black tracking-[0.3em] uppercase">Générer le PNG haute qualité</span>
          </button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 relative overflow-hidden preview-area bg-[#D1D5DB] flex items-center justify-center p-12">
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center', width: `${currentDimensions.width}px`, height: `${currentDimensions.height}px` }} className="shadow-[0_100px_200px_-50px_rgba(0,0,0,0.7)] shrink-0 bg-white rounded-sm overflow-hidden">
          <VisualPreview ref={previewRef} config={config} matches={matches} victoryPhoto={victoryPhoto} />
        </div>
      </div>
    </div>
    </ToastProvider>
  );
};

export default App;
