export type QueryParamValue = string | number | boolean | null | undefined;
export type QueryParams = {
  [key: string]: QueryParamValue;
};

export function toQueryString(params: QueryParams) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== null) {
      search.set(key, String(value));
    }
  });

  return search.toString();
}

export function withQuery(path: string, params: QueryParams) {
  const search = toQueryString(params);
  return search ? `${path}?${search}` : path;
}
