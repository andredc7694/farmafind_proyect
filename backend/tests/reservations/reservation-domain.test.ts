import {describe,expect,it} from 'vitest';
import {canTransition,transitionReservation,TERMINAL_RESERVATION_STATES,isExpired} from '../../src/modules/reservas/domain/reservation.js';
describe('F04 estados exactos',()=>{
  it('permite solo las transiciones aprobadas',()=>{expect(canTransition('PENDIENTE','CONFIRMADA')).toBe(true);expect(canTransition('CONFIRMADA','ENTREGADA')).toBe(true);expect(()=>transitionReservation('CANCELADA','CONFIRMADA')).toThrow();});
  it('mantiene tres estados terminales',()=>expect(TERMINAL_RESERVATION_STATES).toEqual(['ENTREGADA','CANCELADA','EXPIRADA']));
  it('detecta vencimiento pendiente y confirmado',()=>{const now=new Date('2026-11-13T12:00:00Z');expect(isExpired('PENDIENTE',now,new Date('2026-11-13T11:59:00Z'),null)).toBe(true);expect(isExpired('CONFIRMADA',now,new Date('2026-11-13T11:00:00Z'),new Date('2026-11-13T12:01:00Z'))).toBe(false);});
});
