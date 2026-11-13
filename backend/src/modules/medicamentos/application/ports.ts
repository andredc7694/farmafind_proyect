export interface CatalogRow {
  readonly id: string;
  readonly nombre: string;
  readonly concentracion: string;
  readonly presentacion: string;
  readonly clasificacion: string;
}

export interface CatalogSessionReader {
  list(secret: string, query: string, page: number): Promise<readonly CatalogRow[]>;
}
