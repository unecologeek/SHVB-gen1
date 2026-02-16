
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AppConfig, Match, VisualType } from '../types';
import { databases, APPWRITE_CONFIG, isAppwriteReady } from '../lib/appwrite';
import { supabase } from '../lib/supabase';
import { validateAndLoadImage, showImageValidationError } from '../lib/image-validation';
import { useLocalCache } from '../hooks/useLocalCache';

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
                <div className="w-14 h-14 bg-white rounded-2xl p-2 border border-gray-100 shrink-0 shadow-sm relative">
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
}

const EditorPanel: React.FC<Props> = ({ config, setConfig, matches, setMatches, availableTeams, victoryPhoto, setVictoryPhoto }) => {
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
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
    } catch (error: any) {
      showImageValidationError(error.message || 'Erreur lors du chargement de l\'image');
    } finally {
      setUploadingImage(false);
    }
  };

  const sync = async (newConfig: AppConfig) => {
    setSaving(true);
    const payload = { 
      title: newConfig.title, 
      subtitle: newConfig.subtitle, 
      results_bg: newConfig.resultsBg, 
      preview_bg: newConfig.previewBg, 
      victory_bg: newConfig.victoryBg, 
      main_color: newConfig.mainColor, 
      visual_type: newConfig.visualType, 
      category: newConfig.category, 
      match_date: newConfig.matchDate, 
      location: newConfig.location 
    };

    cache.saveConfig(newConfig);

    const syncAppwrite = async () => {
      if (isAppwriteReady()) {
        try {
          await databases.updateDocument(APPWRITE_CONFIG.DATABASE_ID, APPWRITE_CONFIG.COLLECTION_SETTINGS, 'default', payload);
          console.log("📤 [APPWRITE] Synchronisation réussie.");
        } catch (e: any) {
          console.error("⚠️ [APPWRITE] Échec synchronisation:", {
            status: e.code,
            type: e.type,
            message: e.message,
            hint: e.code === 403 ? "Vérifiez les permissions de mise à jour sur le document" : 
                  e.code === 404 ? "Document 'default' introuvable" : "Erreur réseau ou CORS"
          });
        }
      }
    };

    const syncSupabase = async () => {
      if (!supabase) return;
      try {
        const { error } = await supabase.from('settings').upsert({ id: 1, ...payload });
        if (error) throw error;
        console.log("📤 [SUPABASE] Synchronisation réussie.");
      } catch (e: any) {
        console.error("⚠️ [SUPABASE] Échec synchronisation:", {
          message: e.message,
          code: e.code,
          hint: "Projet peut-être en pause ou erreur CORS"
        });
      }
    };

    // On lance les syncos en parallèle sans bloquer l'UI
    Promise.all([syncAppwrite(), syncSupabase()]).finally(() => {
      setTimeout(() => setSaving(false), 600);
    });
  };

  const handleConfigUpdate = (updates: Partial<AppConfig>) => {
    setConfig(prev => {
      const updated = { ...prev, ...updates };
      sync(updated);
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
               <div className="relative w-full h-56 border-2 border-dashed border-gray-200 rounded-[40px] flex items-center justify-center bg-gray-50 hover:bg-gray-100 transition-all overflow-hidden shadow-inner group">
                  {victoryPhoto ? <img src={victoryPhoto} className="w-full h-full object-cover opacity-60 transition-transform group-hover:scale-105" /> : <span className="text-xs font-black text-gray-300 uppercase">Importer une photo</span>}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => handleVictoryPhotoUpload(e.target.files?.[0] || null)} 
                    disabled={uploadingImage}
                    className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                  />
               </div>
            </div>
          </div>
        </section>
      )}

      <section className="pt-10 border-t border-gray-200 flex flex-col gap-10">
        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Identité Visuelle</h3>
        <div className="bg-blue-50/50 p-10 rounded-[56px] border border-blue-100 flex flex-col gap-10 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between gap-6 relative z-10">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-black text-blue-900 uppercase tracking-widest">Fond du visuel</label>
              <span className="text-xs text-blue-600/70 font-bold uppercase">PNG/JPG Haute Qualité</span>
            </div>
            <div className="w-16 h-16 rounded-[24px] bg-blue-600 flex items-center justify-center text-white cursor-pointer relative shadow-xl hover:scale-110 active:scale-90 transition-transform">
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
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default EditorPanel;
