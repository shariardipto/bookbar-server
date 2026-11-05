export type ApiSuccess<T> = { success: true; data: T; message?: string };
export type ApiFailure = {
  success: false;
  message: string;
  error: { code: string; details?: { field: string; message: string }[] };
};
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
