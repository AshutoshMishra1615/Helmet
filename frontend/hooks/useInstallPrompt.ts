"use client";

import { useState, useEffect, useRef } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface UseInstallPromptReturn {
  canInstall: boolean;
  isInstalled: boolean;
  triggerInstall: () => Promise<void>;
}

export function useInstallPrompt(): UseInstallPromptReturn {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Check if already running as standalone PWA
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true);

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      promptRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    const appInstalledHandler = () => {
      setIsInstalled(true);
      setCanInstall(false);
      promptRef.current = null;
    };
    window.addEventListener("appinstalled", appInstalledHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", appInstalledHandler);
    };
  }, []);

  const triggerInstall = async () => {
    if (!promptRef.current) return;
    await promptRef.current.prompt();
    const { outcome } = await promptRef.current.userChoice;
    if (outcome === "accepted") {
      setCanInstall(false);
      promptRef.current = null;
    }
  };

  return { canInstall, isInstalled, triggerInstall };
}
