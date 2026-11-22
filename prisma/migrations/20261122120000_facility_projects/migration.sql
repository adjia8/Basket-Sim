-- Projets d'infrastructure (centre d'entraînement, salle) : chantiers,
-- paliers livrés, emprunts — voir facility-projects-rules.ts.
ALTER TABLE "TeamState" ADD COLUMN "facilityProjectsJson" TEXT;
