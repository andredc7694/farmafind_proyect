// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ACTIVE_SEARCH_PLACES, HUAMANGA_DISTRICTS, SEARCH_PLACES_SCOPE, filterPlaces, findSearchPlace, placesScope, searchPlaces }
  from '../../src/search/search-places.js';
import { PERU_PLACES, findPeruPlace } from '../../src/geolocation/peru-cities.js';
import { WhereDialog } from '../../src/search/WhereDialog.jsx';

afterEach(cleanup);
const OFFICIAL = ['Ayacucho', 'Acocro', 'Acos Vinchos', 'Andrés Avelino Cáceres Dorregaray', 'Carmen Alto', 'Chiara', 'Jesús Nazareno', 'Ocros',
  'Pacaycasa', 'Quinua', 'San José de Ticllas', 'San Juan Bautista', 'Santiago de Pischa', 'Socos', 'Tambillo', 'Vinchos'];
const names = places => places.map(place => place.name);

describe('F03.1 · E-01: lista propia de la búsqueda (16 distritos de Huamanga)', () => {
  it('por defecto el alcance es Huamanga: exactamente los 16 distritos oficiales, ubigeo 050101–050116, en la zona', () => {
    expect(SEARCH_PLACES_SCOPE).toBe('huamanga');
    expect(names(ACTIVE_SEARCH_PLACES).sort()).toEqual([...OFFICIAL].sort());
    expect(HUAMANGA_DISTRICTS.map(place => place.ubigeo)).toEqual(Array.from({ length: 16 }, (_, i) => `0501${String(i + 1).padStart(2, '0')}`));
    expect(ACTIVE_SEARCH_PLACES.every(place => place.latitude > -13.5 && place.latitude < -13.0 && place.longitude > -74.5 && place.longitude < -73.8)).toBe(true);
  });
  it('con el alcance Huamanga no aparece ningún lugar de Lima ni de otra ciudad, ni al buscar', () => {
    // «Huamanga» es sinónimo aprobado del distrito Ayacucho (E-01): se excluye de «otras ciudades».
    const outside = PERU_PLACES.filter(place => !OFFICIAL.includes(place.name) && place.name !== 'Huamanga').map(place => place.name);
    expect(outside.length).toBeGreaterThan(40);
    for (const name of outside) {
      expect(findSearchPlace(name), name).toBeNull();
      expect(names(filterPlaces(ACTIVE_SEARCH_PLACES, name)).every(found => OFFICIAL.includes(found)), name).toBe(true);
    }
    for (const other of ['Miraflores', 'San Isidro', 'Lima', 'Callao', 'Cusco', 'Arequipa', 'Surco', 'San Borja']) expect(findSearchPlace(other), other).toBeNull();
    expect(names(filterPlaces(ACTIVE_SEARCH_PLACES, 'a')).every(found => OFFICIAL.includes(found))).toBe(true);
  });
  it('filtra por cualquier parte, sin tildes ni mayúsculas; primero los que empiezan así', () => {
    expect(names(filterPlaces(ACTIVE_SEARCH_PLACES, 'nazareno'))).toEqual(['Jesús Nazareno']);
    expect(names(filterPlaces(ACTIVE_SEARCH_PLACES, 'caceres'))).toEqual(['Andrés Avelino Cáceres Dorregaray']);
    expect(names(filterPlaces(ACTIVE_SEARCH_PLACES, 'AVELINO'))).toEqual(['Andrés Avelino Cáceres Dorregaray']);
    expect(names(filterPlaces(ACTIVE_SEARCH_PLACES, 'juan'))).toEqual(['San Juan Bautista']);
    expect(names(filterPlaces(ACTIVE_SEARCH_PLACES, 'jes'))).toEqual(['Jesús Nazareno']);
    expect(names(filterPlaces(ACTIVE_SEARCH_PLACES, 'san'))).toEqual(['San José de Ticllas', 'San Juan Bautista', 'Santiago de Pischa']);
    expect(names(filterPlaces(ACTIVE_SEARCH_PLACES, 'vinchos'))).toEqual(['Vinchos', 'Acos Vinchos']); // empieza → contiene
    expect(names(filterPlaces(ACTIVE_SEARCH_PLACES, 'huamanga'))).toEqual(['Ayacucho']); // sinónimo, no lugar aparte
    expect(findSearchPlace('HUAMANGA').name).toBe('Ayacucho');
    expect(filterPlaces(ACTIVE_SEARCH_PLACES, 'xyz')).toEqual([]);
  });
  it('el resto del Perú está desactivado por configuración, no borrado; con «peru» no hay duplicados', () => {
    expect(placesScope(undefined)).toBe('huamanga'); expect(placesScope('otra cosa')).toBe('huamanga'); expect(placesScope('peru')).toBe('peru');
    const peru = searchPlaces('peru');
    const keys = names(peru).map(name => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
    expect(names(peru)).toContain('Cusco'); expect(names(peru)).not.toContain('Cuzco'); expect(names(peru)).not.toContain('Huamanga');
    expect(names(peru).filter(name => name === 'Ayacucho')).toHaveLength(1);
    expect(names(peru)).toEqual(expect.arrayContaining([...OFFICIAL, 'Miraflores', 'Lima', 'Arequipa']));
    expect(findSearchPlace('cuzco', peru).name).toBe('Cusco');
  });
  it('«Mi farmacia» (F07.1) no cambia: su lista sigue completa, con Cuzco y Huamanga', () => {
    expect(findPeruPlace('Cuzco')).not.toBeNull(); expect(findPeruPlace('Huamanga')).not.toBeNull(); expect(findPeruPlace('Miraflores')).not.toBeNull();
  });
});

describe('F03.1 · E-01: campo «Distrito o ciudad»', () => {
  it('al enfocar muestra los 16; al escribir filtra; sin coincidencias avisa y vuelve a la lista completa', () => {
    const onChoose = vi.fn();
    render(<WhereDialog onChoose={onChoose} onCancel={vi.fn()} />);
    const input = screen.getByLabelText('Distrito o ciudad');
    fireEvent.focus(input);
    expect(screen.getAllByRole('option')).toHaveLength(16);
    fireEvent.change(input, { target: { value: 'caceres' } });
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Andrés Avelino Cáceres Dorregaray']);
    fireEvent.change(input, { target: { value: 'miraflores' } });
    expect(screen.getByText('No encontramos ese distrito')).toBeTruthy();
    expect(screen.getAllByRole('option')).toHaveLength(16);
    fireEvent.click(screen.getByRole('button', { name: 'Usar este lugar' }));
    expect(onChoose).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('No encontramos ese distrito');
    fireEvent.mouseDown(screen.getAllByRole('option').find(option => option.textContent === 'Quinua'));
    expect(input.value).toBe('Quinua');
    fireEvent.click(screen.getByRole('button', { name: 'Usar este lugar' }));
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ source: 'city', label: 'Quinua', latitude: -13.049, longitude: -74.139 }), { remember: false });
  });
});
