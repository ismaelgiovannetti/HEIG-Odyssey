import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/server-session";
import { prisma } from "@/lib/prisma";

export interface AdminSession {
  userId: string;
  name: string;
  email: string;
  role: string;
}

/**
 * Vérifie que la requête courante provient d'un compte avec le rôle 'admin'.
 * Redirige vers /login si non connecté, ou /dashboard si non autorisé.
 */
export const requireAdminSession = cache(async (): Promise<AdminSession> => {
  const session = await getServerSession();

  if (!session?.user.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
});

/**
 * Vérification non bloquante du rôle administrateur (pour affichage de badges/liens).
 */
export const isCurrentSessionAdmin = cache(async (): Promise<boolean> => {
  const session = await getServerSession();
  if (!session?.user.id) return false;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  return user?.role === "admin";
});
