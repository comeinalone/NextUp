import { useEffect, useState } from "react";
import { socket, joinRoom, leaveRoom } from "./socket";
import { api, USE_MOCKS } from "./api";

/**
 * Live snapshot for one room.
 *   useLive(`token:${code}`, "token:update", { fetcher: () => api.getToken(code), match: (p) => p.code === code })
 * - fetcher: optional REST call for the first render (the socket join also sends a snapshot)
 * - match:   socket events are shared by event name, so filter to YOUR payload
 * Payloads are full snapshots, so we replace state, never merge.
 */
export function useLive(room, event, { fetcher, match = () => true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!room) return;
    let alive = true;
    const onEvent = (payload) => {
      if (alive && payload && match(payload)) {
        setData(payload);
        setError(null);
      }
    };
    socket.on(event, onEvent);
    joinRoom(room);
    fetcher?.().then((d) => alive && setData((cur) => cur ?? d)).catch((e) => alive && setError(e));
    return () => {
      alive = false;
      socket.off(event, onEvent);
      leaveRoom(room);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, event]);

  return { data, setData, error, loading: data === null && !error };
}

/** Live list of services as { [serviceId]: service:update }. Used by customer home + display. */
export function useServices(ids = [1, 2, 3]) {
  const [byId, setById] = useState({});
  const [error, setError] = useState(null);
  const key = ids.join(",");

  useEffect(() => {
    if (USE_MOCKS) {
      api.services().then((list) => setById(Object.fromEntries(list.map((s) => [s.serviceId, s]))));
      return;
    }
    let alive = true;
    const onEvent = (p) => alive && setById((cur) => ({ ...cur, [p.serviceId]: { ...cur[p.serviceId], ...p } }));
    socket.on("service:update", onEvent);
    ids.forEach((id) => joinRoom(`service:${id}`));
    // GET /services also carries requiredDocuments, which service:update doesn't
    api.services().then((list) => {
      if (!alive) return;
      setById((cur) => Object.fromEntries(list.map((s) => [s.serviceId, { ...s, ...cur[s.serviceId] }])));
    }).catch((e) => alive && setError(e));
    return () => {
      alive = false;
      socket.off("service:update", onEvent);
      ids.forEach((id) => leaveRoom(`service:${id}`));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { services: Object.values(byId).sort((a, b) => a.serviceId - b.serviceId), error };
}
