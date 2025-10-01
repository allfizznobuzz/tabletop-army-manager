import { useRef, useState, useCallback } from "react";
import { updateGameState } from "../firebase/database";
import { parseArmyFile } from "utils/armyParser";

export default function useArmyImport(gameId) {
  const inputARef = useRef(null);
  const inputBRef = useRef(null);
  const [uploadErrorA, setUploadErrorA] = useState("");
  const [uploadErrorB, setUploadErrorB] = useState("");

  const importArmyFromFile = useCallback(
    async (columnKey, file) => {
      if (!file || !file.name.toLowerCase().endsWith(".json")) {
        const msg = `Unsupported file type for ${file ? file.name : "unknown file"}. Please select a .json file.`;
        columnKey === "A" ? setUploadErrorA(msg) : setUploadErrorB(msg);
        return;
      }
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const parsed = parseArmyFile(json);
        const base = columnKey === "A" ? "playerA" : "playerB";
        const order = (parsed.units || []).map(
          (_, i) => `${columnKey}_unit_${i}`,
        );
        await updateGameState(gameId, {
          [`${base}.armyData`]: parsed,
          [`gameState.columns.${columnKey}.attachments`]: {},
          [`gameState.columns.${columnKey}.unitOrder`]: order,
        });
        // clear errors
        columnKey === "A" ? setUploadErrorA("") : setUploadErrorB("");
      } catch (e) {
        const msg = `Failed to import ${file.name}: ${e.message || e}`;
        columnKey === "A" ? setUploadErrorA(msg) : setUploadErrorB(msg);
      }
    },
    [gameId],
  );

  const onFileInputChange = useCallback(
    async (columnKey, e) => {
      const files = e.target.files;
      if (files && files[0]) {
        await importArmyFromFile(columnKey, files[0]);
        // reset input so selecting the same file again triggers change
        e.target.value = "";
      }
    },
    [importArmyFromFile],
  );

  const onDragOverZone = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDropZone = useCallback(
    async (columnKey, e) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer?.files?.[0];
      if (file) await importArmyFromFile(columnKey, file);
    },
    [importArmyFromFile],
  );

  return {
    inputARef,
    inputBRef,
    uploadErrorA,
    uploadErrorB,
    onFileInputChange,
    onDragOverZone,
    onDropZone,
  };
}
