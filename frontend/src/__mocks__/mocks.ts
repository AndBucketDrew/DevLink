import type { AxiosResponse } from 'axios';

// Reusable helper to create a valid AxiosResponse (fixes your error)
export const mockAxiosResponse = <T>(data: T, status = 200): AxiosResponse<T> => ({
  data,
  status,
  statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
  headers: {},
  config: {} as any,
  request: {} as any,
});

// more specific versions
export const mockSuccessResponse = <T>(data: T) => mockAxiosResponse(data, 200);
export const mockErrorResponse = <T>(data: T, status = 400) => mockAxiosResponse(data, status);
