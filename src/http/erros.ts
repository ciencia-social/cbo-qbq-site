export class Problema extends Error {
  constructor(
    readonly status: number,
    readonly tipo: string,
    readonly titulo: string,
    readonly detalhe: string,
    readonly dica?: string,
    readonly sugestoes?: unknown,
    readonly retryAfter?: number,
  ) {
    super(detalhe);
  }

  corpo() {
    return {
      tipo: this.tipo,
      titulo: this.titulo,
      status: this.status,
      detalhe: this.detalhe,
      ...(this.dica ? { dica: this.dica } : {}),
      ...(this.sugestoes !== undefined ? { sugestoes: this.sugestoes } : {}),
    };
  }
}

export function parametro(nome: string, detalhe: string, aceitos?: readonly string[]) {
  const dica = aceitos?.length ? `Valores aceitos para ${nome}: ${aceitos.join(", ")}.` : undefined;
  return new Problema(400, "/v1/problemas/parametro-invalido", "Parâmetro inválido", detalhe, dica, aceitos);
}

export function codigoMalformado(entrada: string) {
  return new Problema(
    400,
    "/v1/problemas/codigo-malformado",
    "Código malformado",
    `A entrada "${entrada}" não é um código CBO. O formato tem 1, 2, 3, 4 ou 6 dígitos.`,
    "Ocupação: 212405 ou 2124-05. Família: 4 dígitos, como 2124. Um número sem zero à esquerda, como 10105, só é aceito quando 010105 existe.",
  );
}
