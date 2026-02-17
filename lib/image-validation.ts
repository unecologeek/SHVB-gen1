
// Configuration de validation des images
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/x-png', 'image/webp', 'image/gif'];
const MAX_DIMENSION = 4096; // Maximum 4096px pour éviter les images trop grandes

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  file?: File;
  dataUrl?: string;
}

/**
 * Valide un fichier image avant l'upload
 */
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  // Vérifier le type MIME
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Type de fichier non autorisé. Types acceptés: ${ALLOWED_MIME_TYPES.join(', ')}`
    };
  }

  // Vérifier la taille
  if (file.size > MAX_FILE_SIZE) {
    const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024);
    return {
      valid: false,
      error: `Fichier trop volumineux. Taille maximale: ${maxSizeMB}MB`
    };
  }

  return { valid: true };
};

/**
 * Valide et charge une image avec compression optionnelle
 */
export const validateAndLoadImage = async (
  file: File,
  options?: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    compress?: boolean;
  }
): Promise<ImageValidationResult> => {
  // Valider le fichier
  const validation = validateImageFile(file);
  if (!validation.valid) {
    return validation;
  }

  try {
    // Charger l'image pour vérifier les dimensions
    const img = await loadImageFromFile(file);
    
    // Vérifier les dimensions
    if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) {
      return {
        valid: false,
        error: `Image trop grande. Dimensions maximales: ${MAX_DIMENSION}x${MAX_DIMENSION}px`
      };
    }

    // Compresser si demandé (PNG/WebP/GIF → sortie PNG pour préserver la transparence)
    let dataUrl: string;
    if (options?.compress) {
      const isPngLike = /\.png$/i.test(file.name) || ['image/png', 'image/x-png'].includes(file.type);
      const preserveAlpha = isPngLike || ['image/webp', 'image/gif'].includes(file.type);
      dataUrl = await compressImage(img, {
        maxWidth: options.maxWidth || MAX_DIMENSION,
        maxHeight: options.maxHeight || MAX_DIMENSION,
        quality: options.quality || 0.8,
        format: preserveAlpha ? 'image/png' : 'image/jpeg'
      });
    } else {
      // Charger sans compression
      dataUrl = await fileToDataURL(file);
    }

    return {
      valid: true,
      file,
      dataUrl
    };
  } catch (error: any) {
    return {
      valid: false,
      error: `Erreur lors du chargement de l'image: ${error.message || 'Erreur inconnue'}`
    };
  }
};

/**
 * Charge une image depuis un fichier
 */
const loadImageFromFile = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Impossible de charger l\'image'));
    };
    
    img.src = url;
  });
};

/**
 * Convertit un fichier en DataURL
 */
const fileToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Erreur lors de la lecture du fichier'));
    reader.readAsDataURL(file);
  });
};

/**
 * Compresse une image avec redimensionnement optionnel.
 * Format PNG préserve la transparence ; JPEG pour les photos.
 */
const compressImage = (
  img: HTMLImageElement,
  options: { maxWidth: number; maxHeight: number; quality: number; format: 'image/png' | 'image/jpeg' }
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Impossible d\'obtenir le contexte canvas'));
      return;
    }

    // Calculer les nouvelles dimensions en conservant le ratio
    let { width, height } = img;
    if (width > options.maxWidth || height > options.maxHeight) {
      const ratio = Math.min(options.maxWidth / width, options.maxHeight / height);
      width = width * ratio;
      height = height * ratio;
    }

    canvas.width = width;
    canvas.height = height;

    // Vider le canvas en transparent (évite fond noir) puis dessiner l'image avec son alpha
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const mime = options.format;
    const quality = mime === 'image/jpeg' ? options.quality : undefined;

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Erreur lors de la compression'));
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Erreur lors de la lecture du blob'));
        reader.readAsDataURL(blob);
      },
      mime,
      quality
    );
  });
};

/**
 * Helper pour afficher les erreurs de validation à l'utilisateur
 */
export const showImageValidationError = (error: string) => {
  // Utiliser alert pour l'instant, peut être remplacé par un système de toast plus tard
  alert(`❌ Erreur de validation d'image:\n\n${error}`);
};
