import { api, getApiErrorMessage } from "../../api/client.js";

export function axiosBaseQuery({ baseUrl = "" } = {}) {
  return async ({ url, method = "GET", data, body, params, headers, ...rest }) => {
    try {
      const result = await api({
        url: `${baseUrl}${url}`,
        method,
        data: data ?? body,
        params,
        headers,
        ...rest,
      });

      return { data: result.data };
    } catch (error) {
      return {
        error: {
          status: error?.response?.status || "FETCH_ERROR",
          data: error?.response?.data || null,
          message: getApiErrorMessage(error),
        },
      };
    }
  };
}
