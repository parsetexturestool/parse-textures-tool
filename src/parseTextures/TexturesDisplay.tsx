import React, { useState, useMemo } from "react";
import { parseTextures, ParsedTexture, headers } from "./TexturesData";
import { ChevronUp, ChevronDown, X } from "lucide-react";

const TexturesDisplay: React.FC = () => {
  const [filterMode, setFilterMode] = useState<
    "all" | "powerOfTwo" | "notPowerOfTwo" | "oneSidePowerOfTwo"
  >("all");
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("All");
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [texturesPerPage] = useState<number>(50);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [uploadedData, setUploadedData] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc" | null;
  }>({ key: "", direction: null });

  const disciplinesData = useMemo(() => {
    const parseDisciplines = (data: string): Record<string, string[]> => {
      const disciplines: Record<string, string[]> = {};
      let currentDiscipline: string | null = null;
      let textures: string[] = [];
      let collecting = false;
      let headerLineSeen = false;

      const lines = data.split("\n");

      lines.forEach((line) => {
        if (line.startsWith("MemReport: Begin command")) {
          currentDiscipline = line
            .replace("MemReport: Begin command ", "")
            .trim();
          textures = [];
          collecting = false;
          headerLineSeen = false;
        } else if (line.startsWith("Listing")) {
          collecting = true;
          headerLineSeen = false;
        } else if (collecting && !headerLineSeen) {
          textures.push(line.trim());
          headerLineSeen = true;
        } else if (collecting && line.startsWith("Total size:")) {
          if (currentDiscipline) {
            disciplines[currentDiscipline] = textures;
          }
          collecting = false;
        } else if (collecting) {
          textures.push(line.trim());
        }
      });

      return disciplines;
    };

    return parseDisciplines(uploadedData ?? "");
  }, [uploadedData]);

  const disciplineNames = useMemo(
    () => ["All", ...Object.keys(disciplinesData)],
    [disciplinesData],
  );

  const extractTextureGroups = (
    selectedDiscipline: string,
    disciplinesData: Record<string, string[]>,
  ): string[] => {
    if (!disciplinesData) return [];
    let textures: string[] = [];

    if (selectedDiscipline === "All") {
      textures = Object.values(disciplinesData).flat();
    } else {
      textures = disciplinesData[selectedDiscipline] || [];
    }

    const uniqueGroups = new Set<string>();

    textures.forEach((line) => {
      const match = line.match(/TEXTUREGROUP_\w+/);
      if (match) {
        uniqueGroups.add(match[0]);
      }
    });

    return Array.from(uniqueGroups);
  };
  const textureGroups = useMemo(() => {
    const groups = extractTextureGroups(selectedDiscipline, disciplinesData);
    return ["All Groups", ...groups];
  }, [selectedDiscipline, disciplinesData]);

  const toggleGroup = (group: string) => {
    setSelectedGroups((prev) => {
      if (group === "All Groups") {
        return prev.includes("All Groups") ? [] : ["All Groups"];
      }
      const isSelected = prev.includes(group);
      const filtered = prev.filter((g) => g !== group && g !== "All Groups");
      return isSelected ? filtered : [...filtered, group];
    });
  };
  const handleCopyTextures = () => {
    const dataToCopy = filteredTextures
      .map((texture) => texture.columns?.join(", ") || "")
      .join("\n");

    navigator.clipboard
      .writeText(dataToCopy)
      .then(() => alert("Textures copied to clipboard!"))
      .catch((err) => console.error("Failed to copy textures:", err));
  };

  const handleCopyWithShortName = () => {
    const dataToCopy = filteredTextures
      .map((texture) =>
        [texture["ShortName"], ...(texture.columns || [])].join(", "),
      )
      .join("\n");

    navigator.clipboard
      .writeText(dataToCopy)
      .then(() => alert("Textures with ShortName copied to clipboard!"))
      .catch((err) => console.error("Failed to copy with ShortName:", err));
  };

  const compareSizes = (size1: string, size2: string) => {
    const match1 = size1.match(/(\d+)x(\d+)/);
    const match2 = size2.match(/(\d+)x(\d+)/);
    if (match1 && match2) {
      return (
        parseInt(match1[1]) === parseInt(match2[1]) &&
        parseInt(match1[2]) === parseInt(match2[2])
      );
    }
    return false;
  };

  const filteredTextures: ParsedTexture[] = useMemo(() => {
    if (!uploadedData) return [];
    const textures =
      selectedDiscipline === "All"
        ? Object.values(disciplinesData).flat()
        : disciplinesData[selectedDiscipline] || [];

    let data = "";
    if (textures.length > 0) {
      const headerLine =
        selectedDiscipline === "All"
          ? Object.values(disciplinesData).find((v) => v.length > 0)?.[0] || ""
          : disciplinesData[selectedDiscipline]?.[0] || "";

      const bodyLines =
        selectedDiscipline === "All"
          ? Object.values(disciplinesData).flatMap((lines) => lines.slice(1))
          : textures.slice(1);
      data = [headerLine, ...bodyLines].join("\n");
    }

    let textureData = parseTextures(data, filterMode, selectedGroups);

    let updatedTextures = textureData.map((texture) => {
      const cookedKey = headers.find(
        (h) =>
          h.toLowerCase().includes("maxallowedsize") ||
          h.toLowerCase().includes("cooked/ondisk"),
      );
      const inMemKey = headers.find((h) => h.toLowerCase().includes("inmem"));

      const cookedSize = cookedKey ? texture[cookedKey] : "";
      const inMemSize = inMemKey ? texture[inMemKey] : "";

      const fullPath = texture["Name"] as string;
      const lastSegment = fullPath.split("/").pop();
      const short = lastSegment?.split(".")[0] ?? fullPath;

      texture["ShortName"] = short;

      return {
        ...texture,
        isSameSize: compareSizes(String(cookedSize), String(inMemSize)),
      };
    });

    if (sortConfig.key && sortConfig.direction) {
      updatedTextures = [...updatedTextures].sort((a, b) => {
        const aVal = (a as any)[sortConfig.key];
        const bVal = (b as any)[sortConfig.key];

        const isNumeric = !isNaN(Number(aVal)) && !isNaN(Number(bVal));
        if (isNumeric) {
          return sortConfig.direction === "asc"
            ? Number(aVal) - Number(bVal)
            : Number(bVal) - Number(aVal);
        }

        return sortConfig.direction === "asc"
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
    }

    return updatedTextures;
  }, [
    uploadedData,
    selectedDiscipline,
    filterMode,
    selectedGroups,
    disciplinesData,
    sortConfig,
  ]);

  const indexOfLastTexture = currentPage * texturesPerPage;
  const indexOfFirstTexture = indexOfLastTexture - texturesPerPage;
  const currentTextures = filteredTextures.slice(
    indexOfFirstTexture,
    indexOfLastTexture,
  );

  const toggleColumn = (column: string) => {
    setHiddenColumns((prev) =>
      prev.includes(column)
        ? prev.filter((c) => c !== column)
        : [...prev, column],
    );
  };

  const handleSort = (column: string) => {
    setSortConfig((prev) => {
      if (prev.key === column) {
        return {
          key: column,
          direction:
            prev.direction === "asc"
              ? "desc"
              : prev.direction === "desc"
                ? null
                : "asc",
        };
      }
      return { key: column, direction: "asc" };
    });
  };

  const getSortIcon = (header: string) => {
    if (sortConfig.key !== header) return null;
    if (sortConfig.direction === "asc") return <ChevronUp size={14} />;
    if (sortConfig.direction === "desc") return <ChevronDown size={14} />;
    return <X size={14} />;
  };

  const allHeaders = ["ShortName", ...headers];

  return (
    <div>
      <h2>Textures ({filteredTextures.length} total)</h2>

      <div>
        <input
          type="file"
          accept=".memreport,.txt"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => setUploadedData(e.target?.result as string);
            reader.readAsText(file);
          }}
        />
      </div>
      <hr></hr>
      <div>
        <label>Discipline:</label>
        <select
          value={selectedDiscipline}
          onChange={(e) => setSelectedDiscipline(e.target.value)}
        >
          {disciplineNames.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </div>
      <hr></hr>
      <div>
        <button onClick={() => setFilterMode("all")}>Show All</button>
        <button onClick={() => setFilterMode("powerOfTwo")}>Power of 2</button>
        <button onClick={() => setFilterMode("notPowerOfTwo")}>
          Not Power of 2
        </button>
        <button onClick={() => setFilterMode("oneSidePowerOfTwo")}>
          One Side Power of 2
        </button>
      </div>
      <hr></hr>
      <div>
        <label>Groups:</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {textureGroups.map((group) => (
            <button
              key={group}
              onClick={() => toggleGroup(group)}
              style={{
                padding: "4px 8px",
                borderRadius: "4px",
                border: selectedGroups.includes(group)
                  ? "2px solid black"
                  : "1px solid gray",
                background: selectedGroups.includes(group) ? "#ddd" : "#fff",
              }}
            >
              {group}
            </button>
          ))}
        </div>
      </div>
      <hr></hr>
      <div>
        Toggle Bnts
        <br></br>
        {["ShortName", ...headers].map((h, i) => (
          <button key={i} onClick={() => toggleColumn(h)}>
            {h}
          </button>
        ))}
      </div>
      <hr></hr>
      <div>
        <button onClick={handleCopyTextures}>Copy Without ShortName</button>
        <button onClick={handleCopyWithShortName}>Copy With ShortName</button>
      </div>
      <hr></hr>
      <div>
        <button
          onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
          disabled={currentPage === 1}
        >
          Prev
        </button>
        <button
          onClick={() => setCurrentPage((p) => p + 1)}
          disabled={indexOfLastTexture >= filteredTextures.length}
        >
          Next
        </button>
      </div>

      <table
        style={{
          fontSize: "10px",
        }}
      >
        <thead>
          <tr>
            {allHeaders.map((header, i) =>
              hiddenColumns.includes(header) ? null : (
                <th
                  key={i}
                  onClick={() => handleSort(header)}
                  style={{ cursor: "pointer", userSelect: "none" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    {header} {getSortIcon(header)}
                  </div>
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {currentTextures.map((texture, i) => (
            <tr
              key={i}
              style={{
                backgroundColor: texture.isSameSize
                  ? "rgba(56, 255, 103, 0.09)"
                  : "rgba(244, 38, 55, 0.09)",
              }}
            >
              {allHeaders.map((header, j) =>
                hiddenColumns.includes(header) ? null : (
                  <td key={j}>{(texture as any)[header]}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TexturesDisplay;
