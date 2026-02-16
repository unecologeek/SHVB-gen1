# Configuration CORS pour Appwrite

Si vous rencontrez des erreurs CORS avec Appwrite sur Vercel, suivez ces étapes :

## Erreur typique

```
CORS Missing Allow Origin
Blocage d'une requête multiorigines (Cross-Origin Request) : la politique « Same Origin » ne permet pas de consulter la ressource distante située sur https://fra.cloud.appwrite.io/v1/...
```

## Solution : Configurer les domaines autorisés dans Appwrite

1. **Connectez-vous à votre dashboard Appwrite**
   - Allez sur https://cloud.appwrite.io
   - Sélectionnez votre projet (ID: `699355c300394ef69de9`)

2. **Accédez aux paramètres du projet**
   - Cliquez sur **Settings** dans le menu de gauche
   - Allez dans l'onglet **Domains** ou **Web** (selon votre version d'Appwrite)

3. **Ajoutez votre domaine Vercel**
   - Ajoutez votre domaine de production : `https://shvb-gen1.vercel.app`
   - Si vous avez des previews, vous pouvez aussi ajouter : `https://*.vercel.app` (wildcard)
   - Pour le développement local, ajoutez : `http://localhost:3000`

4. **Sauvegardez les modifications**

5. **Redéployez votre application Vercel** (si nécessaire)

## Domaines à ajouter

- **Production** : `https://shvb-gen1.vercel.app`
- **Preview/Staging** : `https://*.vercel.app` (optionnel, pour toutes les previews)
- **Local** : `http://localhost:3000` (pour le développement)

## Vérification

Après avoir configuré les domaines, l'application devrait automatiquement :
1. Tenter de se connecter à Appwrite
2. Si CORS bloque, basculer automatiquement vers Supabase
3. Si Supabase échoue aussi, utiliser le cache local

Le système détecte automatiquement les erreurs CORS et bascule vers une source alternative sans crash.

## Note importante

Les erreurs CORS ne peuvent **pas** être résolues côté code - elles nécessitent une configuration serveur dans Appwrite. Le code gère maintenant ces erreurs gracieusement en basculant vers Supabase ou le cache local.
