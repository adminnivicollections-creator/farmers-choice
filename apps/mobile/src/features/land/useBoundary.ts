import { useCallback, useMemo, useRef, useState } from 'react';
import { LatLng, Measurement, isSelfIntersecting, measurePolygon } from '@fc/geo';

/**
 * The boundary and its history. Every mutation goes through here, so undo/redo
 * and recalculation can never fall out of step with what is on the map.
 */
export function useBoundary(initial: LatLng[] = []) {
  const [points, setPoints] = useState<LatLng[]>(initial);
  const past = useRef<LatLng[][]>([]);
  const future = useRef<LatLng[][]>([]);
  const [, bump] = useState(0);

  const commit = useCallback((next: LatLng[]) => {
    past.current.push(points);
    future.current = []; // a new edit invalidates the redo branch
    setPoints(next);
    bump((n) => n + 1);
  }, [points]);

  const addPoint = useCallback((p: LatLng) => commit([...points, p]), [commit, points]);

  const movePoint = useCallback((i: number, p: LatLng) => {
    const next = [...points];
    next[i] = p;
    commit(next);
  }, [commit, points]);

  const deletePoint = useCallback((i: number) => {
    commit(points.filter((_, k) => k !== i));
  }, [commit, points]);

  /** Insert on the edge nearest the tap, so a point can be added mid-boundary. */
  const insertAfter = useCallback((i: number, p: LatLng) => {
    const next = [...points];
    next.splice(i + 1, 0, p);
    commit(next);
  }, [commit, points]);

  const clear = useCallback(() => commit([]), [commit]);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(points);
    setPoints(prev);
    bump((n) => n + 1);
  }, [points]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(points);
    setPoints(next);
    bump((n) => n + 1);
  }, [points]);

  const replaceAll = useCallback((next: LatLng[]) => commit(next), [commit]);

  // Recalculated on every change -- this is the single source of the numbers.
  const measurement: Measurement = useMemo(() => measurePolygon(points), [points]);
  const selfIntersecting = useMemo(() => isSelfIntersecting(points), [points]);

  return {
    points,
    measurement,
    selfIntersecting,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    addPoint,
    movePoint,
    deletePoint,
    insertAfter,
    clear,
    undo,
    redo,
    replaceAll,
  };
}
