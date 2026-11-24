// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ImportPreview } from '../src/inventory/ImportPreview.jsx';

afterEach(cleanup);

describe('F02.1: preparación asistida en React', () => {
  it('invalida la vista previa anterior al elegir otro archivo', () => {
    const onReset = vi.fn();
    render(<ImportPreview busy={false} onReset={onReset} onPreview={() => {}}
      onConfirm={() => {}} preview={{ importacionId: 'anterior', estado: 'VISTA_PREVIA',
        caducaEn: new Date().toISOString(), filas: [], errores: [], incidencias: [] }} />);
    fireEvent.change(screen.getByLabelText('Archivo CSV o XLSX'),
      { target: { files: [new File(['nuevo'], 'nuevo.csv')] } });
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('exige selección explícita y permite corregir el mapeo antes de la vista previa', async () => {
    const onInspect = vi.fn().mockResolvedValue({ huella: 'a'.repeat(64), candidatos: [
      { sheet: 'Inventario', headerRow: 2, matchedFields: 6, headerDigest: 'b'.repeat(64),
        ambiguous: [], mapping: { nombre: 'Medicamento', precioReferencial: 'Precio unitario' } },
    ] });
    const onPreview = vi.fn();
    render(<ImportPreview busy={false} onInspect={onInspect} onPreview={onPreview}
      onConfirm={() => {}} />);
    const file = new File(['ficticio'], 'inventario.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByLabelText('Archivo CSV o XLSX'), { target: { files: [file] } });
    fireEvent.click(screen.getByText('Analizar hojas y encabezados'));
    await screen.findByText(/Selecciona una opción para revisar/);
    expect(screen.getByText('Preparar vista previa').disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Hoja y fila de encabezado'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('nombre'), { target: { value: 'Medicamento corregido' } });
    fireEvent.submit(screen.getByText('Preparar vista previa').closest('form'));
    await waitFor(() => expect(onPreview).toHaveBeenCalledWith(file,
      expect.objectContaining({ nombre: 'Medicamento corregido', precioReferencial: 'Precio unitario' }),
      { sheet: 'Inventario', headerRow: 2, digest: 'a'.repeat(64) }));
  });

  it('exige resolver columnas ambiguas antes de preparar la vista previa', async () => {
    const onPreview = vi.fn();
    render(<ImportPreview busy={false} onInspect={vi.fn().mockResolvedValue({ huella: 'a'.repeat(64),
      candidatos: [{ sheet: 'CSV', headerRow: 1, matchedFields: 5, headerDigest: 'b'.repeat(64),
        ambiguous: ['nombre'], mapping: { precioReferencial: 'Precio' } }] })}
      onPreview={onPreview} onConfirm={() => {}} />);
    fireEvent.change(screen.getByLabelText('Archivo CSV o XLSX'),
      { target: { files: [new File(['ficticio'], 'ambiguo.csv')] } });
    fireEvent.click(screen.getByText('Analizar hojas y encabezados'));
    await screen.findByText(/Selecciona una opción para revisar/);
    fireEvent.change(screen.getByLabelText('Hoja y fila de encabezado'), { target: { value: '0' } });
    expect(screen.getByLabelText('nombre').value).toBe('');
    fireEvent.click(screen.getByText('Preparar vista previa'));
    expect(onPreview).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('nombre'), { target: { value: 'Medicamento' } });
    fireEvent.submit(screen.getByText('Preparar vista previa').closest('form'));
    await waitFor(() => expect(onPreview).toHaveBeenCalledOnce());
  });

  it('solo ofrece perfiles compatibles y guarda mediante acción explícita', async () => {
    const candidate = { sheet: 'CSV', headerRow: 1, matchedFields: 6,
      headerDigest: 'c'.repeat(64), ambiguous: [], mapping: { nombre: 'Medicamento' } };
    const onInspect = vi.fn().mockResolvedValue({ huella: 'd'.repeat(64), candidatos: [candidate] });
    const onProfiles = vi.fn().mockResolvedValue([
      { id: 'compatible', name: 'Formato Alfa', headerDigest: candidate.headerDigest,
        sheet: 'CSV', headerRow: 1, version: 1, mapping: { nombre: 'Producto' } },
      { id: 'ajeno-formato', name: 'Otro formato', headerDigest: 'e'.repeat(64),
        sheet: 'CSV', headerRow: 1, version: 1, mapping: { nombre: 'No aplicar' } },
    ]);
    const onSaveProfile = vi.fn().mockResolvedValue({ id: 'nuevo', name: 'Nuevo formato' });
    render(<ImportPreview busy={false} onInspect={onInspect} onProfiles={onProfiles}
      onSaveProfile={onSaveProfile} onPreview={() => {}} onConfirm={() => {}}
      preview={{ importacionId: 'preview-a', estado: 'VISTA_PREVIA', caducaEn: new Date().toISOString(),
        filas: [], errores: [], incidencias: [] }} />);
    fireEvent.change(screen.getByLabelText('Archivo CSV o XLSX'),
      { target: { files: [new File(['demo'], 'demo.csv')] } });
    fireEvent.click(screen.getByText('Analizar hojas y encabezados'));
    await screen.findByText(/Selecciona una opción para revisar/);
    fireEvent.change(screen.getByLabelText('Hoja y fila de encabezado'), { target: { value: '0' } });
    expect(screen.getByText('Formato Alfa')).toBeTruthy();
    expect(screen.queryByText('Otro formato')).toBeNull();
    fireEvent.change(screen.getByLabelText('Perfil compatible de esta farmacia'),
      { target: { value: 'compatible' } });
    expect(screen.getByLabelText('nombre').value).toBe('Producto');
    fireEvent.change(screen.getByLabelText('Nombre del perfil de columnas'),
      { target: { value: 'Nuevo formato' } });
    fireEvent.click(screen.getByText('Guardar perfil para esta farmacia'));
    await waitFor(() => expect(onSaveProfile).toHaveBeenCalledWith('preview-a', 'Nuevo formato'));
  });
});
