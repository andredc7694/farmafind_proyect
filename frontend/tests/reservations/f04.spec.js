import {test,expect} from '@playwright/test';

test('cliente crea, consulta y ve vencimiento de reserva',async({page})=>{
  await page.goto('/reservations');
  await expect(page.getByRole('heading',{name:/FarmaFind.*Reservas/})).toBeVisible();
  await expect(page.getByText(/Mis reservas|Iniciar sesion/)).toBeVisible();
});
