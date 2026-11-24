import { describe, expect, it, vi } from 'vitest';
import { ImportProfiles } from '../../src/modules/inventario/application/import-profiles.js';
import type { InventoryUnitOfWork } from '../../src/modules/inventario/application/ports.js';
import { isImportProfileCompatible } from '../../src/modules/inventario/domain/importacion.js';

describe('F02.1: permisos de perfiles por farmacia', () => {
  it('lista con permiso de vista previa y guarda solo con permiso de confirmación', async () => {
    const profiles = vi.fn().mockResolvedValue([{ id: 'perfil-a' }]);
    const saveProfile = vi.fn().mockResolvedValue({ id: 'perfil-nuevo' });
    const run = vi.fn(async (_secret, _pharmacy, _capability, work) =>
      work({ imports: { profiles, saveProfile } }, { actorUserId: 'actor-a' }));
    const service = new ImportProfiles({ run } as unknown as InventoryUnitOfWork);
    expect(await service.list('sesion', 'alfa')).toEqual([{ id: 'perfil-a' }]);
    expect(await service.save('sesion', 'alfa', 'vista-previa', 'Formato Alfa')).toEqual({ id: 'perfil-nuevo' });
    expect(run.mock.calls.map(call => call[2])).toEqual(['inventory.import.preview','inventory.import.confirm']);
    expect(saveProfile).toHaveBeenCalledWith('vista-previa', 'Formato Alfa');
  });

  it('rechaza nombres vacíos, extensos o con contenido de control antes de transacción', async () => {
    const run = vi.fn();
    const service = new ImportProfiles({ run } as unknown as InventoryUnitOfWork);
    for (const name of ['', ' '.repeat(2), '<script>', 'x'.repeat(81)]) {
      await expect(service.save('sesion', 'alfa', 'preview', name)).rejects.toThrow();
    }
    expect(run).not.toHaveBeenCalled();
  });

  it('aplica un perfil solo a la misma versión, hoja y huella de encabezados', () => {
    const profile = { version: 1, headerDigest: 'a'.repeat(64), sheet: 'Inventario', headerRow: 2 };
    expect(isImportProfileCompatible(profile, 'a'.repeat(64), 'Inventario', 2)).toBe(true);
    expect(isImportProfileCompatible(profile, 'b'.repeat(64), 'Inventario', 2)).toBe(false);
    expect(isImportProfileCompatible(profile, 'a'.repeat(64), 'Otra', 2)).toBe(false);
    expect(isImportProfileCompatible({ ...profile, version: 2 }, 'a'.repeat(64), 'Inventario', 2)).toBe(false);
  });
});
