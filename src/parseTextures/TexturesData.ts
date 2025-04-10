export interface ParsedTexture {
  [key: string]: string | string[] | undefined | boolean;
  columns?: string[];
  isSameSize?: boolean;
}

export let headers: string[] = [];

const isPowerOfTwo = (num: number): boolean => {
  return (num & (num - 1)) === 0 && num > 0;
};

export const parseTextures = (
  data: string,
  filterMode: "all" | "powerOfTwo" | "notPowerOfTwo" | "oneSidePowerOfTwo",
  selectedGroups: string[],
): ParsedTexture[] => {
  const lines = data
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const headerIndex = lines.findIndex(
    (line) => line.includes("Name") && line.includes("LODGroup"),
  );

  if (headerIndex === -1) {
    console.warn("Header line not found in texture data.");
    return [];
  }

  headers = lines[headerIndex].split(",").map((h) => h.trim());
  const seen = new Set<string>();
  const dataLines = lines.slice(headerIndex + 1);

  return dataLines
    .filter((line) => {
      const parts = line.split(",");
      return parts.length >= headers.length - 1;
    })
    .map((line) => {
      const parts = line.split(",");
      if (parts.length < headers.length - 1) return null;

      const texture: ParsedTexture = {};
      headers.forEach((header, i) => {
        const key = header.trim();
        const value = parts[i]?.trim() ?? "";

        if (key.toLowerCase().includes("lodgroup")) {
          texture["Group"] = value;
        }

        texture[key] = value;
      });

      texture.columns = parts.map((p) => p.trim());

      const group = texture["Group"];
      if (
        typeof group !== "string" ||
        (selectedGroups.length > 0 &&
          !selectedGroups.includes("All Groups") &&
          !selectedGroups.includes(group))
      ) {
        return null;
      }

      const cookedKey = headers.find(
        (h) =>
          h.toLowerCase().includes("maxallowedsize") ||
          h.toLowerCase().includes("cooked/ondisk"),
      );
      const sizeInfo = cookedKey ? (texture[cookedKey] as string) : "";
      if (!sizeInfo) return null;

      console.log(texture);
      const sizeMatch = sizeInfo.match(/(\d+)\s*x\s*(\d+)/i);
      if (!sizeMatch) return null;

      const width = parseInt(sizeMatch[1], 10);
      const height = parseInt(sizeMatch[2], 10);

      const isWPower2 = isPowerOfTwo(width);
      const isHPower2 = isPowerOfTwo(height);

      if (
        (filterMode === "powerOfTwo" && !(isWPower2 && isHPower2)) ||
        (filterMode === "notPowerOfTwo" && (isWPower2 || isHPower2)) ||
        (filterMode === "oneSidePowerOfTwo" && !(isWPower2 !== isHPower2))
      ) {
        return null;
      }

      const key = headers.map((h) => texture[h]).join("|");
      if (seen.has(key)) return null;
      seen.add(key);
      console.log("🔍 Headers:", headers);
      console.log("🧪 Sample texture:", texture);

      return texture;
    })
    .filter(Boolean) as ParsedTexture[];
};
