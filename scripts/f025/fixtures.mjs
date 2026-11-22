/** Form inputs for an isolated F02.5 TEST/DEMO. No users, roles, tenants or stock are provisioned here. */
export const F025_TEST_APPLICATIONS = Object.freeze([
  ['alfa', 'Farmacia Alfa TEST', 'Calle Ficticia Alfa 101'],
  ['beta', 'Farmacia Beta TEST', 'Calle Ficticia Beta 202'],
  ['gamma', 'Farmacia Gamma TEST', 'Calle Ficticia Gamma 303'],
  ['delta', 'Farmacia Delta TEST', 'Calle Ficticia Delta 404'],
  ['epsilon', 'Farmacia Épsilon TEST', 'Calle Ficticia Épsilon 505'],
].map(([key, nombreComercial, direccion]) => Object.freeze({
  key,
  application: Object.freeze({
    nombreComercial,
    contacto: `${key}@example.invalid`,
    direccion,
    departamento: 'Lima',
    provincia: 'Lima',
    distrito: 'Distrito DEMO',
    representante: `Persona Ficticia ${key}`,
  }),
})));
