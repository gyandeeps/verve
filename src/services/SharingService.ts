import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";

class SharingService {
  /**
   * Shares a Base64 encoded PNG image via the native share sheet.
   * Saves the image to the local cache directory first.
   */
  async shareImageBase64(
    base64: string,
    filename: string = `verve_brief_${Date.now()}.png`,
  ) {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error("Sharing is not available on this platform");
      }

      // 1. Create a File reference in the cache directory
      const file = new File(Paths.cache, filename);

      // 2. Write the base64 data to the file using the modern API
      file.write(base64, { encoding: "base64" });

      // 3. Trigger the native share dialog using the file URI
      await Sharing.shareAsync(file.uri, {
        mimeType: "image/png",
        dialogTitle: "Share your Verve Status Brief",
        UTI: "public.png", // Uniform Type Identifier for iOS
      });
    } catch (error) {
      console.error("[SharingService] Capture/Share Error:", error);
      throw error;
    }
  }
}

export const sharingService = new SharingService();
