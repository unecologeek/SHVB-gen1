
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { AppConfig, Match, VisualType, ConnectionSource } from '../types';
import { DB_SOURCE } from '../types';
import { supabase } from '../lib/supabase';
import { createDatabaseAdapter } from '../lib/db-adapter';
import { validateAndLoadImage, showImageValidationError } from '../lib/image-validation';
import { useLocalCache } from '../hooks/useLocalCache';
import { useToast } from './Toast';
import { isConnectionError, extractErrorMessage } from '../lib/error-utils';

interface TeamData {
  id?: string;
  name: string;
  logo: string;
  is_local?: boolean;
}

interface AutocompleteProps {
  label: string;
  value: string;
  teams: TeamData[];
  onSelect: (team: TeamData) => void;
  align?: 'left' | 'right';
}

const AutocompleteTeamSelect: React.FC<AutocompleteProps> = ({ label, value, teams, onSelect, align = 'left' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sortedTeams = useMemo(() => [...teams].sort((a, b) => a.is_local ? -1 : b.is_local ? 1 : a.name.localeCompare(b.name)), [teams]);
  const filteredTeams = sortedTeams.filter(team => team.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        onClick={() => { setIsOpen(!isOpen); setSearchTerm(''); }}
        className={`w-full text-sm font-black p-4.5 bg-gray-50 border border-gray-200 rounded-[20px] outline-none hover:bg-gray-100 transition-all flex items-center justify-between gap-3 ${align === 'right' ? 'flex-row-reverse text-right' : 'text-left'}`}
      >
        <span className="truncate">{value || label}</span>
        <svg className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
      </button>

      {isOpen && (
        <div className={`absolute z-[100] mt-4 w-[280px] bg-white border border-gray-200 rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${align === 'right' ? 'right-0' : 'left-0'}`}>
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <input
              autoFocus
              type="text"
              placeholder="Chercher un club..."
              className="w-full bg-white text-sm font-bold p-4 rounded-xl border border-gray-200 outline-none focus:border-orange-500 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
            {filteredTeams.length > 0 ? filteredTeams.map((team) => (
              <button key={team.id} onClick={() => { onSelect(team); setIsOpen(false); }} className="w-full flex items-center gap-4 p-4 hover:bg-orange-50 transition-colors text-left group">
                <div className="w-14 h-14 shrink-0 relative">
                  <img src={team.logo} alt="" className="w-full h-full object-contain" />
                  {team.is_local && <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-orange-600 border-2 border-white rounded-full"></div>}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-black uppercase tracking-tight group-hover:text-orange-600 truncate">{team.name}</span>
                  {team.is_local && <span className="text-[11px] text-orange-600 font-black uppercase tracking-widest leading-none mt-1">Club Local</span>}
                </div>
              </button>
            )) : <div className="p-8 text-center text-sm font-bold text-gray-400 uppercase italic">Aucun club</div>}
          </div>
        </div>
      )}
    </div>
  );
};

interface Props {
  config: AppConfig;
  setConfig: React.Dispatch<React.SetStateAction<AppConfig>>;
  matches: Match[];
  setMatches: React.Dispatch<React.SetStateAction<Match[]>>;
  availableTeams: TeamData[];
  victoryPhoto: string;
  setVictoryPhoto: (val: string) => void;
  activeSource: ConnectionSource;
}

const EditorPanel: React.FC<Props> = ({ config, setConfig, matches, setMatches, availableTeams, victoryPhoto, setVictoryPhoto, activeSource }) => {
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSyncRef = useRef<{ config: AppConfig; updates: Partial<AppConfig> } | null>(null);
  const { showToast } = useToast();
  const cache = useLocalCache();
  const localTeam = useMemo(() => availableTeams.find(t => t.is_local), [availableTeams]);

  // Handler pour l'upload d'image de fond
  const handleBackgroundImageUpload = async (file: File | null, visualType: VisualType) => {
    if (!file) return;
    
    setUploadingImage(true);
    try {
      const result = await validateAndLoadImage(file, {
        compress: true,
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.85
      });

      if (!result.valid || !result.dataUrl) {
        showImageValidationError(result.error || 'Erreur de validation');
        return;
      }

      if (visualType === 'results') {
        handleConfigUpdate({ resultsBg: result.dataUrl });
      } else if (visualType === 'preview') {
        handleConfigUpdate({ previewBg: result.dataUrl });
      } else {
        handleConfigUpdate({ victoryBg: result.dataUrl });
      }
    } catch (error: any) {
      showImageValidationError(error.message || 'Erreur lors du chargement de l\'image');
    } finally {
      setUploadingImage(false);
    }
  };

  // Handler pour l'upload de photo de victoire
  const handleVictoryPhotoUpload = async (file: File | null) => {
    if (!file) return;
    
    setUploadingImage(true);
    try {
      const result = await validateAndLoadImage(file, {
        compress: true,
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.85
      });

      if (!result.valid || !result.dataUrl) {
        showImageValidationError(result.error || 'Erreur de validation');
        return;
      }

      setVictoryPhoto(result.dataUrl);
      // Initialiser le focus au centre si pas encore défini
      if (!config.victoryPhotoFocus) {
        handleConfigUpdate({ victoryPhotoFocus: { x: 50, y: 50 } });
      }
    } catch (error: any) {
      showImageValidationError(error.message || 'Erreur lors du chargement de l\'image');
    } finally {
      setUploadingImage(false);
    }
  };

  // Composant de sélection de focus pour la photo de victoire
  const VictoryPhotoFocusSelector: React.FC<{ photo: string; focus?: { x: number; y: number }; onFocusChange: (focus: { x: number; y: number }) => void }> = ({ photo, focus, onFocusChange }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const [isDraggingCircle, setIsDraggingCircle] = useState(false);
    const [currentFocus, setCurrentFocus] = useState<{ x: number; y: number }>(focus ?? { x: 50, y: 50 });

    useEffect(() => {
      if (focus !== undefined) {
        setCurrentFocus(focus ?? { x: 50, y: 50 });
      }
    }, [focus]);

    const calculateFocusFromPosition = useCallback((clientX: number, clientY: number) => {
      if (!containerRef.current || !imageRef.current) return null;

      const container = containerRef.current;
      const image = imageRef.current;
      const rect = container.getBoundingClientRect();
      
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const imageRect = image.getBoundingClientRect();
      const imageLeft = imageRect.left - rect.left;
      const imageTop = imageRect.top - rect.top;
      const imageWidth = imageRect.width;
      const imageHeight = imageRect.height;

      if (x < imageLeft || x > imageLeft + imageWidth || y < imageTop || y > imageTop + imageHeight) {
        return null;
      }

      const relativeX = ((x - imageLeft) / imageWidth) * 100;
      const relativeY = ((y - imageTop) / imageHeight) * 100;

      return {
        x: Math.max(0, Math.min(100, relativeX)),
        y: Math.max(0, Math.min(100, relativeY))
      };
    }, []);

    const handleContainerMouseDown = (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('.focus-circle')) return;
      const newFocus = calculateFocusFromPosition(e.clientX, e.clientY);
      if (newFocus) {
        setCurrentFocus(newFocus);
        onFocusChange(newFocus);
      }
    };

    const handleCircleMouseDown = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsDraggingCircle(true);
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
      if (!isDraggingCircle || !containerRef.current || !imageRef.current) return;

      const newFocus = calculateFocusFromPosition(e.clientX, e.clientY);
      if (newFocus) {
        setCurrentFocus(newFocus);
        onFocusChange(newFocus);
      }
    }, [isDraggingCircle, calculateFocusFromPosition, onFocusChange]);

    const handleMouseUp = useCallback(() => {
      setIsDraggingCircle(false);
    }, []);

    useEffect(() => {
      if (isDraggingCircle) {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };
      }
    }, [isDraggingCircle, handleMouseMove, handleMouseUp]);

    return (
      <div 
        ref={containerRef}
        className="relative w-full max-h-[400px] bg-gray-50 rounded-[40px] overflow-hidden border-2 border-dashed border-gray-200 shadow-inner cursor-crosshair"
        onMouseDown={handleContainerMouseDown}
      >
        <img 
          ref={imageRef}
          src={photo} 
          alt="" 
          className="w-full h-auto object-contain pointer-events-none"
          draggable={false}
        />
        <div 
          className="focus-circle absolute w-[60px] h-[60px] border-4 border-orange-600 rounded-full cursor-move shadow-lg bg-white/20 backdrop-blur-sm z-10"
          style={{ 
            left: `${currentFocus.x}%`, 
            top: `${currentFocus.y}%`, 
            transform: 'translate(-50%, -50%)'
          }}
          onMouseDown={handleCircleMouseDown}
        />
      </div>
    );
  };

  const buildPayloadFromUpdates = (updates: Partial<AppConfig>): Record<string, unknown> => {
    const payload: Record<string, unknown> = {};
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.subtitle !== undefined) payload.subtitle = updates.subtitle;
    // Les images de fond sont gérées séparément via setBackgroundImage
    if (updates.victoryPhotoFocus !== undefined) {
      if (updates.victoryPhotoFocus === null || updates.victoryPhotoFocus === undefined) {
        payload.victory_photo_focus_x = null;
        payload.victory_photo_focus_y = null;
      } else {
        payload.victory_photo_focus_x = updates.victoryPhotoFocus.x;
        payload.victory_photo_focus_y = updates.victoryPhotoFocus.y;
      }
    }
    if (updates.mainColor !== undefined) payload.main_color = updates.mainColor;
    if (updates.visualType !== undefined) payload.visual_type = updates.visualType;
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.matchDate !== undefined) payload.match_date = updates.matchDate;
    if (updates.location !== undefined) payload.location = updates.location;
    // Les réglages de pagination (marges/padding) ne sont pas synchronisés en BDD (réglages d'affichage locaux uniquement)
    return payload;
  };

  const performSync = async (newConfig: AppConfig, updates: Partial<AppConfig>) => {
    if (isSyncing) return;

    // Ne pas synchroniser si la source est CACHE ou LOCAL
    if (activeSource === DB_SOURCE.CACHE || activeSource === DB_SOURCE.LOCAL) {
      return;
    }

    const hasBgImages = updates.resultsBg !== undefined || updates.previewBg !== undefined || updates.victoryBg !== undefined;
    const payload = buildPayloadFromUpdates(updates);
    const hasSettings = Object.keys(payload).length > 0;

    // Ne pas appeler Aiven s'il n'y a rien à enregistrer (évite une synchro à chaque petit changement)
    if (!hasBgImages && !hasSettings) {
      return;
    }

    setIsSyncing(true);
    setSaving(true);

    try {
      const adapter = createDatabaseAdapter(activeSource);

      if (updates.resultsBg !== undefined) {
        await adapter.setBackgroundImage('results', updates.resultsBg);
      }
      if (updates.previewBg !== undefined) {
        await adapter.setBackgroundImage('preview', updates.previewBg);
      }
      if (updates.victoryBg !== undefined) {
        await adapter.setBackgroundImage('victory', updates.victoryBg);
      }

      if (hasSettings) {
        await adapter.updateSettings(payload);
      }

      console.log(`📤 [${activeSource}] Synchronisation réussie.`);
    } catch (e: any) {
      console.error(`⚠️ [${activeSource}] Échec synchronisation:`, {
        message: e?.message || e?.error || 'Erreur inconnue',
        code: e?.code,
        status: e?.status
      });

      // Si ce n'est PAS une erreur de connexion, afficher une notification
      if (!isConnectionError(e)) {
        const errorMessage = extractErrorMessage(e);
        showToast(
          `Problème lors de l'enregistrement : ${errorMessage}`,
          'error',
          8000
        );
      }
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSaving(false), 600);
    }
  };

  const sync = (newConfig: AppConfig, updates: Partial<AppConfig>) => {
    // Sauvegarder immédiatement dans le cache local pour la réactivité UI
    cache.saveConfig(newConfig);

    // Stocker la sync en attente
    pendingSyncRef.current = { config: newConfig, updates };

    // Annuler le timer précédent s'il existe
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Programmer la sync avec debounce (1,5 s) pour limiter les appels Aiven
    syncTimeoutRef.current = setTimeout(() => {
      if (pendingSyncRef.current) {
        performSync(pendingSyncRef.current.config, pendingSyncRef.current.updates);
        pendingSyncRef.current = null;
      }
    }, 1500);
  };

  // Nettoyer le timer au démontage
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  const handleConfigUpdate = (updates: Partial<AppConfig>) => {
    setConfig(prev => {
      const updated = { ...prev, ...updates };
      sync(updated, updates);
      return updated;
    });
  };

  const updateMatch = (id: string, updates: Partial<Match>) => {
    setMatches(prev => prev.map(m => m.id !== id ? m : { ...m, ...updates }));
  };

  const addMatch = () => {
    if (matches.length >= 4) return;
    const team = localTeam ? { name: localTeam.name, logo: localTeam.logo } : { name: 'VOTRE CLUB', logo: '' };
    setMatches(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), league: 'DIVISION', team1: team, team2: { name: 'ADVERSAIRE', logo: '' }, score1: 0, score2: 0, isLive: false }]);
  };

  return (
    <div className="flex flex-col gap-12">
      <div className="bg-gray-100 p-2.5 rounded-[32px] flex gap-2 shadow-inner relative">
        {(['results', 'preview', 'victory'] as VisualType[]).map(type => (
          <button key={type} onClick={() => handleConfigUpdate({ visualType: type })} className={`flex-1 py-5 rounded-2xl text-xs font-[900] uppercase tracking-widest transition-all ${config.visualType === type ? 'bg-white text-orange-600 shadow-md scale-[1.03]' : 'text-gray-500 hover:text-gray-700'}`}>
            {type === 'results' ? 'Résultats' : type === 'preview' ? 'Affiche' : 'Victoire'}
          </button>
        ))}
        {saving && (
          <div className="absolute -top-8 right-4 flex items-center gap-2.5 animate-pulse">
            <div className="w-3 h-3 bg-blue-600 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.5)]"></div>
            <span className="text-[11px] font-black text-blue-600 uppercase tracking-widest">Synchro...</span>
          </div>
        )}
      </div>

      {config.visualType === 'results' && (
        <section className="flex flex-col gap-8">
          <div className="flex items-center justify-between border-b border-gray-100 pb-5">
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Liste des matchs</h3>
            <button disabled={matches.length >= 4} onClick={addMatch} className="text-xs bg-black text-white font-black py-3 px-8 rounded-full hover:bg-orange-600 transition-all uppercase shadow-lg disabled:bg-gray-200">
              + Ajouter
            </button>
          </div>
          <div className="flex flex-col gap-8">
            {matches.map((match) => (
              <div key={match.id} className="p-8 bg-white rounded-[48px] border border-gray-100 shadow-xl flex flex-col gap-7">
                <input type="text" value={match.league} onChange={(e) => updateMatch(match.id, { league: e.target.value.toUpperCase() })} className="w-full text-sm font-black uppercase text-gray-500 bg-gray-50 p-4.5 rounded-[20px] text-center outline-none" placeholder="DIVISION" />
                <div className="grid grid-cols-[1fr_auto_1fr] gap-6 items-center">
                  <div className="flex flex-col gap-4">
                    <AutocompleteTeamSelect label="DOMICILE..." value={match.team1.name} teams={availableTeams} onSelect={(t) => updateMatch(match.id, { team1: { name: t.name, logo: t.logo } })} />
                    <input type="number" value={match.score1} onChange={(e) => updateMatch(match.id, { score1: parseInt(e.target.value) || 0 })} className="w-full font-black text-center text-4xl bg-gray-50 p-5 rounded-[24px] outline-none shadow-inner" />
                  </div>
                  <div className="text-gray-300 font-black text-base uppercase italic tracking-tighter">VS</div>
                  <div className="flex flex-col gap-4">
                    <AutocompleteTeamSelect label="EXTÉRIEUR..." value={match.team2.name} teams={availableTeams} onSelect={(t) => updateMatch(match.id, { team2: { name: t.name, logo: t.logo } })} align="right" />
                    <input type="number" value={match.score2} onChange={(e) => updateMatch(match.id, { score2: parseInt(e.target.value) || 0 })} className="w-full font-black text-center text-4xl bg-gray-50 p-5 rounded-[24px] outline-none shadow-inner" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-5 border-t border-gray-50">
                  <label className="flex items-center gap-4 cursor-pointer group">
                    <div className="relative">
                      <input type="checkbox" checked={match.isLive} onChange={(e) => updateMatch(match.id, { isLive: e.target.checked })} className="sr-only" />
                      <div className={`w-14 h-8 rounded-full transition-colors ${match.isLive ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                      <div className={`absolute top-1.5 left-1.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${match.isLive ? 'translate-x-6' : ''}`}></div>
                    </div>
                    <span className="text-xs font-black uppercase text-gray-500 tracking-wider">Direct</span>
                  </label>
                  <button onClick={() => setMatches(prev => prev.filter(m => m.id !== match.id))} className="text-xs text-gray-400 font-black uppercase hover:text-red-500">Retirer</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ... Le reste reste inchangé pour économiser du token, les changements sont focalisés sur la synchro ... */}
      
      {config.visualType === 'preview' && (
        <section className="flex flex-col gap-8">
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest border-b border-gray-100 pb-5">Configuration Affiche</h3>
          <div className="bg-white p-8 rounded-[48px] border border-gray-100 shadow-xl flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-black text-gray-400 uppercase ml-4 tracking-widest">Compétition</span>
              <input type="text" value={config.category} onChange={(e) => handleConfigUpdate({ category: e.target.value.toUpperCase() })} className="w-full bg-gray-50 rounded-[24px] p-5 text-sm font-black outline-none shadow-inner" />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col gap-3">
                <span className="text-xs font-black text-gray-400 uppercase ml-4 tracking-widest">Équipe 1</span>
                <AutocompleteTeamSelect label="DOM..." value={matches[0]?.team1.name || ''} teams={availableTeams} onSelect={(t) => updateMatch(matches[0]?.id, { team1: { name: t.name, logo: t.logo } })} />
              </div>
              <div className="flex flex-col gap-3">
                <span className="text-xs font-black text-gray-400 uppercase ml-4 tracking-widest text-right">Équipe 2</span>
                <AutocompleteTeamSelect label="EXT..." value={matches[0]?.team2.name || ''} teams={availableTeams} onSelect={(t) => updateMatch(matches[0]?.id, { team2: { name: t.name, logo: t.logo } })} align="right" />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-xs font-black text-gray-400 uppercase ml-4 tracking-widest">Date / Heure</span>
              <input type="text" value={config.matchDate} onChange={(e) => handleConfigUpdate({ matchDate: e.target.value.toUpperCase() })} className="w-full bg-gray-50 rounded-[24px] p-5 text-sm font-black outline-none shadow-inner" />
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-xs font-black text-gray-400 uppercase ml-4 tracking-widest">Lieu</span>
              <input type="text" value={config.location} onChange={(e) => handleConfigUpdate({ location: e.target.value.toUpperCase() })} className="w-full bg-gray-50 rounded-[24px] p-5 text-sm font-black outline-none shadow-inner" />
            </div>
          </div>
        </section>
      )}

      {config.visualType === 'victory' && (
        <section className="flex flex-col gap-8">
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest border-b border-gray-100 pb-5">Configuration Victoire</h3>
          <div className="bg-white p-8 rounded-[48px] border border-gray-100 shadow-xl flex flex-col gap-8">
            <div className="grid grid-cols-2 gap-8">
              <div className="flex flex-col gap-4">
                <AutocompleteTeamSelect label="DOM..." value={matches[0]?.team1.name || ''} teams={availableTeams} onSelect={(t) => updateMatch(matches[0]?.id, { team1: { name: t.name, logo: t.logo } })} />
                <input type="number" value={matches[0]?.score1} onChange={(e) => updateMatch(matches[0]?.id, { score1: parseInt(e.target.value) || 0 })} className="w-full font-black text-center text-6xl bg-gray-50 p-8 rounded-[36px] outline-none shadow-inner" />
              </div>
              <div className="flex flex-col gap-4">
                <AutocompleteTeamSelect label="EXT..." value={matches[0]?.team2.name || ''} teams={availableTeams} onSelect={(t) => updateMatch(matches[0]?.id, { team2: { name: t.name, logo: t.logo } })} align="right" />
                <input type="number" value={matches[0]?.score2} onChange={(e) => updateMatch(matches[0]?.id, { score2: parseInt(e.target.value) || 0 })} className="w-full font-black text-center text-6xl bg-gray-50 p-8 rounded-[36px] outline-none shadow-inner" />
              </div>
            </div>
            <div className="flex flex-col gap-5 pt-4">
               <span className="text-xs font-black text-orange-600 uppercase tracking-[0.2em] ml-2">Photo Story</span>
               {victoryPhoto ? (
                 <div className="flex flex-col gap-3">
                   <VictoryPhotoFocusSelector 
                     photo={victoryPhoto}
                     focus={config.victoryPhotoFocus}
                     onFocusChange={(focus) => handleConfigUpdate({ victoryPhotoFocus: focus })}
                   />
                   <button
                     onClick={() => {
                       setVictoryPhoto('');
                       handleConfigUpdate({ victoryPhotoFocus: undefined });
                     }}
                     className="w-full py-3 px-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-[24px] text-xs font-black uppercase tracking-widest transition-all"
                   >
                     Supprimer la photo
                   </button>
                 </div>
               ) : (
                 <div className="relative w-full h-56 border-2 border-dashed border-gray-200 rounded-[40px] flex items-center justify-center bg-gray-50 hover:bg-gray-100 transition-all overflow-hidden shadow-inner group">
                   <span className="text-xs font-black text-gray-300 uppercase">Importer une photo</span>
                   <input 
                     type="file" 
                     accept="image/*" 
                     onChange={(e) => handleVictoryPhotoUpload(e.target.files?.[0] || null)} 
                     disabled={uploadingImage}
                     className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                   />
                 </div>
               )}
            </div>
          </div>
        </section>
      )}

      <section className="pt-10 border-t border-gray-200 flex flex-col gap-10">
        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Identité Visuelle</h3>
        <div className="bg-blue-50/50 p-10 rounded-[56px] border border-blue-100 flex flex-col gap-10 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between gap-6 relative z-10">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-black text-blue-900 uppercase tracking-widest">Fond du visuel</label>
              <span className="text-xs text-blue-600/70 font-bold uppercase">Max 0.9 Mo – format PNG</span>
              {(() => {
                const currentBg = config.visualType === 'results' ? config.resultsBg : config.visualType === 'preview' ? config.previewBg : config.victoryBg;
                return currentBg ? (
                  <span className="inline-flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0"></span>
                    <span className="text-xs font-black text-green-700 uppercase tracking-wider">Fond défini – cliquer pour remplacer</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
                    <span className="text-xs font-black text-amber-700 uppercase tracking-wider">Aucun fond – ajouter une image</span>
                  </span>
                );
              })()}
              <span className="text-[11px] text-blue-600/80 font-bold">
                Réduire la taille :{' '}
                <a href="https://compresspng.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-700">compresspng.com</a>
                {' · '}
                <a href="https://www.iloveimg.com/compress-image" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-700">iloveimg.com</a>
              </span>
            </div>
            <div className="flex items-center gap-4">
              {(config.visualType === 'results' ? config.resultsBg : config.visualType === 'preview' ? config.previewBg : config.victoryBg) && (
                <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-blue-200 shadow-inner shrink-0 bg-gray-100">
                  <img 
                    src={config.visualType === 'results' ? config.resultsBg : config.visualType === 'preview' ? config.previewBg : config.victoryBg} 
                    alt="Fond actuel" 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="w-16 h-16 rounded-[24px] bg-blue-600 flex items-center justify-center text-white cursor-pointer relative shadow-xl hover:scale-110 active:scale-90 transition-transform" title={(config.visualType === 'results' ? config.resultsBg : config.visualType === 'preview' ? config.previewBg : config.victoryBg) ? 'Remplacer le fond' : 'Ajouter un fond'}>
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => handleBackgroundImageUpload(e.target.files?.[0] || null, config.visualType)} 
                  disabled={uploadingImage}
                  className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                />
                {uploadingImage && (
                  <div className="absolute inset-0 bg-blue-600/80 flex items-center justify-center rounded-[24px]">
                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6 relative z-10">
            <div className="flex flex-col gap-4 p-6 bg-white rounded-[32px] border border-blue-100 shadow-sm">
              <span className="text-[11px] font-black text-blue-400 uppercase tracking-widest text-center">Thème Couleur</span>
              <div className="relative w-full h-14 rounded-2xl overflow-hidden shadow-inner border border-gray-100">
                <input type="color" value={config.mainColor} onChange={(e) => handleConfigUpdate({ mainColor: e.target.value })} className="absolute inset-0 w-full h-[300%] cursor-pointer translate-y-[-33%]" />
              </div>
            </div>
            <div className="flex flex-col gap-4 p-6 bg-white rounded-[32px] border border-blue-100 shadow-sm">
              <span className="text-[11px] font-black text-blue-400 uppercase tracking-widest text-center">Code HEX</span>
              <div className="flex items-center justify-center h-14 text-sm font-black uppercase text-blue-900 bg-blue-50/50 rounded-2xl">{config.mainColor}</div>
            </div>
          </div>
          {config.visualType === 'results' && (
            <div className="flex flex-col gap-6 relative z-10">
              <div className="flex flex-col gap-3">
                <span className="text-xs font-black text-blue-400 uppercase ml-4 tracking-widest">Titre</span>
                <input type="text" value={config.title} onChange={(e) => handleConfigUpdate({ title: e.target.value.toUpperCase() })} className="w-full bg-white border border-blue-100 rounded-[24px] p-5 text-sm font-black uppercase outline-none focus:border-blue-400 transition-all shadow-sm" />
              </div>
              <div className="flex flex-col gap-3">
                <span className="text-xs font-black text-blue-400 uppercase ml-4 tracking-widest">Sous-titre</span>
                <input type="text" value={config.subtitle} onChange={(e) => handleConfigUpdate({ subtitle: e.target.value.toUpperCase() })} className="w-full bg-white border border-blue-100 rounded-[24px] p-5 text-sm font-black uppercase outline-none focus:border-blue-400 transition-all shadow-sm" />
              </div>
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={config.showSlideIndicator} onChange={(e) => handleConfigUpdate({ showSlideIndicator: e.target.checked })} className="w-5 h-5 rounded border-2 border-blue-200 text-blue-600 focus:ring-blue-400" />
                  <span className="text-xs font-black text-blue-400 uppercase tracking-widest">Afficher la pagination</span>
                </label>
                {config.showSlideIndicator && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-black text-blue-400 uppercase ml-4 tracking-widest">Nombre de slides</span>
                        <select value={config.totalSlides} onChange={(e) => { const n = Number(e.target.value); handleConfigUpdate({ totalSlides: n, currentSlide: Math.min(config.currentSlide, n) }); }} className="w-full bg-white border border-blue-100 rounded-[24px] p-4 text-sm font-black uppercase outline-none focus:border-blue-400 transition-all shadow-sm appearance-none cursor-pointer" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%233b82f6'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '20px', paddingRight: '44px' }}>
                          {Array.from({ length: 9 }, (_, i) => i + 2).map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-black text-blue-400 uppercase ml-4 tracking-widest">Slide active</span>
                        <select value={config.currentSlide} onChange={(e) => handleConfigUpdate({ currentSlide: Number(e.target.value) })} className="w-full bg-white border border-blue-100 rounded-[24px] p-4 text-sm font-black uppercase outline-none focus:border-blue-400 transition-all shadow-sm appearance-none cursor-pointer" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%233b82f6'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '20px', paddingRight: '44px' }}>
                          {Array.from({ length: config.totalSlides }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-black text-blue-400 uppercase ml-4 tracking-widest">Marge haut (px)</span>
                        <input 
                          type="number" 
                          value={config.paginationMarginTop ?? ''} 
                          onChange={(e) => handleConfigUpdate({ paginationMarginTop: e.target.value === '' ? undefined : Number(e.target.value) })} 
                          placeholder="Auto"
                          className="w-full bg-white border border-blue-100 rounded-[24px] p-4 text-sm font-black uppercase outline-none focus:border-blue-400 transition-all shadow-sm"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-black text-blue-400 uppercase ml-4 tracking-widest">Marge bas (px)</span>
                        <input 
                          type="number" 
                          value={config.paginationMarginBottom ?? ''} 
                          onChange={(e) => handleConfigUpdate({ paginationMarginBottom: e.target.value === '' ? undefined : Number(e.target.value) })} 
                          placeholder="Auto"
                          className="w-full bg-white border border-blue-100 rounded-[24px] p-4 text-sm font-black uppercase outline-none focus:border-blue-400 transition-all shadow-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-black text-blue-400 uppercase ml-4 tracking-widest">Padding haut (px)</span>
                        <input 
                          type="number" 
                          value={config.paginationPaddingTop ?? ''} 
                          onChange={(e) => handleConfigUpdate({ paginationPaddingTop: e.target.value === '' ? undefined : Number(e.target.value) })} 
                          placeholder="Auto"
                          className="w-full bg-white border border-blue-100 rounded-[24px] p-4 text-sm font-black uppercase outline-none focus:border-blue-400 transition-all shadow-sm"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-black text-blue-400 uppercase ml-4 tracking-widest">Padding bas (px)</span>
                        <input 
                          type="number" 
                          value={config.paginationPaddingBottom ?? ''} 
                          onChange={(e) => handleConfigUpdate({ paginationPaddingBottom: e.target.value === '' ? undefined : Number(e.target.value) })} 
                          placeholder="Auto"
                          className="w-full bg-white border border-blue-100 rounded-[24px] p-4 text-sm font-black uppercase outline-none focus:border-blue-400 transition-all shadow-sm"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default EditorPanel;
