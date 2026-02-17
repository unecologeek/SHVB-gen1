# Déploiement Convex (en dehors de Vercel)

Sur Vercel, la commande de build est uniquement **`npm run build`**. Le déploiement Convex se fait **à part**, depuis ta machine ou ton CI.

## Schéma actuel (sans migration)

- **Table `settings`** : plus de champs `results_bg`, `preview_bg`, `victory_bg`. Un seul document (ou aucun au démarrage).
- **Table `background_images`** : un document par type (`results`, `preview`, `victory`) avec `type` et `image_data` (base64).

Tu peux tout effacer côté Convex et laisser l’app recréer les données.

---

## 1. Déployer le schéma et les fonctions Convex (une fois, depuis ta machine)

À la racine du projet, avec `.env.local` rempli (au moins `VITE_CONVEX_URL` et le `.env.local` généré par Convex si tu as fait `npx convex dev` avant) :

```bash
npx convex deploy
```

Cela pousse :

- le schéma (tables `teams`, `settings` sans les 3 champs image, table `background_images`) ;
- les fonctions (`convex/settings.ts`, `convex/backgroundImages.ts`, `convex/teams.ts`, etc.).

Pas besoin de conversion des anciennes données : on repart sur le nouveau schéma.

---

## 2. (Optionnel) Nettoyer les données dans le dashboard Convex

1. Ouvre [dashboard.convex.dev](https://dashboard.convex.dev) et sélectionne ton déploiement.
2. **Data** :
   - **settings** : tu peux supprimer le document existant si tu veux repartir à zéro. L’app en recréera un si besoin.
   - **background_images** : peut rester vide ; les images seront ajoutées au premier enregistrement depuis l’app.
   - **teams** : à garder si tu veux conserver les équipes ; sinon tu peux tout supprimer.

Aucune action obligatoire : l’app gère un `settings` vide et des `background_images` vides.

---

## 3. Vercel

- **Build Command** : `npm run build` (déjà dans `vercel.json`).
- **Variables d’environnement** : au minimum `VITE_CONVEX_URL` (et `VITE_CONVEX_SITE_URL` si utilisé).

Quand tu modifies le code Convex (`convex/`), redéploie Convex depuis ta machine avec `npx convex deploy` ; le déploiement Vercel ne lance pas Convex.

---

## Récap

| Où        | Action |
|----------|--------|
| **En local** | `npx convex deploy` après toute modification dans `convex/`. |
| **Dashboard Convex** | (Optionnel) Supprimer le document `settings` pour repartir à zéro. |
| **Vercel** | Build = `npm run build` uniquement ; pas de `convex deploy` dans le build. |
