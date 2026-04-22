import type { Exclusion } from "./s1";

// 参考 SentinelOne_UI/ExclusionsPage.cpp：
// cloud 下发 / 威胁联动下发 的内置条目一并隐藏
export function isBuiltinExclusion(e: Exclusion): boolean {
  const src = (e.source ?? "").trim();
  if (src === "cloud" || src === "action_from_threat") return true;
  const desc = (e.description ?? "").toLowerCase();
  if (desc.includes("detected by sentinelone cloud")) return true;
  return false;
}
