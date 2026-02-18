import React, { useState, useMemo, useRef } from 'react';
import { validateAndLoadImage, showImageValidationError } from '../lib/image-validation';
import { DatabaseAdapter, TeamData, createDatabaseAdapter } from '../lib/db-adapter';
import { ConnectionSource } from '../types';

interface PendingTeam {
  tempId: string;
  name: string;
  logo: string;
}

interface Props {
  /** Appelé après mutation. Si `newTeams` est fourni, le parent peut fusionner au lieu de refetch. */
  onTeamsChange: (newTeams?: TeamData[]) => void;
  /** Appelé après "Définir comme club local" : met à jour la liste en mémoire sans refetch. */
  onSetLocalTeam?: (teamId: string) => void;
  availableTeams: TeamData[];
  loadingTeams: boolean;
  activeSource: ConnectionSource;
}

const TeamDatabaseManager: React.FC<Props> = ({ onTeamsChange, onSetLocalTeam, availableTeams, loadingTeams, activeSource }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingTeams, setPendingTeams] = useState<PendingTeam[]>([]);
  const [importing, setImporting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<TeamData | null>(null);

  const sortedTeams = useMemo(() => {
    return [...availableTeams].sort((a, b) => {
      if (a.is_local && !b.is_local) return -1;
      if (!a.is_local && b.is_local) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [availableTeams]);

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files?.length) return;
    const list = Array.isArray(files) ? files : Array.from(files);
    for (const file of list) {
      try {
        const result = await validateAndLoadImage(file, {
          compress: true,
          maxWidth: 512,
          maxHeight: 512,
          quality: 0.8
        });

        if (!result.valid || !result.dataUrl) {
          showImageValidationError(result.error || 'Erreur de validation');
          continue;
        }

        const tempName = file.name.split('.')[0].replace(/[-_]/g, ' ').toUpperCase();
        setPendingTeams(prev => [...prev, {
          tempId: Math.random().toString(36).substr(2, 9),
          name: tempName,
          logo: result.dataUrl!
        }]);
      } catch (error: any) {
        showImageValidationError(error.message || 'Erreur lors du chargement de l\'image');
      }
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) e.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const dt = e.dataTransfer;
    if (!dt) return;
    if (dt.files?.length) {
      handleFiles(dt.files);
      return;
    }
    if (dt.items?.length) {
      const files: File[] = [];
      for (let i = 0; i < dt.items.length; i++) {
        const f = dt.items[i].getAsFile();
        if (f) files.push(f);
      }
      if (files.length) handleFiles(files);
    }
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const getAdapter = (): DatabaseAdapter | null => {
    if (activeSource === 'AIVEN' || activeSource === 'SUPABASE') {
      try {
        return createDatabaseAdapter(activeSource);
      } catch {
        return null;
      }
    }
    return null;
  };

  const savePendingTeams = async () => {
    const validTeams = pendingTeams.filter(t => t.name.trim() !== '');
    if (validTeams.length === 0) return;
    
    const adapter = getAdapter();
    if (!adapter) {
      alert('Aucune connexion à la base de données disponible. Basculez vers Aiven ou Supabase.');
      return;
    }

    console.log(`📡 Envoi de ${validTeams.length} nouveaux clubs vers ${adapter.source}...`);
    try {
      setImporting(true);
      const created: TeamData[] = [];
      for (const team of validTeams) {
        const createdTeam = await adapter.createTeam({
          name: team.name,
          logo: team.logo,
          is_local: false
        });
        created.push(createdTeam);
      }
      console.log(`✅ ${validTeams.length} nouveaux clubs enregistrés dans ${adapter.source}.`);
      setPendingTeams([]);
      onTeamsChange(created);
    } catch (err: any) {
      console.error(`❌ Erreur lors de l'enregistrement des clubs (${adapter.source}):`, err);
      alert(`Erreur: ${err.message || err.hint || `Problème réseau ${adapter.source}`}`);
    } finally {
      setImporting(false);
    }
  };

  const setAsLocalTeam = async (teamId: string) => {
    const adapter = getAdapter();
    if (!adapter) {
      alert('Aucune connexion à la base de données disponible.');
      return;
    }

    console.log(`🏠 Définition du club local: ${teamId} (${adapter.source})`);
    try {
      setUpdatingId(teamId);
      await adapter.setLocalTeam(teamId);
      onSetLocalTeam?.(teamId);
    } catch (err: any) {
      console.error(`❌ Impossible de changer le club local (${adapter.source}):`, err);
      alert(`Erreur: ${err.message || err.hint || 'Impossible de changer le club local'}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const startEditing = (team: TeamData) => {
    setEditingId(team.id || null);
    setEditValues({ ...team });
  };

  const handleEditLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editValues) return;

    try {
      const result = await validateAndLoadImage(file, {
        compress: true,
        maxWidth: 512,
        maxHeight: 512,
        quality: 0.8
      });

      if (!result.valid || !result.dataUrl) {
        showImageValidationError(result.error || 'Erreur de validation');
        return;
      }

      setEditValues({ ...editValues, logo: result.dataUrl });
    } catch (error: any) {
      showImageValidationError(error.message || 'Erreur lors du chargement de l\'image');
    }
  };

  const saveEdit = async () => {
    if (!editValues || !editingId) return;
    
    const adapter = getAdapter();
    if (!adapter) {
      alert('Aucune connexion à la base de données disponible.');
      return;
    }

    console.log(`📝 Mise à jour du club: ${editingId} (${adapter.source})`);
    try {
      setUpdatingId(editingId);
      await adapter.updateTeam(editingId, {
        name: editValues.name,
        logo: editValues.logo
      });
      
      setEditingId(null);
      setEditValues(null);
      onTeamsChange();
    } catch (err: any) { 
      console.error(`❌ Échec de la mise à jour du club (${adapter.source}):`, err);
      alert(`Erreur: ${err.message || err.hint || 'Erreur lors de la mise à jour'}`); 
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteTeamFromDB = async (id: string) => {
    if (!confirm("Supprimer ce club définitivement ?")) return;
    
    const adapter = getAdapter();
    if (!adapter) {
      alert('Aucune connexion à la base de données disponible.');
      return;
    }

    console.log(`🗑️ Suppression du club: ${id} (${adapter.source})`);
    try {
      await adapter.deleteTeam(id);
      onTeamsChange();
    } catch (err: any) {
      console.error(`❌ Échec de la suppression (${adapter.source}):`, err);
      alert(`Erreur: ${err.message || err.hint || 'Erreur lors de la suppression'}`);
    }
  };

  return (
    <section className="bg-gray-900 text-white p-8 rounded-[48px] shadow-2xl overflow-hidden border border-white/5 border-l-[6px] border-l-orange-500 animate-in fade-in duration-500">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between shrink-0 mb-2">
          <div className="flex flex-col">
            <span className="text-xs font-black uppercase tracking-[0.25em] text-orange-500 leading-tight">Clubs & Logos</span>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Base de données partagée</span>
          </div>
          {(loadingTeams || updatingId) && <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.8)]"></div>}
        </div>
          
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
          className="sr-only"
          aria-hidden
        />
        <div
          className="shrink-0 flex flex-col gap-3"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <button
            type="button"
            onClick={openFilePicker}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; }}
            className="shrink-0 w-full bg-orange-600 hover:bg-orange-500 active:scale-[0.98] text-xs font-black py-3.5 px-6 rounded-2xl uppercase transition-all shadow-lg border-2 border-orange-500/30"
          >
            + Ajouter des clubs (fichiers ou glisser-déposer)
          </button>
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFilePicker(); } }}
            onClick={openFilePicker}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              shrink-0 relative border-[3px] border-dashed rounded-[32px] p-8 transition-all duration-300 flex flex-col items-center justify-center gap-4 cursor-pointer select-none
              ${isDragging ? 'border-orange-500 bg-orange-500/10 scale-[0.98]' : 'border-gray-700 hover:border-gray-500 bg-gray-800/30'}
            `}
          >
            <div className="w-14 h-14 bg-gray-800 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all shadow-xl border border-white/5">
              <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
            </div>
            <div className="text-center">
              <p className="text-xs font-black uppercase tracking-widest leading-none">Déposer les logos ici</p>
              <p className="text-[10px] font-bold text-gray-500 mt-2">ou cliquer pour parcourir</p>
            </div>
          </div>
        </div>

        {pendingTeams.length > 0 && (
          <div className="shrink-0 bg-orange-500/10 border border-orange-500/30 rounded-[32px] p-6 flex flex-col gap-4 shadow-xl">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black uppercase text-orange-500 tracking-wider">File d'attente ({pendingTeams.length})</span>
            </div>
            <div className="max-h-[220px] overflow-y-auto pr-3 custom-scrollbar flex flex-col gap-3">
              {pendingTeams.map(t => (
                <div key={t.tempId} className="flex items-center gap-4 bg-gray-800 p-3 rounded-2xl border border-white/5 shadow-sm">
                  <img src={t.logo} className="w-10 h-10 object-contain" alt="" />
                  <input 
                    type="text" 
                    value={t.name}
                    onChange={(e) => setPendingTeams(prev => prev.map(pt => pt.tempId === t.tempId ? { ...pt, name: e.target.value.toUpperCase() } : pt))}
                    className="flex-1 bg-transparent border-b border-gray-700 text-xs font-black outline-none focus:border-orange-500 py-1.5 uppercase transition-colors"
                  />
                </div>
              ))}
            </div>
            <button 
              onClick={savePendingTeams}
              disabled={importing}
              className="w-full bg-orange-600 hover:bg-orange-500 active:scale-95 text-xs font-black py-4 rounded-2xl uppercase transition-all shadow-lg disabled:bg-gray-700"
            >
              {importing ? 'Synchronisation...' : 'Sauvegarder les clubs'}
            </button>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between ml-2">
            <span className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">Répertoire ({availableTeams.length})</span>
          </div>
          
          <div className="max-h-[500px] overflow-y-auto pr-3 custom-scrollbar flex flex-col gap-3">
            {sortedTeams.map(team => (
              <div 
                key={team.id} 
                className={`group relative flex items-center justify-between p-4 rounded-3xl border transition-all ${
                  team.id === editingId 
                    ? 'bg-blue-600/10 border-blue-500 shadow-xl' 
                    : team.is_local 
                      ? 'bg-orange-600/10 border-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.15)]' 
                      : 'bg-gray-800/40 border-transparent hover:border-gray-700'
                }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="relative shrink-0 overflow-visible group/logo">
                    {editingId === team.id && editValues ? (
                      <div className="relative group/edit-logo cursor-pointer overflow-hidden rounded-2xl w-12 h-12 border-2 border-blue-500 shadow-lg hover:scale-[4] hover:z-[100] hover:rounded-lg transition-transform duration-200 origin-center">
                        <img src={editValues.logo} className="w-full h-full object-contain" alt="" />
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/edit-logo:opacity-100 transition-opacity">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                        </div>
                        <input type="file" accept="image/*" onChange={handleEditLogoChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-visible">
                          <img src={team.logo} className={`w-12 h-12 object-contain shrink-0 transition-transform duration-200 origin-center group-hover/logo:scale-[4] group-hover/logo:z-[100] group-hover/logo:shadow-2xl group-hover/logo:rounded-lg ${team.is_local ? 'scale-105' : ''}`} alt="" />
                        </div>
                        {team.is_local && <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-orange-500 border-4 border-gray-900 rounded-full animate-pulse"></div>}
                      </>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    {editingId === team.id && editValues ? (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-black uppercase text-blue-400 tracking-widest">Renommer le club</span>
                        <input 
                          type="text" 
                          autoFocus
                          value={editValues.name}
                          onChange={(e) => setEditValues({...editValues, name: e.target.value.toUpperCase()})}
                          className="bg-gray-800 text-xs font-black p-2 rounded-xl outline-none border border-blue-500 text-white uppercase w-full shadow-inner"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <span className={`text-sm font-black truncate tracking-tight uppercase leading-tight ${team.is_local ? 'text-orange-500' : 'text-gray-100'}`}>{team.name}</span>
                        {team.is_local && (
                          <span className="text-[9px] text-orange-600 font-black uppercase tracking-tighter">Équipe locale active</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className={`flex items-center gap-1.5 transition-all ${editingId === team.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  {editingId === team.id ? (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => { setEditingId(null); setEditValues(null); }} className="p-2 text-gray-500 hover:bg-gray-700 rounded-xl transition-colors shadow-sm">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                      <button onClick={saveEdit} className="p-2 text-green-500 hover:bg-green-500/20 rounded-xl transition-all shadow-sm">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                      </button>
                    </div>
                  ) : (
                    <>
                      {!team.is_local && (
                        <button 
                          disabled={!!updatingId}
                          onClick={() => team.id && setAsLocalTeam(team.id)} 
                          title="Définir comme club local"
                          className="p-2 text-gray-500 hover:text-orange-500 hover:bg-orange-500/20 rounded-xl transition-all disabled:opacity-30"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
                        </button>
                      )}
                      <button onClick={() => startEditing(team)} className="p-2 text-gray-500 hover:text-blue-400 hover:bg-blue-400/20 rounded-xl transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                      </button>
                      <button onClick={() => team.id && deleteTeamFromDB(team.id)} className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/20 rounded-xl transition-all">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TeamDatabaseManager;
