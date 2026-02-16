# Configuration Row Level Security (RLS) pour Supabase

Ce fichier contient les instructions pour configurer Row Level Security (RLS) sur les tables Supabase utilisées par l'application.

## Tables concernées

- `teams` : Table des équipes/clubs
- `settings` : Table des paramètres de configuration

## Configuration RLS

### 1. Activer RLS sur les tables

Exécutez ces commandes SQL dans l'éditeur SQL de Supabase :

```sql
-- Activer RLS sur la table teams
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Activer RLS sur la table settings
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
```

### 2. Politiques RLS pour la table `teams`

#### Politique de lecture (SELECT) - Accès public en lecture
```sql
CREATE POLICY "Allow public read access to teams"
ON teams
FOR SELECT
USING (true);
```

#### Politique d'insertion (INSERT) - Accès public en écriture
```sql
CREATE POLICY "Allow public insert access to teams"
ON teams
FOR INSERT
WITH CHECK (true);
```

#### Politique de mise à jour (UPDATE) - Accès public en écriture
```sql
CREATE POLICY "Allow public update access to teams"
ON teams
FOR UPDATE
USING (true)
WITH CHECK (true);
```

#### Politique de suppression (DELETE) - Accès public en suppression
```sql
CREATE POLICY "Allow public delete access to teams"
ON teams
FOR DELETE
USING (true);
```

### 3. Politiques RLS pour la table `settings`

#### Politique de lecture (SELECT) - Accès public en lecture
```sql
CREATE POLICY "Allow public read access to settings"
ON settings
FOR SELECT
USING (true);
```

#### Politique d'insertion (INSERT) - Accès public en écriture
```sql
CREATE POLICY "Allow public insert access to settings"
ON settings
FOR INSERT
WITH CHECK (true);
```

#### Politique de mise à jour (UPDATE) - Accès public en écriture
```sql
CREATE POLICY "Allow public update access to settings"
ON settings
FOR UPDATE
USING (true)
WITH CHECK (true);
```

#### Politique de suppression (DELETE) - Accès public en suppression (optionnel)
```sql
CREATE POLICY "Allow public delete access to settings"
ON settings
FOR DELETE
USING (true);
```

## Notes importantes

⚠️ **Sécurité** : Ces politiques permettent un accès public complet aux tables. Pour une sécurité renforcée :

1. **Pour un environnement de production**, considérez :
   - Limiter l'accès en écriture aux utilisateurs authentifiés
   - Ajouter des validations supplémentaires côté serveur
   - Utiliser des fonctions Supabase Edge Functions pour les opérations sensibles

2. **Pour un environnement avec authentification utilisateur** :
   - Modifiez les politiques pour utiliser `auth.uid()` au lieu de `true`
   - Exemple : `USING (auth.role() = 'authenticated')`

3. **Pour limiter les opérations** :
   - Retirez les politiques DELETE si la suppression n'est pas nécessaire
   - Ajoutez des contraintes de validation dans les politiques

## Vérification

Après avoir configuré les politiques, testez les opérations depuis l'application :

1. Lecture des équipes depuis `TeamDatabaseManager`
2. Insertion de nouvelles équipes
3. Mise à jour des paramètres depuis `EditorPanel`
4. Vérifiez les logs Supabase pour détecter les erreurs de permissions

## Dépannage

Si vous rencontrez des erreurs de permissions :

1. Vérifiez que RLS est activé : `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`
2. Vérifiez les politiques existantes : `SELECT * FROM pg_policies WHERE tablename IN ('teams', 'settings');`
3. Vérifiez que la clé API utilisée a les bonnes permissions
4. Consultez les logs Supabase dans le dashboard pour plus de détails
