import {
  API_PATHS,
  type CardConfig,
  type GlobalFilters,
  type MetaResponse,
  type OccupancyLatestResponse,
  type QueryResponse,
} from "@bms/contract";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly allowed?: ReadonlyArray<string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function unwrap<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      body.message ?? `Request failed with status ${response.status}`,
      response.status,
      body.allowed,
    );
  }
  return response.json();
}

export function fetchMeta(): Promise<MetaResponse> {
  return fetch(API_PATHS.meta).then((res) => unwrap<MetaResponse>(res));
}

export function postQuery(
  config: CardConfig,
  globalFilters: GlobalFilters,
): Promise<QueryResponse> {
  return fetch(API_PATHS.query, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config, globalFilters }),
  }).then((res) => unwrap<QueryResponse>(res));
}

export function fetchOccupancyLatest(
  buildingId: string,
  floor: number,
): Promise<OccupancyLatestResponse> {
  const params = new URLSearchParams({
    building_id: buildingId,
    floor: String(floor),
  });
  return fetch(`${API_PATHS.occupancyLatest}?${params}`).then((res) =>
    unwrap<OccupancyLatestResponse>(res),
  );
}
