import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { getCachedAuthMode } from '../config/authMode';
import { endExpiredLocalSession } from './localAuth';
import { getLocalToken } from './localToken';

// Get API base URL from environment variable or default to localhost
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Custom error class for network errors
 * Allows distinguishing network errors from other API errors
 */
export class NetworkError extends Error {
  constructor(message: string = 'Network error: No response from server') {
    super(message);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Check if an error is a network error
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError || 
         (error instanceof Error && error.message.includes('Network error'));
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * The bearer token for the current session: the local JWT when the backend runs AUTH_MODE=local, otherwise the
 * Firebase ID token. The local JWT is not checked for expiry here; a 401 ends the session (see the response
 * interceptor).
 * firebase.ts is imported on demand so a local-mode build never initialises Firebase.
 */
async function getAuthToken(forceRefresh = false): Promise<string | null> {
  // Chosen by mode, not by what is stored: a leftover local token must not shadow a Firebase session.
  if (getCachedAuthMode() === 'local') {
    return getLocalToken();
  }

  try {
    const { getFirebaseAuth } = await import('../config/firebase');
    const auth = getFirebaseAuth();
    const user = auth?.currentUser;
    if (!user) {
      return null;
    }
    try {
      return await user.getIdToken(forceRefresh);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Create axios instance with default configuration
 */
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

/**
 * Request interceptor to add authentication token
 */
axiosInstance.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getAuthToken();
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Don't throw error here - let the request fail naturally if no token
    // The hooks should handle this with enabled checks
    
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor to handle errors and transform responses
 */
axiosInstance.interceptors.response.use(
  (response) => {
    // Axios already handles 204 responses correctly
    // Just return the response as-is
    return response;
  },
  (error: AxiosError) => {
    const formatValidationDetails = (details: unknown): string | undefined => {
      if (!details || typeof details !== 'object') return undefined;
      const entries = Object.entries(details as Record<string, unknown>);
      const parts: string[] = [];
      for (const [key, value] of entries) {
        if (Array.isArray(value)) {
          const msgs = value.filter((v) => typeof v === 'string') as string[];
          if (msgs.length) parts.push(`${key}: ${msgs.join(', ')}`);
        } else if (typeof value === 'string' && value) {
          parts.push(`${key}: ${value}`);
        }
      }
      return parts.length ? parts.join('; ') : undefined;
    };

    const getBackendErrorMessage = (data: unknown): string | undefined => {
      // Backend shape: { success:false, error:{ code, message, details } }
      const d = data as { message?: unknown; error?: unknown } | null | undefined;
      const backendError = d?.error;

      // Common legacy/alternate shapes
      if (typeof d?.message === 'string' && d.message) return d.message;
      if (typeof d?.error === 'string' && d.error) return d.error;

      if (backendError && typeof backendError === 'object') {
        const be = backendError as { message?: unknown; details?: unknown };
        const message =
          typeof be.message === 'string' && be.message
            ? be.message
            : undefined;
        const detailsText = formatValidationDetails(be.details);
        if (message && detailsText) return `${message}: ${detailsText}`;
        if (message) return message;
        if (detailsText) return detailsText;
      }

      return undefined;
    };

    // Handle different error types
    if (error.response) {
      // Server responded with error status
      if (error.response.status === 401 && getCachedAuthMode() === 'local' && getLocalToken()) {
        endExpiredLocalSession();
      }
      const data = error.response.data as unknown;
      const errorMessage = getBackendErrorMessage(data) || `HTTP ${error.response.status}`;
      
      // Create a more descriptive error
      const apiError = new Error(errorMessage) as Error & { status?: number; data?: unknown; code?: string; details?: unknown };
      apiError.status = error.response.status;
      apiError.data = error.response.data;
      // Expose backend error info if present (useful for UI decisions/debugging)
      if (data && typeof data === 'object' && 'error' in data && data.error && typeof data.error === 'object') {
        apiError.code = 'code' in data.error ? String(data.error.code) : undefined;
        apiError.details = 'details' in data.error ? data.error.details : undefined;
      }
      
      return Promise.reject(apiError);
    } else if (error.request) {
      // Request was made but no response received
      // Check if it's a timeout or connection error
      const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
      const isConnectionError = error.code === 'ERR_NETWORK' || 
                               error.code === 'ECONNREFUSED' ||
                               error.message?.includes('Network Error');
      
      const errorMessage = isTimeout 
        ? 'Network error: Request timeout - server took too long to respond'
        : isConnectionError
        ? 'Network error: Unable to connect to server'
        : 'Network error: No response from server';
      
      return Promise.reject(new NetworkError(errorMessage));
    } else {
      // Something else happened
      return Promise.reject(error);
    }
  }
);

/**
 * API Client class for making authenticated requests to the backend
 */
class ApiClient {
  private axiosInstance: AxiosInstance;

  constructor(instance: AxiosInstance) {
    this.axiosInstance = instance;
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const config: AxiosRequestConfig = {
      params: this.serializeParams(params),
    };
    
    const response = await this.axiosInstance.get<ApiResponse<T>>(endpoint, config);
    return response.data;
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    const response = await this.axiosInstance.post<ApiResponse<T>>(endpoint, body);
    return response.data;
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    const response = await this.axiosInstance.patch<ApiResponse<T>>(endpoint, body);
    return response.data;
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    const response = await this.axiosInstance.put<ApiResponse<T>>(endpoint, body);
    return response.data;
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    const config: AxiosRequestConfig = body ? { data: body } : {};
    const response = await this.axiosInstance.delete<ApiResponse<T>>(endpoint, config);
    
    // Handle 204 No Content responses
    if (response.status === 204) {
      return { success: true } as ApiResponse<T>;
    }
    
    return response.data;
  }

  /**
   * Serialize parameters for query string
   * Handles Date objects, arrays, and other types
   */
  private serializeParams(params?: Record<string, any>): Record<string, any> | undefined {
    if (!params) {
      return undefined;
    }

    const serialized: Record<string, any> = {};
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        // Handle Date objects
        if (value instanceof Date) {
          serialized[key] = value.toISOString();
        } 
        // Handle arrays - axios will serialize them correctly
        else if (Array.isArray(value)) {
          serialized[key] = value;
        } 
        // Handle other types
        else {
          serialized[key] = value;
        }
      }
    });

    return serialized;
  }
}

// Export singleton instance
export const apiClient = new ApiClient(axiosInstance);

// Export axios instance for advanced usage if needed
export { axiosInstance };
