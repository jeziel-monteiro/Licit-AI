const moneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function money(value: number | null): string {
  return value === null ? "Não informado" : moneyFormatter.format(value);
}
// As datas sem offset do PNCP são preservadas, sem interpretação pelo fuso do navegador.
export function sourceDate(value: string | null, withTime = false): string {
  if (!value) return "Não informado";
  if (withTime && /(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    const parts = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
    const part = (type: string) => parts.find((v) => v.type === type)!.value;
    return `${part("day")}/${part("month")}/${part("year")} às ${part("hour")}:${part("minute")} (Brasília)`;
  }
  const date = value.slice(0, 10).split("-").reverse().join("/");
  return withTime && value.length >= 16 ? `${date} às ${value.slice(11, 16)} (Brasília)` : date;
}
export function collectionDate(value: string | null): string {
  if (!value) return "Nenhuma coleta";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
export function saoPauloDay(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return ["year", "month", "day"].map((p) => parts.find((v) => v.type === p)!.value).join("-");
}
export function recentPeriod(days = 3): { from: string; to: string } {
  const to = saoPauloDay();
  const from = new Date(`${to}T12:00:00Z`);
  from.setUTCDate(from.getUTCDate() - days + 1);
  return { from: from.toISOString().slice(0, 10), to };
}
