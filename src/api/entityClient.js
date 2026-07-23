import { api } from './apiClient';

// Mirrors the base44 SDK's generic entity interface (list/filter/create/update/delete/
// bulkCreate/schema) 1:1 so existing page/component call sites keep working unchanged.
export function createEntityClient(entityName) {
  const base = `/entities/${entityName}`;

  const buildListQuery = (sort, limit) => {
    const params = new URLSearchParams();
    if (sort) params.set('sort', sort);
    if (limit) params.set('limit', String(limit));
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  return {
    list: (sort, limit) => api.get(buildListQuery(sort, limit)),
    filter: (query = {}, sort, limit) => {
      const params = new URLSearchParams();
      params.set('q', JSON.stringify(query));
      if (sort) params.set('sort', sort);
      if (limit) params.set('limit', String(limit));
      return api.get(`${base}?${params.toString()}`);
    },
    get: (id) => api.get(`${base}/${id}`),
    create: (data) => api.post(base, data),
    bulkCreate: (items) => api.post(`${base}/bulk`, items),
    update: (id, data) => api.patch(`${base}/${id}`, data),
    delete: (id) => api.delete(`${base}/${id}`),
    schema: () => api.get(`${base}/schema`),
  };
}
