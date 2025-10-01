import { useEffect, useState } from "react";

export default function useColumnSync(gameData) {
  const [attachmentsA, setAttachmentsA] = useState({});
  const [attachmentsB, setAttachmentsB] = useState({});
  const [unitOrderA, setUnitOrderA] = useState([]);
  const [unitOrderB, setUnitOrderB] = useState([]);

  useEffect(() => {
    const a = gameData?.gameState?.columns?.A?.attachments || {};
    setAttachmentsA(a);
  }, [gameData?.gameState?.columns?.A?.attachments]);

  useEffect(() => {
    const b = gameData?.gameState?.columns?.B?.attachments || {};
    setAttachmentsB(b);
  }, [gameData?.gameState?.columns?.B?.attachments]);

  useEffect(() => {
    const orderA = gameData?.gameState?.columns?.A?.unitOrder;
    if (Array.isArray(orderA)) setUnitOrderA(orderA);
  }, [gameData?.gameState?.columns?.A?.unitOrder]);

  useEffect(() => {
    const orderB = gameData?.gameState?.columns?.B?.unitOrder;
    if (Array.isArray(orderB)) setUnitOrderB(orderB);
  }, [gameData?.gameState?.columns?.B?.unitOrder]);

  return {
    attachmentsA,
    setAttachmentsA,
    attachmentsB,
    setAttachmentsB,
    unitOrderA,
    setUnitOrderA,
    unitOrderB,
    setUnitOrderB,
  };
}
