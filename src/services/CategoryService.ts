import { databaseService } from "../db/DatabaseService";
import { aiService } from "./AIService";
import { getAppCategorizationPrompt } from "../constants/Prompts";

export type AppCategory =
  | "Communication"
  | "Deep Work"
  | "Browsing"
  | "Admin"
  | "Entertainment"
  | "Unknown";

class CategoryService {
  /**
   * Identifies the category of an application, using a local SQLite cache
   * with a fallback to the Phi-4-mini model for zero-shot classification.
   */
  async getCategory(
    appName: string,
    windowTitle?: string,
  ): Promise<AppCategory> {
    // 1. Check Local Cache
    const cached = await databaseService.getAppCategory(appName);
    if (cached) {
      return cached as AppCategory;
    }

    // 2. Handle Browsers (Extract from Window Title)
    if (this.isBrowser(appName)) {
      const browserCategory = this.classifyBrowserContent(windowTitle);
      if (browserCategory !== "Unknown") return browserCategory;
    }

    // 3. LLM Fallback (Zero-Shot Classification)
    try {
      console.log(`[CategoryService] Classifying unknown app: ${appName}`);
      const prompt = getAppCategorizationPrompt(appName, windowTitle);

      const result = await aiService.generateSummary(prompt);
      const category = this.parseCategory(result);

      if (category !== "Unknown") {
        await databaseService.setAppCategory(appName, category);
      }
      return category;
    } catch (err) {
      console.warn("[CategoryService] AI classification failed:", err);
      return "Unknown";
    }
  }

  private isBrowser(appName: string): boolean {
    const browsers = [
      "com.google.Chrome",
      "com.apple.Safari",
      "org.mozilla.firefox",
      "chrome.exe",
      "msedge.exe",
    ];
    return browsers.some((b) => appName.includes(b));
  }

  private classifyBrowserContent(windowTitle?: string): AppCategory {
    if (!windowTitle) return "Unknown";
    const title = windowTitle.toLowerCase();

    if (
      title.includes("slack") ||
      title.includes("discord") ||
      title.includes("teams") ||
      title.includes("whatsapp")
    ) {
      return "Communication";
    }
    if (
      title.includes("jira") ||
      title.includes("github") ||
      title.includes("figma") ||
      title.includes("Linear")
    ) {
      return "Deep Work";
    }
    if (
      title.includes("youtube") ||
      title.includes("netflix") ||
      title.includes("reddit")
    ) {
      return "Entertainment";
    }
    return "Browsing";
  }

  private parseCategory(aiResult: string): AppCategory {
    const clean = aiResult.trim().toLowerCase();
    if (clean.includes("communication")) return "Communication";
    if (clean.includes("deep work")) return "Deep Work";
    if (clean.includes("browsing")) return "Browsing";
    if (clean.includes("admin")) return "Admin";
    if (clean.includes("entertainment")) return "Entertainment";
    return "Unknown";
  }
}

export const categoryService = new CategoryService();
