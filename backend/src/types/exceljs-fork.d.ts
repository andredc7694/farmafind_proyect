/** Narrow local types: this fork ships declarations outside its package exports. */
declare module '@excel.js/exceljs' {
  interface Cell { value: unknown; }
  interface Row { getCell(column: number | string): Cell; }
  interface Worksheet {
    readonly actualRowCount: number;
    readonly columnCount: number;
    addRow(values: readonly unknown[]): Row;
    getCell(address: string): Cell;
    eachRow(options: { includeEmpty: boolean }, callback: (row: Row) => void): void;
  }
  class Workbook {
    readonly worksheets: Worksheet[];
    addWorksheet(name: string): Worksheet;
    getWorksheet(name: string): Worksheet;
    readonly xlsx: { load(bytes: Buffer): Promise<void>; writeBuffer(): Promise<Buffer> };
  }
  const ExcelJS: { Workbook: typeof Workbook };
  export default ExcelJS;
}
