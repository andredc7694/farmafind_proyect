const ids = new Set(['frontend', 'farmafind-api', 'farmafind-notifications']);
const roles = new Set(['SPA estática', 'núcleo modular', 'proceso independiente']);
import { isOwned } from './process-supervisor.mjs';
const roleFor = { frontend: 'SPA estática', 'farmafind-api': 'núcleo modular', 'farmafind-notifications': 'proceso independiente' };
const next = { not_started: ['starting', 'failed'], starting: ['running', 'failed'], running: ['stopping', 'failed'], stopping: ['stopped', 'failed'], stopped: ['starting'], failed: ['stopping', 'stopped'] };

export function createComponent({ componentId, role, host, port, mode }, existing = []) {
  if (!ids.has(componentId) || !roles.has(role) || roleFor[componentId] !== role || host !== '127.0.0.1' || !Number.isInteger(port) || port < 1 || port > 65535 || mode !== 'bootstrap') throw new Error('Componente F00 inválido');
  if (existing.some(item => item.componentId === componentId || item.port === port)) throw new Error('Componente o puerto duplicado en la preparación');
  return { componentId, role, host, port, mode, lifecycle: 'not_started', observableCheck: 'pending', processOwnership: null };
}

export function transition(component, target) {
  if (!next[component.lifecycle]?.includes(target)) throw new Error('Transición inválida');
  component.lifecycle = target;
  return component;
}

export function claimProcess(component, child) {
  if (!isOwned(child) || !Number.isInteger(child.pid)) throw new Error('PID ajeno al supervisor');
  component.processOwnership = { pid: child.pid, launchedBySupervisor: true };
  return component;
}
