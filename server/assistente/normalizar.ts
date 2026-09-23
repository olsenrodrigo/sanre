/**
 * Normalização de texto para a detecção de intenção do roteiro.
 * "Óculos de Sol RAY-BAN até R$ 500!" → "oculos de sol ray-ban ate r$ 500"
 */

export function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function normalizar(s: string): string {
  return semAcento(s)
    .toLowerCase()
    .replace(/[^a-z0-9$,.\-\s]/g, " ")
    .replace(/(?<![0-9])[.,](?![0-9])/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Chave para comparar nomes: "Ray-Ban" e "rayban" viram "rayban". */
export function chave(s: string | null | undefined): string {
  return semAcento(String(s ?? ""))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Remove caracteres de controle (o byte nulo derruba query no Postgres). */
export function limparControle(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}
