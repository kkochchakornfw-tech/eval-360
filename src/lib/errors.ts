/** Show our own Thai validation messages from the database; hide raw driver errors. */
export function dbMessage(
  message: string | undefined,
  fallback = "บันทึกไม่สำเร็จ กรุณาลองใหม่",
): string {
  return message && /[฀-๿]/.test(message) ? message : fallback;
}
