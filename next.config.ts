import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
  // Accès au serveur de dev depuis le réseau local (autre appareil, ou
  // l'adresse IP de la machine) : sans ça, Next bloque ses scripts de dev et
  // la page s'affiche sans aucune interactivité.
  allowedDevOrigins: ["192.168.1.76", "192.168.1.*"],
};

export default nextConfig;
