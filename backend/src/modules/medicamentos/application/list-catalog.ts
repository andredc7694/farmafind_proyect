import type { CatalogSessionReader, CatalogRow } from './ports.js';

/** Catalog is shared, but internal F02 reading still requires a live scoped capability. */
export class ListCatalog {
  constructor(private readonly reader: CatalogSessionReader) {}

  async run(secret: string, query: string, page: number): Promise<readonly CatalogRow[]> {
    return this.reader.list(secret, query, page);
  }
}
