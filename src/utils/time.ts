import dayjs from "dayjs";

/**
 * 把 SentinelOne API 的 ISO 8601 UTC 字符串转成用户本地时区的
 * "YYYY-MM-DD HH:mm:ss"。参考 Android TimeUtil.kt。
 * - 空/无效输入原样返回（或占位 "-"）
 * - dayjs 默认就把 ISO Z 解释成 UTC 并输出为本机时区
 */
export function formatLocalTime(iso?: string | null, fallback = "-"): string {
  if (!iso) return fallback;
  const d = dayjs(iso);
  if (!d.isValid()) return iso;
  return d.format("YYYY-MM-DD HH:mm:ss");
}
