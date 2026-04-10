import { useCallback, useEffect, useState } from "react";
import {
  AIConfig,
  AISystemStatus,
  systemAIService,
} from "../services/system-ai";

/**
 * Hook to access System-First AI capabilities.
 * Handles lifecycle management and provides a clean interface for UI components.
 */
export const useSystemAI = () => {
  const [status, setStatus] = useState<AISystemStatus>(
    systemAIService.getStatus(),
  );
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const currentStatus = await systemAIService.checkStatus();
      if (isMounted) setStatus(currentStatus);
    };

    init();

    return () => {
      isMounted = false;
      // Memory Management: Unload model on hook unmount to free up NPU/GPU
      systemAIService.unload();
    };
  }, []);

  const isModelPresent = useCallback(() => {
    return status === AISystemStatus.READY;
  }, [status]);

  const downloadModel = useCallback(async () => {
    try {
      await systemAIService.downloadModel();
      setStatus(systemAIService.getStatus());
    } catch (e) {
      console.error("[useSystemAI] Download failed:", e);
      setStatus(AISystemStatus.ERROR);
    }
  }, []);

  const executePrompt = useCallback(
    async (prompt: string, config?: AIConfig) => {
      setIsProcessing(true);
      try {
        const result = await systemAIService.executePrompt(prompt, config);
        return result;
      } catch (e) {
        console.error("[useSystemAI] Execution failed:", e);
        throw e;
      } finally {
        setIsProcessing(false);
      }
    },
    [],
  );

  return {
    status,
    isProcessing,
    isModelPresent,
    downloadModel,
    executePrompt,
  };
};
