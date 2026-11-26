// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ImportPreview } from '../src/inventory/ImportPreview.jsx';
import { createInventoryClient } from '../src/inventory/inventory-client.js';

afterEach(cleanup);

const headers = ['medicamento', 'concentracion', 'presentacion', 'condicion_venta', 'precio_regular_sol', 'stock_disponible'];
const mapping = { nombre: 'medicamento', concentracion: 'concentracion', presentacion: 'presentacion', clasificacion: 'condicion_venta',
  precioReferencial: 'precio_regular_sol', cantidadFisica: 'stock_disponible' };
const candidate = (extra = {}) => ({ sheet: 'Precios', headerRow: 1, headers, headerDigest: 'b'.repeat(64), matchedFields: 6, mapping, preguntas: [], ambiguous: [], ...extra });
const analysis = (extra = {}) => ({ huella: 'a'.repeat(64), candidatos: [candidate(extra)], hojasConStock: [], hojasIgnoradas: ['Léeme'] });
const choose = () => { const file = new File(['ficticio'], 'farma.xlsx'); fireEvent.change(screen.getByLabelText('Archivo CSV o XLSX'), { target: { files: [file] } }); return file; };

describe('F02.1 (enmienda 2026-11-25): importación en un paso', () => {
  it('al elegir otro archivo invalida la vista previa anterior', () => {
    const onReset = vi.fn();
    render(<ImportPreview busy={false} onReset={onReset} onPreview={() => {}} onConfirm={() => {}}
      preview={{ importacionId: 'anterior', estado: 'VISTA_PREVIA', caducaEn: new Date().toISOString(), filas: [], errores: [], incidencias: [] }} />);
    choose();
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('analiza solo y pide la vista previa sin botón «Analizar», sin plantilla y sin formulario de columnas visible', async () => {
    const onInspect = vi.fn().mockResolvedValue(analysis()); const onPreview = vi.fn();
    render(<ImportPreview busy={false} onInspect={onInspect} onPreview={onPreview} onConfirm={() => {}} />);
    const file = choose();
    await waitFor(() => expect(onPreview).toHaveBeenCalledWith(file, mapping, { sheet: 'Precios', headerRow: 1, digest: 'a'.repeat(64) }));
    expect(screen.queryByRole('button', { name: /Analizar/ })).toBeNull();
    expect(screen.queryByText(/plantilla/i)).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar columnas' }));
    expect(screen.getByLabelText('Stock').value).toBe('stock_disponible');
  });

  it('si falta o es ambiguo un dato, pregunta únicamente por ese dato', async () => {
    const partial = { ...mapping }; delete partial.cantidadFisica;
    const onPreview = vi.fn();
    render(<ImportPreview busy={false} onInspect={vi.fn().mockResolvedValue({ ...analysis({ mapping: partial, matchedFields: 5, preguntas: [{ campo: 'cantidadFisica', motivo: 'FALTA' }] }),
      hojasConStock: [{ hoja: 'Farmacia', columna: 'existencias' }] })} onPreview={onPreview} onConfirm={() => {}} />);
    choose();
    await screen.findByText(/No encontramos la columna de «Stock»/);
    expect(screen.getByText(/«Farmacia», columna «existencias»/)).toBeTruthy();
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    expect(onPreview).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Stock'), { target: { value: 'stock_disponible' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(onPreview).toHaveBeenCalledOnce());
  });

  it('muestra todos los productos: listos y «pendientes de catálogo», sin permitir confirmar a medias', () => {
    const row = (line, errorCode, nombre) => ({ line, errorCode, priceCents: 450, physicalQuantity: 3, producto: { nombre, concentracion: '10 mg', presentacion: 'caja x 10' } });
    render(<ImportPreview busy={false} onPreview={() => {}} onConfirm={() => {}} preview={{ importacionId: 'p', estado: 'VISTA_PREVIA', caducaEn: new Date().toISOString(),
      filas: [row(2, null, 'conocido'), row(3, 'REFERENCIA_NO_CONCILIADA', 'nuevo')], errores: [{ fila: 3, codigo: 'REFERENCIA_NO_CONCILIADA' }], incidencias: [] }} />);
    expect(screen.getByText('2 productos: 1 listos, 1 pendientes de catálogo, 0 con error.')).toBeTruthy();
    expect(screen.getByText('Pendiente de catálogo')).toBeTruthy(); expect(screen.getByText('nuevo')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirmar archivo completo' }).disabled).toBe(true);
  });

  it('el cliente muestra el error específico del servidor en vez del genérico', async () => {
    const message = 'El libro contiene macros, vínculos externos u objetos incrustados. Guárdalo como .xlsx simple y vuelve a subirlo.';
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ csrfToken: 't' }) })
      .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ code: 'BAD_REQUEST', message }) });
    await expect(createInventoryClient(fetcher).inspect('alfa', new File(['x'], 'a.xlsx'))).rejects.toThrow(message);
  });
});
