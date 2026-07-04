"use client";

import { useEffect, useState } from "react";
import { demoOpsData, type OpsData } from "./ops-data";

export function useOpsData() {
  const [data, setData] = useState<OpsData>(demoOpsData);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/ops", { cache: "no-store" });
      if (response.ok) {
        setData(await response.json());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return { data, loading, refresh };
}
