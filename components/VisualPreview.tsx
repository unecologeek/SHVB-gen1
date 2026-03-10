
import React, { forwardRef } from 'react';
import { Match, AppConfig } from '../types';

interface Props {
  config: AppConfig;
  matches: Match[];
  victoryPhoto?: string;
}

const VisualPreview = forwardRef<HTMLDivElement, Props>(({ config, matches, victoryPhoto }, ref) => {
  const isCompact = matches.length >= 4;
  const isThreeMatches = matches.length === 3;
  
  // Valeurs par défaut pour les marges/padding selon le nombre de matchs
  const getDefaultPaginationStyles = () => {
    if (isCompact) {
      // 4 matchs : tout à 0
      return { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 };
    } else if (isThreeMatches) {
      // 3 matchs : padding 0/0, margin-top 0, margin-bottom -13px
      return { marginTop: 0, marginBottom: -13, paddingTop: 0, paddingBottom: 0 };
    } else {
      // 2 matchs : valeurs par défaut
      return { marginTop: undefined, marginBottom: undefined, paddingTop: 20, paddingBottom: 44 };
    }
  };
  
  const defaultStyles = getDefaultPaginationStyles();
  
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = 'none';
  };

  const fontStyles = `
    .font-ultra-black-italic { 
      font-family: 'Inter', sans-serif !important; 
      font-weight: 900 !important; 
      font-style: italic !important; 
    }
    .font-ultra-black-normal { 
      font-family: 'Inter', sans-serif !important; 
      font-weight: 900 !important; 
      font-style: normal !important; 
    }
    .font-heavy-bold { 
      font-family: 'Inter', sans-serif !important; 
      font-weight: 800 !important; 
    }
    .font-bebas {
      font-family: 'Bebas Neue', cursive !important;
    }
    .team-name-clamp {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: clip;
      line-height: 0.95;
      word-break: break-word;
    }
    .victory-score-box {
      width: 280px; 
      height: 352px;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Inter', sans-serif;
      font-weight: 900;
      color: black;
      line-height: 1;
      padding-top: 15px;
      letter-spacing: -0.05em;
    }
    .logo-img-preview {
      max-width: 100%;
      max-height: 180px;
      object-fit: contain;
      image-rendering: -webkit-optimize-contrast;
    }
  `;

  if (config.visualType === 'preview') {
    const match = matches[0] || { team1: { name: '', logo: '' }, team2: { name: '', logo: '' } };
    const hasLeft = config.previewLeftTeams?.some(t => t != null);
    const hasRight = config.previewRightTeams?.some(t => t != null);
    const rawLeft = hasLeft ? (config.previewLeftTeams ?? []) : (match ? [match.team1, null, null] : [null, null, null]);
    const rawRight = hasRight ? (config.previewRightTeams ?? []) : (match ? [match.team2, null, null] : [null, null, null]);
    const leftTeams: { name: string; logo: string }[] = rawLeft.slice(0, 3).filter((t): t is { name: string; logo: string } => t != null);
    const rightTeams: { name: string; logo: string }[] = rawRight.slice(0, 3).filter((t): t is { name: string; logo: string } => t != null);

    return (
      <div 
        ref={ref}
        style={{ 
          width: '1080px', 
          height: '1080px',
          backgroundColor: config.mainColor || '#F58220',
          position: 'relative',
          fontFamily: "'Inter', sans-serif"
        }}
        className="overflow-hidden flex items-center justify-center select-none"
      >
        <style dangerouslySetInnerHTML={{ __html: fontStyles }} />

        {config.previewBg && (
          <img src={config.previewBg} alt="" className="absolute inset-0 w-full h-full object-cover" onError={handleImageError} />
        )}

        <div 
          className="absolute top-[78px] left-1/2 -translate-x-1/2 bg-[#1A1A1A] px-12 py-4 shadow-xl z-20 flex items-center justify-center border border-white/5"
          style={{ borderRadius: '40px' }}
        >
          <span className="text-white text-[24px] font-ultra-black-normal uppercase tracking-[0.08em] break-words text-center">
            {config.victoryBottomText || config.category || 'TQR M18 FÉMININE POULE DOR}
          </span>
        </div>

        <div 
          className="absolute top-[558px] left-1/2 -translate-x-1/2 w-[830px] h-[245px] bg-white shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] z-10 flex items-center gap-8 px-16 border border-black/5"
          style={{ borderRadius: '25px' }}
        >
          <div className="flex-1 min-w-0 flex items-center justify-center gap-2 h-[200px]">
            {leftTeams.map((team, i) => (
              <div key={i} className="flex-1 min-w-0 h-full flex items-center justify-center">
                {team.logo ? <img src={team.logo} alt="" className="logo-img-preview" onError={handleImageError} /> : null}
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center justify-center pt-2 shrink-0 mx-2">
            <span 
              className="font-bebas text-[115px] text-[#2D1B0D] italic leading-none" 
              style={{ letterSpacing: '-0.08em', transform: 'scaleY(1.15) rotate(-2deg)' }}
            >
              VS
            </span>
          </div>

          <div className="flex-1 min-w-0 flex items-center justify-center gap-2 h-[200px]">
            {rightTeams.map((team, i) => (
              <div key={i} className="flex-1 min-w-0 h-full flex items-center justify-center">
                {team.logo ? <img src={team.logo} alt="" className="logo-img-preview" onError={handleImageError} /> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-[84px] w-full px-[54px] flex items-center justify-center gap-6">
          <div className="bg-[#1A1A1A] rounded-full px-9 py-4.5 flex items-center gap-4 shadow-2xl border border-white/5 min-w-0">
            <svg className="w-8 h-8 text-white opacity-80 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            <span className="text-white text-[24px] font-heavy-bold uppercase tracking-tight break-words">{config.matchDate}</span>
          </div>
          <div className="bg-[#1A1A1A] rounded-full px-9 py-4.5 flex items-center gap-4 shadow-2xl border border-white/5 min-w-0 max-w-[600px]">
            <svg className="w-8 h-8 text-white opacity-80 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            <span className="text-white text-[24px] font-heavy-bold uppercase tracking-tight break-words text-left" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'clip' }}>{config.location}</span>
          </div>
        </div>
      </div>
    );
  }

  if (config.visualType === 'victory') {
    const match = matches[0] || { team1: { name: '', logo: '' }, team2: { name: '', logo: '' }, score1: 3, score2: 0 };
    return (
      <div 
        ref={ref}
        style={{ 
          width: '1080px', 
          height: '1920px',
          backgroundColor: 'black',
          position: 'relative',
          fontFamily: "'Inter', sans-serif"
        }}
        className="overflow-hidden flex items-center justify-center select-none"
      >
        <style dangerouslySetInnerHTML={{ __html: fontStyles }} />

        {victoryPhoto && (
          <img 
            src={victoryPhoto} 
            alt="" 
            className="absolute inset-0 w-full h-full object-cover" 
            style={{
              objectPosition: config.victoryPhotoFocus 
                ? `${config.victoryPhotoFocus.x}% ${config.victoryPhotoFocus.y}%`
                : 'center center'
            }}
          />
        )}

        {config.victoryBg && (
          <img src={config.victoryBg} alt="" className="absolute inset-0 w-full h-full object-cover z-10" onError={handleImageError} />
        )}

        <div className="absolute bottom-[0px] w-full h-full flex flex-col items-center justify-end z-20 pb-[105px]">
          <div className="flex items-start gap-[60px] mb-[15px]">
            <div className="flex flex-col items-center">
              <div className="victory-score-box shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]">
                <span style={{ fontSize: String(match.score1).length > 1 ? '190px' : '230px' }}>{match.score1}</span>
              </div>
              <span className="text-white text-[38px] font-black uppercase mt-6 tracking-tight">{match.team1.name}</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="victory-score-box shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]">
                <span style={{ fontSize: String(match.score2).length > 1 ? '190px' : '230px' }}>{match.score2}</span>
              </div>
              <span className="text-white text-[38px] font-black uppercase mt-6 tracking-tight">{match.team2.name}</span>
            </div>
          </div>

          <div 
            className="bg-black px-14 py-5 flex items-center justify-center mt-12 mb-[15px] shadow-2xl w-fit mx-auto max-w-[980px] border border-white/10"
            style={{ borderRadius: '48px' }}
          >
            <span className="text-white text-[28px] font-heavy-bold uppercase tracking-[0.08em] whitespace-nowrap">
              {config.victoryBottomText || config.category || 'TQR M18 FÉMININE POULE D'OR'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={ref}
      style={{ 
        width: '1080px', 
        height: '1080px',
        backgroundColor: config.mainColor || '#F58220',
        position: 'relative',
        fontFamily: "'Inter', sans-serif"
      }}
      className="overflow-hidden flex items-center justify-center select-none"
    >
      <style dangerouslySetInnerHTML={{ __html: fontStyles }} />

      {config.resultsBg && (
        <img src={config.resultsBg} alt="" className="absolute inset-0 w-full h-full object-cover" onError={handleImageError} />
      )}

      <div 
        className={`absolute bg-white flex flex-col items-center overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] ${isCompact ? 'pt-14' : 'pt-20'}`}
        style={{ 
          width: '940px', 
          height: '940px',
          top: '70px',
          left: '70px',
          borderRadius: '100px'
        }}
      >
        <div className={`text-center flex flex-col items-center w-full px-6 ${isCompact ? 'mb-6' : 'mb-8'}`}>
          <h1 
            className="leading-[0.7] tracking-tighter uppercase font-ultra-black-italic"
            style={{ color: config.mainColor, letterSpacing: '-0.05em', fontSize: isCompact ? '115px' : '140px' }}
          >
            {config.title || 'RÉSULTATS'}
          </h1>
          <p className="text-black uppercase tracking-[0.25em] font-heavy-bold break-words" style={{ fontSize: isCompact ? '32px' : '40px', marginTop: isCompact ? '20px' : '32px' }}>
            {config.subtitle || 'SEMAINE 51'}
          </p>
        </div>

        <div className={`w-full px-12 flex flex-col flex-1 justify-start min-h-0 ${isCompact ? 'gap-6 pt-2' : 'gap-10 pt-6'}`}>
          {matches.slice(0, 4).map((match) => (
            <div key={match.id} className={`flex flex-col w-full ${isCompact ? 'gap-2.5' : 'gap-4'}`}>
              <h2 className="text-center text-gray-400 uppercase tracking-[0.2em] font-heavy-bold break-words px-20" style={{ fontSize: isCompact ? '18px' : '20px' }}>
                {match.league}
              </h2>
              <div 
                className="bg-[#F8F8F8] flex items-center relative w-full px-6 border border-gray-100/40"
                style={{ borderRadius: isCompact ? '50px' : '60px', height: isCompact ? '102px' : '120px' }}
              >
                <div className="flex items-center gap-4 w-[330px] pr-4">
                  <div className="flex items-center justify-center shrink-0 overflow-hidden" style={{ width: isCompact ? '72px' : '88px', height: isCompact ? '72px' : '88px' }}>
                    {match.team1.logo && <img src={match.team1.logo} alt="" className="w-full h-full object-contain" onError={handleImageError} />}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <span className="text-black uppercase tracking-tighter block font-ultra-black-normal team-name-clamp" style={{ fontSize: isCompact ? '23px' : '26px' }}>
                      {match.team1.name}
                    </span>
                  </div>
                </div>
                <div 
                  className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center shadow-[0_12px_24px_-4px_rgba(0,0,0,0.2)] z-10"
                  style={{ backgroundColor: match.isLive ? config.liveColor : config.mainColor, borderRadius: isCompact ? '34px' : '38px', width: isCompact ? '170px' : '190px', height: isCompact ? '68px' : '76px' }}
                >
                  <div className="text-white leading-none flex items-center justify-center gap-2.5 w-full pb-1 font-ultra-black-italic" style={{ letterSpacing: '-0.04em', fontSize: isCompact ? '44px' : '52px' }}>
                    <span className="tabular-nums">{match.score1}</span>
                    <span className="opacity-60 scale-x-110 transform">-</span>
                    <span className="tabular-nums">{match.score2}</span>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-4 w-[330px] ml-auto text-right pl-4">
                  <div className="flex-1 overflow-hidden">
                    <span className="text-black uppercase tracking-tighter block font-ultra-black-normal team-name-clamp" style={{ fontSize: isCompact ? '23px' : '26px' }}>
                      {match.team2.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-center shrink-0 overflow-hidden" style={{ width: isCompact ? '72px' : '88px', height: isCompact ? '72px' : '88px' }}>
                    {match.team2.logo && <img src={match.team2.logo} alt="" className="w-full h-full object-contain" onError={handleImageError} />}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div 
          className="w-full flex flex-col items-center shrink-0" 
          style={{ 
            marginTop: config.paginationMarginTop !== undefined ? `${config.paginationMarginTop}px` : (defaultStyles.marginTop !== undefined ? `${defaultStyles.marginTop}px` : undefined),
            marginBottom: config.paginationMarginBottom !== undefined ? `${config.paginationMarginBottom}px` : (defaultStyles.marginBottom !== undefined ? `${defaultStyles.marginBottom}px` : undefined),
            paddingTop: config.paginationPaddingTop !== undefined ? `${config.paginationPaddingTop}px` : (defaultStyles.paddingTop !== undefined ? `${defaultStyles.paddingTop}px` : (isCompact ? '8px' : '20px')),
            paddingBottom: config.paginationPaddingBottom !== undefined ? `${config.paginationPaddingBottom}px` : (defaultStyles.paddingBottom !== undefined ? `${defaultStyles.paddingBottom}px` : (isCompact ? '6px' : '44px'))
          }}
        >
          {config.showSlideIndicator ? (
            <div className="flex items-center justify-center gap-3 py-5 min-h-[52px]">
              {Array.from({ length: config.totalSlides }).map((_, i) => (
                <div key={i} style={{ backgroundColor: i + 1 === config.currentSlide ? config.mainColor : '#E5E7EB', width: i + 1 === config.currentSlide ? '76px' : '22px', height: '22px', borderRadius: '11px' }} />
              ))}
            </div>
          ) : <div style={{ height: '22px' }} />}
        </div>
      </div>
    </div>
  );
});

VisualPreview.displayName = 'VisualPreview';

export default VisualPreview;
